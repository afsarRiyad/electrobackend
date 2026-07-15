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
  },
  { timestamps: true }
);

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

// Auto-generate order number before saving
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model("Order").countDocuments();
    this.orderNumber = `ORD-${String(count + 1).padStart(6, "0")}`;
  }
  next();
});

orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderNumber: 1 });

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

export const User = mongoose.model("User", userSchema);
export const Product = mongoose.model("Product", productSchema);
export const Wishlist = mongoose.model("Wishlist", wishlistSchema);
export const Compare = mongoose.model("Compare", compareSchema);
export const Customer = mongoose.model("Customer", customerSchema);
export const Order = mongoose.model("Order", orderSchema);
export const Inventory = mongoose.model("Inventory", inventorySchema);
