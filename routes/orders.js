import { Router } from "express";
import { Coupon, CouponRedemption, Order, Product, Customer } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";
import { requireVerification } from "../utils/verificationMiddleware.js";
import { exportOrdersToCSV } from "../utils/export.js";
import { activityMiddleware } from "../utils/activityLog.js";
import { 
  ValidationError, 
  NotFoundError, 
  ForbiddenError, 
  OrderError, 
  StockError, 
  CouponError,
  asyncHandler 
} from "../utils/errorHandler.js";

const router = Router();

// ─── GET /api/orders/track/:orderNumber ─────────────────────────────────────
// Public order tracking by order number
router.get("/track/:orderNumber", asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;

  if (!orderNumber) {
    throw new ValidationError("Order number is required");
  }

  const order = await Order.findOne({ orderNumber })
    .populate("items.product", "name image")
    .lean();

  if (!order) {
    throw new NotFoundError("Order not found");
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
}));

// ─── GET /api/orders ──────────────────────────────────────────────────
// Get current user's orders
router.get("/", protect, requireVerification, asyncHandler(async (req, res) => {
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
}));

// ─── GET /api/orders/:id ──────────────────────────────────────────────
// Get specific order details
router.get("/:id", protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("items.product", "name image sku price")
    .lean();

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  // Verify order belongs to current user
  if (order.customerEmail !== req.user.email) {
    throw new ForbiddenError("Access denied");
  }

  return res.json({ data: order });
}));

// ─── POST /api/orders ─────────────────────────────────────────────────
// Create new order
router.post("/", protect, requireVerification, activityMiddleware('create', 'order'), asyncHandler(async (req, res) => {
  let couponReservation = null;
  let couponRedemption = null;
  let orderCreated = false;

  try {
    const {
      items = [],
      shippingAddress,
      paymentMethod = "cash_on_delivery",
      notes,
      couponCode,
    } = req.body;

    // Parse shippingAddress if it's a string
    let parsedShippingAddress = shippingAddress;
    if (typeof shippingAddress === 'string') {
      try {
        parsedShippingAddress = JSON.parse(shippingAddress);
      } catch (e) {
        console.error('Failed to parse shippingAddress string:', e);
      }
    }

    console.log('Order creation request:', { 
      items, 
      shippingAddress: parsedShippingAddress, 
      paymentMethod, 
      notes, 
      couponCode,
      fullShippingAddress: JSON.stringify(parsedShippingAddress, null, 2)
    });

    if (!items || items.length === 0) {
      throw new ValidationError("Order items are required");
    }

    if (!parsedShippingAddress) {
      throw new ValidationError("Shipping address is required");
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
      throw new ValidationError("Invalid payment method");
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
        throw new NotFoundError(`Product not found: ${item.product}`);
      }

      if (product.stock < item.quantity) {
        throw new StockError(
          `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
          { name: product.name, available: product.stock, requested: item.quantity }
        );
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

    // A coupon is redeemed only while an order is being created, never when a
    // customer merely previews it in the cart.
    let discount = 0;
    let appliedCoupon = null;
    if (couponCode && couponCode !== 'undefined' && couponCode.trim() !== '') {
      console.log('Processing coupon code:', couponCode);
      const now = new Date();
      const normalizedCode = String(couponCode).trim().toUpperCase();
      console.log('Normalized coupon code:', normalizedCode);
      
      const coupon = await Coupon.findOne({
        code: normalizedCode,
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
      });

      console.log('Found coupon:', coupon);

      if (!coupon) {
        console.log('Coupon not found or invalid');
        throw new CouponError("Coupon is invalid, inactive, or expired");
      }
      if (subtotal < coupon.minimumOrderAmount) {
        console.log('Order amount too low. Subtotal:', subtotal, 'Required:', coupon.minimumOrderAmount);
        throw new CouponError(`Minimum order amount of $${coupon.minimumOrderAmount} required`);
      }

      const reservedCoupon = await Coupon.findOneAndUpdate(
        {
          _id: coupon._id,
          isActive: true,
          validFrom: { $lte: now },
          validUntil: { $gte: now },
          $expr: {
            $or: [
              { $eq: ["$usageLimit", null] },
              { $lt: ["$usageCount", "$usageLimit"] },
            ],
          },
        },
        { $inc: { usageCount: 1 } },
        { new: true }
      );

      console.log('Reserved coupon:', reservedCoupon);

      if (!reservedCoupon) {
        console.log('Coupon reservation failed - usage limit exceeded');
        throw new CouponError("Coupon usage limit exceeded");
      }
      couponReservation = reservedCoupon;

      try {
        couponRedemption = await CouponRedemption.create({
          coupon: reservedCoupon._id,
          user: req.user._id,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      } catch (error) {
        await Coupon.updateOne({ _id: reservedCoupon._id, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
        couponReservation = null;

        if (error?.code === 11000) {
          const duplicateFields = Object.keys(error.keyPattern || {});
          throw new CouponError(
            duplicateFields.includes("ipAddress")
              ? "This coupon has already been redeemed from this IP address"
              : "You have already redeemed this coupon"
          );
        }
        throw error;
      }

      discount = reservedCoupon.discountType === "percentage"
        ? (subtotal * reservedCoupon.discountValue) / 100
        : reservedCoupon.discountValue;
      if (reservedCoupon.maximumDiscountAmount && discount > reservedCoupon.maximumDiscountAmount) {
        discount = reservedCoupon.maximumDiscountAmount;
      }
      discount = Math.min(discount, subtotal);
      appliedCoupon = reservedCoupon;
    }

    // Calculate totals
    const tax = subtotal * 0.15; // 15% tax
    // Shipping cost: free inside Dhaka, 50 outside Dhaka
    const city = parsedShippingAddress.townCity || parsedShippingAddress.city || "";
    const state = parsedShippingAddress.state || "";
    const isInsideDhaka = city.toLowerCase().includes("dhaka") || state.toLowerCase().includes("dhaka");
    const shippingCost = isInsideDhaka ? 0 : 50;
    const totalAmount = subtotal - discount + tax + shippingCost;

    // Create or find customer using upsert
    const customer = await Customer.findOneAndUpdate(
      { email: req.user.email },
      {
        name: req.user.username,
        email: req.user.email,
        phone: req.user.phone || null,
        address: parsedShippingAddress,
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
      couponCode: appliedCoupon?.code || null,
      coupon: appliedCoupon?._id || null,
      tax,
      shippingCost,
      totalAmount,
      status: "pending",
      paymentMethod,
      paymentStatus: paymentMethod === "cash_on_delivery" ? "unpaid" : "paid",
      transactionId: paymentMethod !== "cash_on_delivery" ? `TXN-${Date.now()}` : null,
      shippingAddress: parsedShippingAddress,
      notes,
    });
    orderCreated = true;

    if (couponRedemption) {
      couponRedemption.order = order._id;
      await couponRedemption.save();
    }

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
    // If order creation failed after reserving a coupon, return that use to the
    // customer. Once an order exists, its coupon remains tied to the order.
    if (couponReservation && !orderCreated) {
      await CouponRedemption.deleteOne({ _id: couponRedemption?._id }).catch(() => {});
      await Coupon.updateOne(
        { _id: couponReservation._id, usageCount: { $gt: 0 } },
        { $inc: { usageCount: -1 } }
      ).catch(() => {});
    }
    // Re-throw for the global error handler to catch
    throw err;
  }
}));

// ─── PUT /api/orders/:id ──────────────────────────────────────────────
// Update order (limited fields for users)
router.put("/:id", protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  // Verify order belongs to current user
  if (order.customerEmail !== req.user.email) {
    throw new ForbiddenError("Access denied");
  }

  // Only allow updating shipping address and notes for pending orders
  if (order.status !== "pending") {
    throw new OrderError("Can only update pending orders");
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
}));

// ─── PATCH /api/orders/:id/cancel ──────────────────────────────────────
// Cancel order
router.patch("/:id/cancel", protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  // Verify order belongs to current user
  if (order.customerEmail !== req.user.email) {
    throw new ForbiddenError("Access denied");
  }

  // Can only cancel pending or processing orders
  if (!["pending", "processing"].includes(order.status)) {
    throw new OrderError(`Cannot cancel order with status: ${order.status}`);
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
}));

// ─── GET /api/orders/export ──────────────────────────────────────────────
// Export orders to CSV (must come before /:id route)
router.get("/export", protect, asyncHandler(async (req, res) => {
  const filter = { customerEmail: req.user.email };
  
  if (req.query.status) filter.status = req.query.status;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

  const csv = await exportOrdersToCSV(filter);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
  res.send(csv);
}));

// ─── GET /api/orders/stats/summary ──────────────────────────────────────
// Get user order statistics
router.get("/stats/summary", protect, asyncHandler(async (req, res) => {
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
}));

export default router;
