import { Router } from "express";
import { User, Product, Customer, Order, Inventory } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";

const router = Router();
const guard = [protect, isAdmin];

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
// Main dashboard statistics — all queries run in parallel for speed
router.get("/", ...guard, async (req, res) => {
  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    const [
      // Counts
      totalUsers,
      totalProducts,
      totalCustomers,
      totalOrders,
      activeProducts,
      // This month
      newUsersThisMonth,
      newCustomersThisMonth,
      ordersThisMonth,
      // Last month (for growth comparison)
      newUsersLastMonth,
      newCustomersLastMonth,
      ordersLastMonth,
      // Revenue
      revenueAll,
      revenueThisMonth,
      revenueLastMonth,
      // Order status breakdown
      orderStatusBreakdown,
      // Monthly revenue chart (last 12 months)
      monthlyRevenue,
      // Top 5 selling products by order item quantity
      topProducts,
      // Recent 10 orders
      recentOrders,
      // Low stock count
      lowStockCount,
      outOfStockCount,
      // User growth last 12 months
      userGrowth,
      // Payment method breakdown
      paymentMethodBreakdown,
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Customer.countDocuments(),
      Order.countDocuments(),
      Product.countDocuments({ isActive: true }),

      User.countDocuments({ createdAt: { $gte: thisMonthStart } }),
      Customer.countDocuments({ createdAt: { $gte: thisMonthStart } }),
      Order.countDocuments({ createdAt: { $gte: thisMonthStart } }),

      User.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
      Customer.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
      Order.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),

      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid", createdAt: { $gte: thisMonthStart } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: "paid", createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      Order.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Monthly revenue chart
      Order.aggregate([
        { $match: { paymentStatus: "paid", createdAt: { $gte: twelveMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // Top products (by order item quantity) - optimized to avoid $lookup
      Order.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            productName: { $first: "$items.productName" },
            totalSold: { $sum: "$items.quantity" },
            totalRevenue: { $sum: "$items.totalPrice" },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
      ]),

      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select("orderNumber customerName totalAmount status paymentStatus createdAt")
        .lean(),

      Inventory.countDocuments({ $expr: { $lte: ["$quantity", "$lowStockThreshold"] } }),
      Inventory.countDocuments({ quantity: 0 }),

      User.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      Order.aggregate([
        { $group: { _id: "$paymentMethod", count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    // Calculate growth percentages
    const calcGrowth = (current, previous) => {
      if (!previous) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const revNow = revenueThisMonth[0]?.total || 0;
    const revPrev = revenueLastMonth[0]?.total || 0;

    return res.json({
      data: {
        // KPI Cards
        overview: {
          totalRevenue: revenueAll[0]?.total || 0,
          revenueThisMonth: revNow,
          revenueGrowth: calcGrowth(revNow, revPrev),

          totalOrders,
          ordersThisMonth,
          ordersGrowth: calcGrowth(ordersThisMonth, ordersLastMonth),

          totalUsers,
          newUsersThisMonth,
          usersGrowth: calcGrowth(newUsersThisMonth, newUsersLastMonth),

          totalCustomers,
          newCustomersThisMonth,
          customersGrowth: calcGrowth(newCustomersThisMonth, newCustomersLastMonth),

          totalProducts,
          activeProducts,

          lowStockCount,
          outOfStockCount,
        },
        // Charts
        monthlyRevenue,
        userGrowth,
        orderStatusBreakdown,
        paymentMethodBreakdown,
        // Tables
        topProducts,
        recentOrders,
      },
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
