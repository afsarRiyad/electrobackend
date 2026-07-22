import mongoose from "mongoose";

// ─── USER ────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: false, unique: true, sparse: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    avatar: { type: String, default: null },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    companyName: { type: String, default: null },
    phone: { type: String, default: null },
    // OAuth providers
    oauthProviders: {
      google: {
        id: { type: String, default: null },
        email: { type: String, default: null },
      },
      apple: {
        id: { type: String, default: null },
        email: { type: String, default: null },
      },
    },
    billingAddress: {
      firstName: { type: String, default: null },
      lastName: { type: String, default: null },
      companyName: { type: String, default: null },
      country: { type: String, default: null },
      streetAddress: { type: String, default: null },
      apartment: { type: String, default: null },
      townCity: { type: String, default: null },
      state: { type: String, default: null },
      zipCode: { type: String, default: null },
      phone: { type: String, default: null },
    },
    shippingAddress: {
      firstName: { type: String, default: null },
      lastName: { type: String, default: null },
      companyName: { type: String, default: null },
      country: { type: String, default: null },
      streetAddress: { type: String, default: null },
      apartment: { type: String, default: null },
      townCity: { type: String, default: null },
      state: { type: String, default: null },
      zipCode: { type: String, default: null },
      phone: { type: String, default: null },
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
    // Category reference (using Category model)
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    // Custom attributes for flexible product data
    customAttributes: [{
      name: { type: String, required: true },
      value: { type: mongoose.Schema.Types.Mixed, required: true },
      type: { type: String, enum: ["text", "number", "select", "multiselect", "boolean", "color"], required: true },
    }],
    // SEO fields
    metaTitle: { type: String, default: null },
    metaDescription: { type: String, default: null },
    metaKeywords: [{ type: String }],
  },
  { timestamps: true }
);

// Indexes for fast queries
productSchema.index({ name: "text", brand: "text", sku: "text" });
productSchema.index({ categories: 1 });
productSchema.index({ category: 1 });
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
    statusHistory: [{
      status: { type: String, required: true },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      note: { type: String, default: null },
    }],
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

// Track status changes
orderSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    const statusHistoryEntry = {
      status: this.status,
      changedAt: new Date(),
      note: this.notes || null,
    };
    
    if (!this.statusHistory) {
      this.statusHistory = [];
    }
    
    this.statusHistory.push(statusHistoryEntry);
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

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
const downloadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    downloadUrl: { type: String, required: true },
    fileSize: { type: Number, default: null },
    downloadCount: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);
downloadSchema.index({ user: 1, createdAt: -1 });
downloadSchema.index({ product: 1 });
downloadSchema.index({ expiresAt: 1 });

// ─── PAYMENT METHOD ───────────────────────────────────────────────────────────
const paymentMethodSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["credit_card", "debit_card", "paypal", "bkash", "nagad", "bank_transfer"],
      required: true,
    },
    isDefault: { type: Boolean, default: false },
    // Card details (encrypted in production)
    cardNumber: { type: String, default: null }, // Last 4 digits only
    cardHolder: { type: String, default: null },
    expiryMonth: { type: String, default: null },
    expiryYear: { type: String, default: null },
    // Mobile wallet details
    mobileNumber: { type: String, default: null },
    // Bank transfer details
    bankName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    routingNumber: { type: String, default: null },
    // PayPal
    paypalEmail: { type: String, default: null },
  },
  { timestamps: true }
);
paymentMethodSchema.index({ user: 1, isDefault: -1 });
paymentMethodSchema.index({ type: 1 });

export const User = mongoose.model("User", userSchema);
export const Product = mongoose.model("Product", productSchema);
export const Wishlist = mongoose.model("Wishlist", wishlistSchema);
export const Compare = mongoose.model("Compare", compareSchema);
export const Customer = mongoose.model("Customer", customerSchema);
export const Order = mongoose.model("Order", orderSchema);
export const Inventory = mongoose.model("Inventory", inventorySchema);
export const Counter = mongoose.model("Counter", counterSchema);
export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
export const Download = mongoose.model("Download", downloadSchema);
export const PaymentMethod = mongoose.model("PaymentMethod", paymentMethodSchema);

// ─── CATEGORY ─────────────────────────────────────────────────────────────────
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: null },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    image: { type: String, default: null },
    icon: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    // Custom attributes for products in this category
    attributes: [{
      name: { type: String, required: true },
      type: { type: String, enum: ["text", "number", "select", "multiselect", "boolean", "color"], required: true },
      required: { type: Boolean, default: false },
      options: [{ type: String }], // For select/multiselect types
      defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
    }],
    // SEO fields
    metaTitle: { type: String, default: null },
    metaDescription: { type: String, default: null },
    metaKeywords: [{ type: String }],
  },
  { timestamps: true }
);
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ displayOrder: 1 });

// ─── PRODUCT ATTRIBUTE ─────────────────────────────────────────────────────────
const productAttributeSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    type: { type: String, enum: ["text", "number", "select", "multiselect", "boolean", "color"], required: true },
  },
  { timestamps: true }
);
productAttributeSchema.index({ product: 1 });
productAttributeSchema.index({ name: 1 });

// ─── PRODUCT VARIANT ───────────────────────────────────────────────────────────
const productVariantSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, unique: true, sparse: true },
    price: { type: Number, required: true },
    comparePrice: { type: Number, default: null },
    stock: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    attributes: [{
      name: { type: String, required: true },
      value: { type: String, required: true },
    }],
    image: { type: String, default: null },
    weight: { type: Number, default: null },
  },
  { timestamps: true }
);
productVariantSchema.index({ product: 1 });
productVariantSchema.index({ sku: 1 });
productVariantSchema.index({ isActive: 1 });

export const Category = mongoose.model("Category", categorySchema);
export const ProductAttribute = mongoose.model("ProductAttribute", productAttributeSchema);
export const ProductVariant = mongoose.model("ProductVariant", productVariantSchema);

// ─── MESSAGE (INBOX) ─────────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null if sent to all admins
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    category: { type: String, enum: ["general", "support", "order", "payment", "other"], default: "general" },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
  },
  { timestamps: true }
);

messageSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ priority: 1 });
messageSchema.index({ category: 1 });
messageSchema.index({ replyTo: 1 });

export const Message = mongoose.model("Message", messageSchema);
