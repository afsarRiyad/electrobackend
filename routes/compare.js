import { Router } from "express";
import { Compare, Product } from "../utils/models.js";
import { protectOptional, resolveOwner } from "../utils/authMiddleware.js";
import mongoose from "mongoose";

const router = Router();

const requireOwner = (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) {
    res.status(401).json({
      success: false,
      error: true,
      requireAuth: true,
      message: "Please log in or continue as guest",
    });
    return null;
  }
  return owner;
};

// @desc    Get compare list (user or guest session)
// @route   GET /api/compare
// @access  Private or guest
router.get("/compare", protectOptional, async (req, res) => {
  try {
    const owner = requireOwner(req, res);
    if (!owner) return;

    const compareItems = await Compare.find(owner)
      .populate("product")
      .sort({ createdAt: -1 });

    const products = compareItems.map(item => item.product).filter(Boolean);

    return res.json({ data: products });
  } catch (error) {
    console.error("Get compare list error:", error);
    return res.status(500).json({ message: "Server error retrieving compare list" });
  }
});

// @desc    Add product to compare list (user or guest session)
// @route   POST /api/compare
// @access  Private or guest
router.post("/compare", protectOptional, async (req, res) => {
  try {
    const owner = requireOwner(req, res);
    if (!owner) return;

    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    let product;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    }
    
    if (!product) {
      const numericId = Number(productId);
      if (!isNaN(numericId)) {
        product = await Product.findOne({ id: numericId });
      }
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if already in compare list
    const exists = await Compare.findOne({
      ...owner,
      product: product._id,
    });

    if (exists) {
      return res.status(400).json({ message: "Product already in compare list" });
    }

    // Add to compare list
    await Compare.create({
      ...owner,
      product: product._id,
    });

    return res.status(201).json({ message: "Product added to compare list", data: product });
  } catch (error) {
    console.error("Add to compare list error:", error);
    return res.status(500).json({ message: "Server error adding to compare list" });
  }
});

// @desc    Remove product from compare list (user or guest session)
// @route   DELETE /api/compare/:productId
// @access  Private or guest
router.delete("/compare/:productId", protectOptional, async (req, res) => {
  try {
    const owner = requireOwner(req, res);
    if (!owner) return;

    const { productId } = req.params;

    let product;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    }
    
    if (!product) {
      const numericId = Number(productId);
      if (!isNaN(numericId)) {
        product = await Product.findOne({ id: numericId });
      }
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const result = await Compare.findOneAndDelete({
      ...owner,
      product: product._id,
    });

    if (!result) {
      return res.status(404).json({ message: "Product was not in compare list" });
    }

    return res.json({ message: "Product removed from compare list" });
  } catch (error) {
    console.error("Remove from compare list error:", error);
    return res.status(500).json({ message: "Server error removing from compare list" });
  }
});

export default router;