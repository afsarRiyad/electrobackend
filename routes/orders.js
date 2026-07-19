import { Router } from "express";
import { Order, Product, Customer } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";
import { exportOrdersToCSV } from "../utils/export.js";
import { activityMiddleware } from "../utils/activityLog.js";

const router = Router();

// ─── GET /api/orders/track/:orderNumber ─────────────────────────────────────
// Public order tracking by order number
router.get("/track/:orderNumber", async (req, res) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({ message: "Order number is required" });
    }

    const order = await Order.findOne({ orderNumber })
      .populate("items.product", "name image")
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Return limited info for public tracking
    return res.json({
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        shippingAddress: order.shippingAddress,
      },
    });
  } catch (err) {
    console.error("Track order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/orders ──────────────────────────────────────────────────
// Get current user's orders
router.get("/", protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = { customerEmail: req.user.email };

    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
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
    console.error("Get user orders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/orders/:id ──────────────────────────────────────────────
// Get specific order details
router.get("/:id", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product", "name image sku price")
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify order belongs to current user
    if (order.customerEmail !== req.user.email) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.json({ data: order });
  } catch (err) {
    console.error("Get order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/orders ─────────────────────────────────────────────────
// Create new order
router.post("/", protect, activityMiddleware('create', 'order'), async (req, res) => {
  try {
    const {
      items = [],
      shippingAddress,
      paymentMethod = "cash_on_delivery",
      notes,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    if (!shippingAddress) {
      return res.status(400).json({ message: "Shipping address is required" });
    }

    // Validate payment method
    const validPaymentMethods = [
      "credit_card",
      "debit_card", 
      "paypal",
      "bkash",
      "nagad",
      "bank_transfer",
      "cash_on_delivery",
    ];

    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    // Get product details and calculate totals
    const productIds = items.map(item => item.product);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = productMap.get(item.product);
      if (!product) {
        return res.status(400).json({ message: `Product not found: ${item.product}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}` 
        });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      validatedItems.push({
        product: product._id,
        productName: product.name,
        productSku: product.sku,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal,
      });
    }

    // Calculate totals
    const discount = 0; // Can be enhanced with coupon logic
    const tax = subtotal * 0.15; // 15% tax
    const shippingCost = paymentMethod === "cash_on_delivery" ? 50 : 0;
    const totalAmount = subtotal - discount + tax + shippingCost;

    // Create or find customer using upsert
    const customer = await Customer.findOneAndUpdate(
      { email: req.user.email },
      {
        name: req.user.username,
        email: req.user.email,
        phone: req.user.phone || null,
        address: shippingAddress,
      },
      { upsert: true, new: true }
    );

    // Create order
    const order = await Order.create({
      customer: customer._id,
      customerName: req.user.username,
      customerEmail: req.user.email,
      items: validatedItems,
      subtotal,
      discount,
      tax,
      shippingCost,
      totalAmount,
      status: "pending",
      paymentMethod,
      paymentStatus: paymentMethod === "cash_on_delivery" ? "unpaid" : "paid",
      transactionId: paymentMethod !== "cash_on_delivery" ? `TXN-${Date.now()}` : null,
      shippingAddress,
      notes,
    });

    // Update product stock using bulk operation
    const stockUpdates = validatedItems.map(item => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: -item.quantity } }
      }
    }));
    await Product.bulkWrite(stockUpdates);

    // Update customer stats
    await Customer.findByIdAndUpdate(customer._id, {
      $inc: { 
        totalOrders: 1,
        totalSpent: totalAmount
      }
    });

    return res.status(201).json({ message: "Order created successfully", data: order });
  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/orders/:id ──────────────────────────────────────────────
// Update order (limited fields for users)
router.put("/:id", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify order belongs to current user
    if (order.customerEmail !== req.user.email) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Only allow updating shipping address and notes for pending orders
    if (order.status !== "pending") {
      return res.status(400).json({ message: "Can only update pending orders" });
    }

    const allowed = ["shippingAddress", "notes"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (req.body.shippingAddress) {
      updates.shippingAddress = req.body.shippingAddress;
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    return res.json({ message: "Order updated", data: updatedOrder });
  } catch (err) {
    console.error("Update order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/orders/:id/cancel ──────────────────────────────────────
// Cancel order
router.patch("/:id/cancel", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify order belongs to current user
    if (order.customerEmail !== req.user.email) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Can only cancel pending or processing orders
    if (!["pending", "processing"].includes(order.status)) {
      return res.status(400).json({ 
        message: `Cannot cancel order with status: ${order.status}` 
      });
    }

    // Update order status
    order.status = "cancelled";
    order.paymentStatus = "refunded";
    await order.save();

    // Restore product stock using bulk operation
    const stockRestores = order.items.map(item => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: item.quantity } }
      }
    }));
    await Product.bulkWrite(stockRestores);

    // Update customer stats
    await Customer.findByIdAndUpdate(order.customer, {
      $inc: { 
        totalOrders: -1,
        totalSpent: -order.totalAmount
      }
    });

    return res.json({ message: "Order cancelled successfully", data: order });
  } catch (err) {
    console.error("Cancel order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/orders/export ──────────────────────────────────────────────
// Export orders to CSV (must come before /:id route)
router.get("/export", protect, async (req, res) => {
  try {
    const filter = { customerEmail: req.user.email };
    
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

    const csv = await exportOrdersToCSV(filter);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send(csv);
  } catch (err) {
    console.error("Export orders error:", err);
    return res.status(500).json({ message: "Server error during export" });
  }
});

// ─── GET /api/orders/stats/summary ──────────────────────────────────────
// Get user order statistics
router.get("/stats/summary", protect, async (req, res) => {
  try {
    const stats = await Order.aggregate([
      { $match: { customerEmail: req.user.email } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] }
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
          },
        }
      }
    ]);

    const summary = stats[0] || {
      totalOrders: 0,
      totalSpent: 0,
      pendingOrders: 0,
      processingOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
    };

    return res.json({ data: summary });
  } catch (err) {
    console.error("Get order stats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
