import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// ─── Existing routes ──────────────────────────────────────────────────────────
import productRoutes from "./routes/products.js";
import authRoutes from "./routes/auth.js";
import wishlistRoutes from "./routes/wishlist.js";
import compareRoutes from "./routes/compare.js";

// ─── Admin routes ─────────────────────────────────────────────────────────────
import adminAuthRoutes from "./routes/admin/adminAuth.js";
import adminUserRoutes from "./routes/admin/users.js";
import adminProductRoutes from "./routes/admin/products.js";
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

// ─── Admin routes ─────────────────────────────────────────────────────────────
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/products", adminProductRoutes);
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
