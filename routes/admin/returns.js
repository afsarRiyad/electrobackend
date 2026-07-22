import { Router } from "express";
import { ReturnRequest, RefundRequest, Order, User } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";

const router = Router();

// @desc    Get all return requests
// @route   GET /api/admin/returns
// @access  Admin
router.get("/", protect, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};

    const returnRequests = await ReturnRequest.find(filter)
      .populate("order", "orderNumber totalAmount status")
      .populate("user", "username email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ReturnRequest.countDocuments(filter);

    res.json({
      data: returnRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get return requests error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Get single return request
// @route   GET /api/admin/returns/:id
// @access  Admin
router.get("/:id", protect, isAdmin, async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id)
      .populate("order")
      .populate("user", "username email");

    if (!returnRequest) {
      return res.status(404).json({ message: "Return request not found" });
    }

    res.json({ data: returnRequest });
  } catch (error) {
    console.error("Get return request error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Update return request status
// @route   PATCH /api/admin/returns/:id/status
// @access  Admin
router.patch("/:id/status", protect, isAdmin, async (req, res) => {
  try {
    const { status, adminNotes, trackingNumber } = req.body;
    const returnRequest = await ReturnRequest.findById(req.params.id);

    if (!returnRequest) {
      return res.status(404).json({ message: "Return request not found" });
    }

    // Update status
    returnRequest.status = status;
    if (adminNotes) returnRequest.adminNotes = adminNotes;
    if (trackingNumber) returnRequest.trackingNumber = trackingNumber;

    // Add to status history
    returnRequest.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id,
      note: adminNotes || null,
    });

    await returnRequest.save();

    // Update order status based on return status
    const order = await Order.findById(returnRequest.order);
    if (order) {
      switch (status) {
        case "approved":
          order.status = "return_approved";
          break;
        case "rejected":
          order.status = "delivered";
          break;
        case "completed":
          order.status = "return_completed";
          break;
      }
      await order.save();
    }

    res.json({ data: returnRequest, message: "Return status updated" });
  } catch (error) {
    console.error("Update return status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Get all refund requests
// @route   GET /api/admin/refunds
// @access  Admin
router.get("/refunds/all", protect, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};

    const refundRequests = await RefundRequest.find(filter)
      .populate("order", "orderNumber totalAmount status")
      .populate("returnRequest", "status")
      .populate("user", "username email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RefundRequest.countDocuments(filter);

    res.json({
      data: refundRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get refund requests error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Update refund request status
// @route   PATCH /api/admin/refunds/:id/status
// @access  Admin
router.patch("/refunds/:id/status", protect, isAdmin, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const refundRequest = await RefundRequest.findById(req.params.id);

    if (!refundRequest) {
      return res.status(404).json({ message: "Refund request not found" });
    }

    // Update status
    refundRequest.status = status;
    if (adminNotes) refundRequest.adminNotes = adminNotes;

    // Add to status history
    refundRequest.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id,
      note: adminNotes || null,
    });

    await refundRequest.save();

    // Update order payment status if refund completed
    if (status === "completed") {
      const order = await Order.findById(refundRequest.order);
      if (order) {
        order.paymentStatus = "refunded";
        await order.save();
      }
    }

    res.json({ data: refundRequest, message: "Refund status updated" });
  } catch (error) {
    console.error("Update refund status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Get return/refund statistics
// @route   GET /api/admin/returns/stats
// @access  Admin
router.get("/stats/overview", protect, isAdmin, async (req, res) => {
  try {
    const returnStats = await ReturnRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$refundAmount" },
        },
      },
    ]);

    const refundStats = await RefundRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const totalReturns = await ReturnRequest.countDocuments();
    const totalRefunds = await RefundRequest.countDocuments();
    const pendingReturns = await ReturnRequest.countDocuments({ status: "pending" });
    const pendingRefunds = await RefundRequest.countDocuments({ status: "pending" });

    res.json({
      data: {
        returnStats,
        refundStats,
        totalReturns,
        totalRefunds,
        pendingReturns,
        pendingRefunds,
      },
    });
  } catch (error) {
    console.error("Get return/refund stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
