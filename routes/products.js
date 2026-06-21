import { Router } from "express";
import { products } from "../data/products.js";
import {
  findProduct,
  getBrands,
  getCategories,
  getHomeV3Payload,
  queryProducts,
} from "../utils/productQueries.js";

const router = Router();

router.get("/products", (req, res) => {
  res.json(queryProducts(req.query));
});

router.get("/products/featured", (req, res) => {
  res.json({
    data: products.filter((product) => product.tags.includes("featured")),
  });
});

router.get("/products/:idOrSlug", (req, res) => {
  const product = findProduct(req.params.idOrSlug);

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  return res.json({ data: product });
});

router.get("/categories", (req, res) => {
  res.json({ data: getCategories() });
});

router.get("/brands", (req, res) => {
  res.json({ data: getBrands() });
});

router.get("/home-v3", (req, res) => {
  res.json({ data: getHomeV3Payload() });
});

export default router;
