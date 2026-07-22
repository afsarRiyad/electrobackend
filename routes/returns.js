import { Router } from "express";
import { ReturnRequest, RefundRequest, Order, User } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";
import { validateReturnRequest } from "../utils/validation.js";

const router = Router();

// @desc    Create a return request
// @route   POST /api/returns
// @access  Private
router.post("/", protect, validateReturnRequest, async (req, res) => {
  try {
    const { order, orderNumber, items, reason, description, refundMethod, shippingAddress } = req.body;
    const user = req.user;

    // Verify order exists and belongs to user
    const orderData = await Order.findById(order);
    if (!orderData) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if order already has a return request
    const existingReturn = await ReturnRequest.findOne({ order });
    if (existingReturn) {
      return res.status(400).json({ message: "Return request already exists for this order" });
    }

    // Calculate refund amount
    let refundAmount = 0;
    items.forEach(item => {
      const orderItem = orderData.items.find(oi => oi.product.toString() === item.product);
      if (orderItem) {
        refundAmount += orderItem.unitPrice * item.quantity;
      }
    });

    // Create return request
    const returnRequest = await ReturnRequest.create({
      order,
      orderNumber,
      user: user._id,
      customerName: user.username,
      customerEmail: user.email,
      items,
      reason,
      description,
      refundMethod: refundMethod || "original_payment",
      refundAmount,
      shippingAddress: shippingAddress || orderData.shippingAddress,
    });

    // Update order status
    orderData.status = "return_requested";
    await orderData.save();

    res.status(201).json({
      data: returnRequest,
      message: "Return request submitted successfully",
    });
  } catch (error) {
    console.error("Return request error:", error);
    res.status(500).json({ message: "Server error during return request" });
  }
});

// @desc    Get user's return requests
// @route   GET /api/returns
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const returnRequests = await ReturnRequest.find({ user: req.user._id })
      .populate("order", "orderNumber totalAmount status")
      .sort({ createdAt: -1 });

    res.json({ data: returnRequests });
  } catch (error) {
    console.error("Get return requests error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Get single return request
// @route   GET /api/returns/:id
// @access  Private
router.get("/:id", protect, async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id)
      .populate("order")
      .populate("user", "username email");

    if (!returnRequest) {
      return res.status(404).json({ message: "Return request not found" });
    }

    // Check if user owns this return request
    if (returnRequest.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json({ data: returnRequest });
  } catch (error) {
    console.error("Get return request error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Cancel return request
// @route   DELETE /api/returns/:id
// @access  Private
router.delete("/:id", protect, async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);

    if (!returnRequest) {
      return res.status(404).json({ message: "Return request not found" });
    }

    // Check if user owns this return request
    if (returnRequest.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Only allow cancellation if pending
    if (returnRequest.status !== "pending") {
      return res.status(400).json({ message: "Cannot cancel processed return request" });
    }

    // Update order status back
    const order = await Order.findById(returnRequest.order);
    if (order) {
      order.status = "delivered"; // or previous status
      await order.save();
    }

    await ReturnRequest.deleteOne({ _id: req.params.id });

    res.json({ message: "Return request cancelled successfully" });
  } catch (error) {
    console.error("Cancel return request error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
