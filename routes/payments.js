import { Router } from "express";
import { Order } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";
import PaymentService from "../services/paymentService.js";

const router = Router();

// ─── POST /api/payments/bkash/create ─────────────────────────────────────
// Create bKash payment
router.post("/bkash/create", protect, async (req, res) => {
  try {
    const { amount, orderDetails } = req.body;

    if (!amount || !orderDetails) {
      return res.status(400).json({ message: "Amount and order details are required" });
    }

    const payment = await PaymentService.createBkashPayment(amount, orderDetails);

    return res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("bKash payment creation error:", error);
    return res.status(500).json({ message: error.message || "Failed to create bKash payment" });
  }
});

// ─── POST /api/payments/bkash/execute ──────────────────────────────────────
// Execute bKash payment (after user completes payment on bKash page)
router.post("/bkash/execute", protect, async (req, res) => {
  try {
    const { paymentID } = req.body;

    if (!paymentID) {
      return res.status(400).json({ message: "Payment ID is required" });
    }

    const result = await PaymentService.executeBkashPayment(paymentID);

    // Update order status if payment successful
    if (result && result.transactionStatus === 'Completed') {
      const order = await Order.findOneAndUpdate(
        { transactionId: result.merchantInvoiceNumber },
        {
          paymentStatus: 'paid',
          status: 'processing',
        },
        { new: true }
      );

      return res.json({
        success: true,
        message: "Payment completed successfully",
        data: { order, paymentDetails: result },
      });
    }

    return res.status(400).json({
      success: false,
      message: "Payment failed or incomplete",
      data: result,
    });
  } catch (error) {
    console.error("bKash payment execution error:", error);
    return res.status(500).json({ message: error.message || "Failed to execute bKash payment" });
  }
});

// ─── POST /api/payments/bkash/callback ─────────────────────────────────────
// bKash callback URL (public endpoint for bKash to call)
router.post("/bkash/callback", async (req, res) => {
  try {
    const { paymentID, status } = req.body;

    // Query payment status from bKash
    const paymentStatus = await PaymentService.queryBkashPayment(paymentID);

    if (paymentStatus && paymentStatus.transactionStatus === 'Completed') {
      // Update order status
      await Order.findOneAndUpdate(
        { transactionId: paymentStatus.merchantInvoiceNumber },
        {
          paymentStatus: 'paid',
          status: 'processing',
        }
      );

      // Redirect to success page
      return res.redirect(`${process.env.CLIENT_URL}/payment/success?paymentID=${paymentID}`);
    }

    // Redirect to failure page
    return res.redirect(`${process.env.CLIENT_URL}/payment/failed?paymentID=${paymentID}`);
  } catch (error) {
    console.error("bKash callback error:", error);
    return res.redirect(`${process.env.CLIENT_URL}/payment/failed`);
  }
});

// ─── POST /api/payments/nagad/create ──────────────────────────────────────
// Create Nagad payment
router.post("/nagad/create", protect, async (req, res) => {
  try {
    const { amount, orderDetails } = req.body;

    if (!amount || !orderDetails) {
      return res.status(400).json({ message: "Amount and order details are required" });
    }

    const payment = await PaymentService.createNagadPayment(amount, orderDetails);

    return res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Nagad payment creation error:", error);
    return res.status(500).json({ message: error.message || "Failed to create Nagad payment" });
  }
});

// ─── POST /api/payments/nagad/callback ─────────────────────────────────────
// Nagad callback URL (public endpoint for Nagad to call)
router.post("/nagad/callback", async (req, res) => {
  try {
    const { paymentID, status } = req.body;

    // Verify payment status from Nagad
    const paymentStatus = await PaymentService.verifyNagadPayment(paymentID);

    if (paymentStatus && paymentStatus.status === 'Success') {
      // Update order status
      await Order.findOneAndUpdate(
        { transactionId: paymentStatus.merchantReference },
        {
          paymentStatus: 'paid',
          status: 'processing',
        }
      );

      // Redirect to success page
      return res.redirect(`${process.env.CLIENT_URL}/payment/success?paymentID=${paymentID}`);
    }

    // Redirect to failure page
    return res.redirect(`${process.env.CLIENT_URL}/payment/failed?paymentID=${paymentID}`);
  } catch (error) {
    console.error("Nagad callback error:", error);
    return res.redirect(`${process.env.CLIENT_URL}/payment/failed`);
  }
});

// ─── GET /api/payments/status/:paymentID ───────────────────────────────────
// Check payment status
router.get("/status/:paymentID", protect, async (req, res) => {
  try {
    const { paymentID } = req.params;
    const { paymentMethod } = req.query;

    let paymentStatus;

    if (paymentMethod === 'bkash') {
      paymentStatus = await PaymentService.queryBkashPayment(paymentID);
    } else if (paymentMethod === 'nagad') {
      paymentStatus = await PaymentService.verifyNagadPayment(paymentID);
    } else {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    return res.json({
      success: true,
      data: paymentStatus,
    });
  } catch (error) {
    console.error("Payment status check error:", error);
    return res.status(500).json({ message: error.message || "Failed to check payment status" });
  }
});

export default router;
