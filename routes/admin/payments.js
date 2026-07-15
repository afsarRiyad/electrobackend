import { Router } from "express";
import { Order, Customer } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";

const router = Router();
const guard = [protect, isAdmin];

// ─── GET /api/admin/payments/stats ────────────────────────────────────────────
// Revenue statistics — defined BEFORE /:id to avoid conflict
router.get("/stats", ...guard, async (req, res) => {
  try {
    const { period = "month" } = req.query;

    // Date range for the chosen period
    const now = new Date();
    let startDate;
    if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      // month (default)
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [
      totalRevenue,
      totalOrders,
      paidOrders,
      pendingOrders,
      cancelledOrders,
      refundedOrders,
      monthlyRevenue,
      topPaymentMethods,
    ] = await Promise.all([
      // Total revenue from paid orders
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.countDocuments(),
      Order.countDocuments({ paymentStatus: "paid" }),
      Order.countDocuments({ status: "pending" }),
      Order.countDocuments({ status: "cancelled" }),
      Order.countDocuments({ status: "refunded" }),
      // Monthly revenue for chart (last 12 months)
      Order.aggregate([
        { $match: { paymentStatus: "paid", createdAt: { $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      // Payment method breakdown
      Order.aggregate([
        { $group: { _id: "$paymentMethod", count: { $sum: 1 }, total: { $sum: "$totalAmount" } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return res.json({
      data: {
        totalRevenue: totalRevenue[0]?.total || 0,
        totalOrders,
        paidOrders,
        pendingOrders,
        cancelledOrders,
        refundedOrders,
        monthlyRevenue,
        topPaymentMethods,
      },
    });
  } catch (err) {
    console.error("Payment stats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/payments ──────────────────────────────────────────────────
router.get("/", ...guard, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status,
      paymentStatus,
      paymentMethod,
      startDate,
      endDate,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerEmail: { $regex: search, $options: "i" } },
        { transactionId: { $regex: search, $options: "i" } },
      ];
    }
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .populate("customer", "name email avatar")
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.json({
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("List payments error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/payments/:id ──────────────────────────────────────────────
router.get("/:id", ...guard, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name email phone avatar address")
      .populate("items.product", "name image sku")
      .lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.json({ data: order });
  } catch (err) {
    console.error("Get order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/payments ─────────────────────────────────────────────────
router.post("/", ...guard, async (req, res) => {
  try {
    const {
      customer,
      customerName,
      customerEmail,
      items = [],
      subtotal,
      discount = 0,
      tax = 0,
      shippingCost = 0,
      totalAmount,
      status,
      paymentMethod,
      paymentStatus,
      transactionId,
      shippingAddress,
      notes,
    } = req.body;

    if (!customerName || !customerEmail || totalAmount === undefined)
      return res.status(400).json({ message: "customerName, customerEmail, totalAmount are required" });

    const order = await Order.create({
      customer,
      customerName,
      customerEmail,
      items,
      subtotal: subtotal || totalAmount,
      discount,
      tax,
      shippingCost,
      totalAmount,
      status: status || "pending",
      paymentMethod: paymentMethod || "cash_on_delivery",
      paymentStatus: paymentStatus || "unpaid",
      transactionId,
      shippingAddress,
      notes,
    });

    // Update customer stats if customer ref provided
    if (customer && paymentStatus === "paid") {
      await Customer.findByIdAndUpdate(customer, {
        $inc: { totalOrders: 1, totalSpent: totalAmount },
      });
    }

    return res.status(201).json({ message: "Order created", data: order });
  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/admin/payments/:id ──────────────────────────────────────────────
router.put("/:id", ...guard, async (req, res) => {
  try {
    const allowed = [
      "customerName", "customerEmail", "items", "subtotal", "discount", "tax",
      "shippingCost", "totalAmount", "status", "paymentMethod", "paymentStatus",
      "transactionId", "shippingAddress", "notes",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const order = await Order.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!order) return res.status(404).json({ message: "Order not found" });

    return res.json({ message: "Order updated", data: order });
  } catch (err) {
    console.error("Update order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/admin/payments/:id ───────────────────────────────────────────
router.delete("/:id", ...guard, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.json({ message: "Order deleted" });
  } catch (err) {
    console.error("Delete order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/admin/payments/:id/status ────────────────────────────────────
// Quick status / payment-status update
router.patch("/:id/status", ...guard, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (paymentStatus) updates.paymentStatus = paymentStatus;

    if (!Object.keys(updates).length)
      return res.status(400).json({ message: "status or paymentStatus required" });

    const order = await Order.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });

    return res.json({ message: "Order status updated", data: order });
  } catch (err) {
    console.error("Order status error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
