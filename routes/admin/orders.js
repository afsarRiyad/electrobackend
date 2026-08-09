import { Router } from "express";
import { Order, User } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";

const router = Router();
const guard = [protect, isAdmin];

// ─── GET /api/admin/orders ───────────────────────────────────────────────
// Get all orders with pagination and filtering
router.get("/", ...guard, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      paymentStatus, 
      paymentMethod,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build filter
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }
    
    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }
    
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
      ];
    }
    
    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate('customer', 'username email')
        .lean(),
      Order.countDocuments(filter),
    ]);
    
    return res.json({
      data: orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/orders/:id ─────────────────────────────────────────────
// Get single order by ID
router.get("/:id", ...guard, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'username email phone')
      .lean();
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    return res.json({ data: order });
  } catch (error) {
    console.error("Get order error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/orders/number/:orderNumber ───────────────────────────────
// Get order by order number
router.get("/number/:orderNumber", ...guard, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('customer', 'username email phone')
      .lean();
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    return res.json({ data: order });
  } catch (error) {
    console.error("Get order by number error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/admin/orders/:id/status ───────────────────────────────────────
// Update order status
router.put("/:id/status", ...guard, async (req, res) => {
  try {
    const { status, note } = req.body;
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Update status
    order.status = status;
    
    // Add to status history
    order.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id,
      note: note || null,
    });
    
    await order.save();
    
    return res.json({ 
      message: "Order status updated successfully",
      data: order 
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/orders/stats ────────────────────────────────────────────
// Get order statistics
router.get("/stats", ...guard, async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
        }
      }
    ]);
    
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    return res.json({
      data: {
        byStatus: stats,
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
      }
    });
  } catch (error) {
    console.error("Get order stats error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
