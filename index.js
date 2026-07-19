import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";

// ─── Existing routes ──────────────────────────────────────────────────────────
import productRoutes from "./routes/products.js";
import authRoutes from "./routes/auth.js";
import wishlistRoutes from "./routes/wishlist.js";
import compareRoutes from "./routes/compare.js";
import orderRoutes from "./routes/orders.js";
import userRoutes from "./routes/user.js";
import uploadRoutes from "./routes/upload.js";

// ─── Admin routes ─────────────────────────────────────────────────────────────
import adminAuthRoutes from "./routes/admin/adminAuth.js";
import adminUserRoutes from "./routes/admin/users.js";
import adminProductRoutes from "./routes/admin/products.js";
import adminCategoryRoutes from "./routes/admin/categories.js";
import adminProductAttributeRoutes from "./routes/admin/productAttributes.js";
import adminCustomerRoutes from "./routes/admin/customers.js";
import adminPaymentRoutes from "./routes/admin/payments.js";
import adminInventoryRoutes from "./routes/admin/inventory.js";
import adminStatsRoutes from "./routes/admin/stats.js";

import { connectDB } from "./utils/db.js";

dotenv.config();
console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);

const app = express();
console.log("🚀 index.js started");

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const port = process.env.PORT || 5000;
app.use(express.json());
app.use(compression());

// Connect to MongoDB
connectDB();

// ─── Root API docs ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "TechMart Electro-style product API — now with Admin Dashboard",
    docs: {
      health: "/api/health",
      // Public
      products: "/api/products",
      product: "/api/products/:idOrSlug",
      featured: "/api/products/featured",
      categories: "/api/categories",
      brands: "/api/brands",
      homeV3: "/api/home-v3",
      // Auth
      auth: {
        signup: "POST /api/auth/signup",
        login: "POST /api/auth/login",
        logout: "POST /api/auth/logout (Protected)",
        me: "GET /api/auth/me (Protected)",
        forgotPassword: "POST /api/auth/forgot-password",
        resetPassword: "POST /api/auth/reset-password",
        changePassword: "PUT /api/auth/change-password (Protected)",
      },
      // User features
      wishlist: {
        get: "GET /api/wishlist (Protected)",
        add: "POST /api/wishlist (Protected)",
        remove: "DELETE /api/wishlist/:productId (Protected)",
      },
      compare: {
        get: "GET /api/compare (Protected)",
        add: "POST /api/compare (Protected)",
        remove: "DELETE /api/compare/:productId (Protected)",
      },
      orders: {
        track: "GET /api/orders/track/:orderNumber (Public)",
        list: "GET /api/orders (Protected)",
        get: "GET /api/orders/:id (Protected)",
        create: "POST /api/orders (Protected)",
        update: "PUT /api/orders/:id (Protected)",
        cancel: "PATCH /api/orders/:id/cancel (Protected)",
        stats: "GET /api/orders/stats/summary (Protected)",
      },
      upload: {
        single: "POST /api/upload/single (Admin)",
        multiple: "POST /api/upload/multiple (Admin)",
        delete: "DELETE /api/upload/:publicId (Admin)",
        deleteByUrl: "POST /api/upload/delete-by-url (Admin)",
      },
      user: {
        profile: "GET /api/user/profile (Protected)",
        updateProfile: "PUT /api/user/profile (Protected)",
        orders: "GET /api/user/orders (Protected)",
        addresses: "GET /api/user/addresses (Protected)",
        billingAddress: "PUT /api/user/billing-address (Protected)",
        shippingAddress: "PUT /api/user/shipping-address (Protected)",
        downloads: {
          list: "GET /api/user/downloads (Protected)",
          add: "POST /api/user/downloads (Protected)",
          get: "GET /api/user/downloads/:id (Protected)",
        },
        paymentMethods: {
          list: "GET /api/user/payment-methods (Protected)",
          add: "POST /api/user/payment-methods (Protected)",
          update: "PUT /api/user/payment-methods/:id (Protected)",
          delete: "DELETE /api/user/payment-methods/:id (Protected)",
          setDefault: "PATCH /api/user/payment-methods/:id/default (Protected)",
        },
        recentlyViewed: {
          get: "GET /api/user/recently-viewed (Protected)",
          add: "POST /api/user/recently-viewed (Protected)",
          remove: "DELETE /api/user/recently-viewed/:productId (Protected)",
        },
      },
      // Admin Dashboard
      admin: {
        auth: {
          login: "POST /api/admin/auth/login",
          me: "GET /api/admin/auth/me (Admin)",
          profile: "PUT /api/admin/auth/profile (Admin)",
          makeAdmin: "POST /api/admin/auth/make-admin (Admin)",
          revokeAdmin: "POST /api/admin/auth/revoke-admin (Admin)",
        },
        stats: "GET /api/admin/stats (Admin)",
        users: {
          list: "GET /api/admin/users (Admin)",
          get: "GET /api/admin/users/:id (Admin)",
          create: "POST /api/admin/users (Admin)",
          update: "PUT /api/admin/users/:id (Admin)",
          delete: "DELETE /api/admin/users/:id (Admin)",
          status: "PUT /api/admin/users/:id/status (Admin)",
        },
        products: {
          list: "GET /api/admin/products (Admin)",
          get: "GET /api/admin/products/:id (Admin)",
          create: "POST /api/admin/products (Admin)",
          update: "PUT /api/admin/products/:id (Admin)",
          delete: "DELETE /api/admin/products/:id (Admin)",
          stock: "PATCH /api/admin/products/:id/stock (Admin)",
          toggle: "PATCH /api/admin/products/:id/toggle (Admin)",
        },
        categories: {
          list: "GET /api/admin/categories (Admin)",
          tree: "GET /api/admin/categories/tree (Admin)",
          get: "GET /api/admin/categories/:id (Admin)",
          create: "POST /api/admin/categories (Admin)",
          update: "PUT /api/admin/categories/:id (Admin)",
          delete: "DELETE /api/admin/categories/:id (Admin)",
          toggle: "PATCH /api/admin/categories/:id/toggle (Admin)",
          reorder: "PATCH /api/admin/categories/reorder (Admin)",
          addAttribute: "POST /api/admin/categories/:id/attributes (Admin)",
          removeAttribute: "DELETE /api/admin/categories/:id/attributes/:attributeName (Admin)",
        },
        productAttributes: {
          list: "GET /api/admin/product-attributes/:productId (Admin)",
          create: "POST /api/admin/product-attributes (Admin)",
          update: "PUT /api/admin/product-attributes/:id (Admin)",
          delete: "DELETE /api/admin/product-attributes/:id (Admin)",
          bulk: "POST /api/admin/product-attributes/bulk (Admin)",
          schema: "GET /api/admin/product-attributes/schema/:categoryId (Admin)",
        },
        customers: {
          list: "GET /api/admin/customers (Admin)",
          get: "GET /api/admin/customers/:id (Admin)",
          create: "POST /api/admin/customers (Admin)",
          update: "PUT /api/admin/customers/:id (Admin)",
          delete: "DELETE /api/admin/customers/:id (Admin)",
          orders: "GET /api/admin/customers/:id/orders (Admin)",
          status: "PUT /api/admin/customers/:id/status (Admin)",
        },
        payments: {
          track: "GET /api/admin/payments/track/:orderNumber (Admin)",
          list: "GET /api/admin/payments (Admin)",
          stats: "GET /api/admin/payments/stats (Admin)",
          get: "GET /api/admin/payments/:id (Admin)",
          create: "POST /api/admin/payments (Admin)",
          update: "PUT /api/admin/payments/:id (Admin)",
          delete: "DELETE /api/admin/payments/:id (Admin)",
          status: "PATCH /api/admin/payments/:id/status (Admin)",
        },
        inventory: {
          list: "GET /api/admin/inventory (Admin)",
          lowStock: "GET /api/admin/inventory/low-stock (Admin)",
          get: "GET /api/admin/inventory/:id (Admin)",
          create: "POST /api/admin/inventory (Admin)",
          update: "PUT /api/admin/inventory/:id (Admin)",
          delete: "DELETE /api/admin/inventory/:id (Admin)",
        },
      },
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "techmart-backend" });
});

// ─── Existing routes ──────────────────────────────────────────────────────────
app.use("/api", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", wishlistRoutes);
app.use("/api", compareRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/user", userRoutes);
app.use("/api/upload", uploadRoutes);

// ─── Admin routes ─────────────────────────────────────────────────────────────
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin/categories", adminCategoryRoutes);
app.use("/api/admin/product-attributes", adminProductAttributeRoutes);
app.use("/api/admin/customers", adminCustomerRoutes);
app.use("/api/admin/payments", adminPaymentRoutes);
app.use("/api/admin/inventory", adminInventoryRoutes);
app.use("/api/admin/stats", adminStatsRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
