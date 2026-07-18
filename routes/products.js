import { Router } from "express";
import { Product } from "../utils/models.js";
import {
  findProduct,
  getBrands,
  getCategories,
  getHomeV3Payload,
  queryProducts,
} from "../utils/productQueries.js";

const router = Router();

router.get("/products", async (req, res) => {
  res.json(await queryProducts(req.query));
});

router.get("/products/featured", async (req, res) => {
  try {
    const featuredProducts = await Product.find({ tags: "featured" })
      .limit(20)
      .lean();
    res.json({ data: featuredProducts });
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/products/:idOrSlug", async (req, res) => {
  const product = await findProduct(req.params.idOrSlug);

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  return res.json({ data: product });
});

router.get("/categories", async (req, res) => {
  res.json({ data: await getCategories() });
});

router.get("/brands", async (req, res) => {
  res.json({ data: await getBrands() });
});

router.get("/home-v3", async (req, res) => {
  res.json({ data: await getHomeV3Payload() });
});

export default router;
