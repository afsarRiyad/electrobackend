import express from "express";
import productRoutes from "./routes/products.js";
import authRoutes from "./routes/auth.js";
import wishlistRoutes from "./routes/wishlist.js";
import compareRoutes from "./routes/compare.js";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./utils/db.js";

dotenv.config();
const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  })
);

const port = process.env.PORT || 5000;

app.use(express.json());

// Connect to MongoDB
connectDB();

app.get("/", (req, res) => {
  res.json({
    message: "TechMart Electro-style product API with Userhandle Login, Wishlist, and Compare",
    docs: {
      health: "/api/health",
      products: "/api/products",
      product: "/api/products/:idOrSlug",
      featured: "/api/products/featured",
      categories: "/api/categories",
      brands: "/api/brands",
      homeV3: "/api/home-v3",
      auth: {
        signup: "POST /api/auth/signup",
        login: "POST /api/auth/login",
        me: "GET /api/auth/me (Protected)"
      },
      wishlist: {
        get: "GET /api/wishlist (Protected)",
        add: "POST /api/wishlist (Protected)",
        remove: "DELETE /api/wishlist/:productId (Protected)"
      },
      compare: {
        get: "GET /api/compare (Protected)",
        add: "POST /api/compare (Protected)",
        remove: "DELETE /api/compare/:productId (Protected)"
      }
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "techmart-backend",
  });
});

// Routes
app.use("/api", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", wishlistRoutes);
app.use("/api", compareRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
