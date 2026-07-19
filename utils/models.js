import mongoose from "mongoose";

// ─── USER ────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    avatar: { type: String, default: null },
    phone: { type: String, default: null },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
      country: { type: String },
    },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpire: { type: Date, default: null },
    recentlyViewed: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

// User indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });

// ─── PRODUCT ─────────────────────────────────────────────────────────────────
const productSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    sku: { type: String, default: null },
    brand: { type: String, default: null },
    categories: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    price: { type: Number, required: true },
    regularPrice: { type: Number, default: null },
    salePrice: { type: Number, default: null },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    image: { type: String, default: null },
    productUrl: { type: String, default: null },
    description: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for fast queries
productSchema.index({ name: "text", brand: "text", sku: "text" });
productSchema.index({ categories: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ brand: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ createdAt: -1 });
// Compound indexes for common query patterns
productSchema.index({ isActive: 1, stock: 1 });
productSchema.index({ categories: 1, isActive: 1 });
productSchema.index({ brand: 1, isActive: 1 });

// ─── WISHLIST ─────────────────────────────────────────────────────────────────
const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  },
  { timestamps: true }
);
wishlistSchema.index({ user: 1, product: 1 }, { unique: true });

// ─── COMPARE ──────────────────────────────────────────────────────────────────
const compareSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  },
  { timestamps: true }
);
compareSchema.index({ user: 1, product: 1 }, { unique: true });

// ─── CUSTOMER ─────────────────────────────────────────────────────────────────
const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, default: null },
    avatar: { type: String, default: null },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
      country: { type: String, default: "Bangladesh" },
    },
    status: { type: String, enum: ["active", "inactive", "blocked"], default: "active" },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

customerSchema.index({ name: "text", email: "text", phone: "text" });
customerSchema.index({ status: 1 });

// ─── ORDER (PAYMENT) ──────────────────────────────────────────────────────────
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, required: true },
    productSku: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["credit_card", "debit_card", "paypal", "bkash", "nagad", "bank_transfer", "cash_on_delivery"],
      default: "cash_on_delivery",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded", "failed"],
      default: "unpaid",
    },
    transactionId: { type: String, default: null },
    shippingAddress: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
      country: { type: String },
    },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

// Auto-generate order number before saving using atomic counter
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const Counter = mongoose.model("Counter");
    const counter = await Counter.findOneAndUpdate(
      { name: "orderNumber" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.orderNumber = `ORD-${String(counter.seq).padStart(6, "0")}`;
  }
  next();
});

orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ customerEmail: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
// Compound indexes for common query patterns
orderSchema.index({ customerEmail: 1, status: 1 });
orderSchema.index({ customerEmail: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentStatus: 1 });
orderSchema.index({ paymentMethod: 1, paymentStatus: 1 });

// ─── INVENTORY ────────────────────────────────────────────────────────────────
const inventoryHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["restock", "adjustment", "sale", "return", "damage", "initial"],
      required: true,
    },
    quantityChange: { type: Number, required: true }, // positive = added, negative = removed
    quantityAfter: { type: Number, required: true },
    note: { type: String, default: null },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const inventorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, unique: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    reserved: { type: Number, default: 0 }, // reserved for pending orders
    lowStockThreshold: { type: Number, default: 10 },
    location: { type: String, default: "Main Warehouse" },
    history: { type: [inventoryHistorySchema], default: [] },
  },
  { timestamps: true }
);

inventorySchema.index({ quantity: 1 });
inventorySchema.index({ product: 1 });

// ─── COUNTER ─────────────────────────────────────────────────────────────────
const counterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);
counterSchema.index({ name: 1 });

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // create, update, delete, login, logout, etc.
    entity: { type: String, required: true }, // product, order, customer, user, etc.
    entityId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ entity: 1, entityId: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });

export const User = mongoose.model("User", userSchema);
export const Product = mongoose.model("Product", productSchema);
export const Wishlist = mongoose.model("Wishlist", wishlistSchema);
export const Compare = mongoose.model("Compare", compareSchema);
export const Customer = mongoose.model("Customer", customerSchema);
export const Order = mongoose.model("Order", orderSchema);
export const Inventory = mongoose.model("Inventory", inventorySchema);
export const Counter = mongoose.model("Counter", counterSchema);
export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
