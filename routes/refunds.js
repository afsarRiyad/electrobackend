import { Router } from "express";
import { RefundRequest, ReturnRequest, Order, User } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";
import { validateRefundRequest } from "../utils/validation.js";

const router = Router();

// @desc    Create a refund request
// @route   POST /api/refunds
// @access  Private
router.post("/", protect, validateRefundRequest, async (req, res) => {
  try {
    const { order, orderNumber, amount, reason, description, refundMethod, bankDetails, returnRequest } = req.body;
    const user = req.user;

    // Verify order exists and belongs to user
    const orderData = await Order.findById(order);
    if (!orderData) {
      return res.status(404).json({ message: "Order not found" });
    }

    // If linked to return request, verify it exists
    if (returnRequest) {
      const returnData = await ReturnRequest.findById(returnRequest);
      if (!returnData) {
        return res.status(404).json({ message: "Return request not found" });
      }
      if (returnData.user.toString() !== user._id.toString()) {
        return res.status(403).json({ message: "Not authorized" });
      }
    }

    // Check if refund amount doesn't exceed order total
    if (amount > orderData.totalAmount) {
      return res.status(400).json({ message: "Refund amount cannot exceed order total" });
    }

    // Create refund request
    const refundRequest = await RefundRequest.create({
      order,
      orderNumber,
      returnRequest: returnRequest || null,
      user: user._id,
      customerName: user.username,
      customerEmail: user.email,
      amount,
      reason,
      description,
      refundMethod,
      bankDetails: refundMethod === "bank_transfer" ? bankDetails : null,
    });

    res.status(201).json({
      data: refundRequest,
      message: "Refund request submitted successfully",
    });
  } catch (error) {
    console.error("Refund request error:", error);
    res.status(500).json({ message: "Server error during refund request" });
  }
});

// @desc    Get user's refund requests
// @route   GET /api/refunds
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const refundRequests = await RefundRequest.find({ user: req.user._id })
      .populate("order", "orderNumber totalAmount status")
      .populate("returnRequest", "status")
      .sort({ createdAt: -1 });

    res.json({ data: refundRequests });
  } catch (error) {
    console.error("Get refund requests error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Get single refund request
// @route   GET /api/refunds/:id
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const refundRequest = await RefundRequest.findById(req.params.id)
      .populate("order")
      .populate("returnRequest")
      .populate("user", "username email");

    if (!refundRequest) {
      return res.status(404).json({ message: "Refund request not found" });
    }

    // Check if user owns this refund request
    if (refundRequest.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json({ data: refundRequest });
  } catch (error) {
    console.error("Get refund request error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Cancel refund request
// @route   DELETE /api/refunds/:id
// @access  Private
router.delete("/:id", protect, async (req, res) => {
  try {
    const refundRequest = await RefundRequest.findById(req.params.id);

    if (!refundRequest) {
      return res.status(404).json({ message: "Refund request not found" });
    }

    // Check if user owns this refund request
    if (refundRequest.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Only allow cancellation if pending
    if (refundRequest.status !== "pending") {
      return res.status(400).json({ message: "Cannot cancel processed refund request" });
    }

    await RefundRequest.deleteOne({ _id: req.params.id });

    res.json({ message: "Refund request cancelled successfully" });
  } catch (error) {
    console.error("Cancel refund request error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
