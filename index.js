import express from "express";
import productRoutes from "./routes/products.js";
import cors from "cors";
import dotenv from "dotenv";

const app = express();
dotenv.config();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  })
);

const port = process.env.PORT || 5000;

app.use(express.json());


app.get("/", (req, res) => {
  res.json({
    message: "TechMart Electro-style product API",
    docs: {
      health: "/api/health",
      products: "/api/products",
      product: "/api/products/:idOrSlug",
      featured: "/api/products/featured",
      categories: "/api/categories",
      brands: "/api/brands",
      homeV3: "/api/home-v3",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "techmart-backend",
  });
});

app.use("/api", productRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
