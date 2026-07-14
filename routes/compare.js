import { Router } from "express";
import { Compare, Product } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";
import mongoose from "mongoose";

const router = Router();

// @desc    Get user's compare list
// @route   GET /api/compare
// @access  Private
router.get("/compare", protect, async (req, res) => {
  try {
    const compareItems = await Compare.find({ user: req.user._id })
      .populate("product")
      .sort({ createdAt: -1 });

    const products = compareItems.map(item => item.product).filter(Boolean);

    return res.json({ data: products });
  } catch (error) {
    console.error("Get compare list error:", error);
    return res.status(500).json({ message: "Server error retrieving compare list" });
  }
});

// @desc    Add product to compare list
// @route   POST /api/compare
// @access  Private
router.post("/compare", protect, async (req, res) => {
  try {
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
      user: req.user._id,
      product: product._id,
    });

    if (exists) {
      return res.status(400).json({ message: "Product already in compare list" });
    }

    // Add to compare list
    await Compare.create({
      user: req.user._id,
      product: product._id,
    });

    return res.status(201).json({ message: "Product added to compare list", data: product });
  } catch (error) {
    console.error("Add to compare list error:", error);
    return res.status(500).json({ message: "Server error adding to compare list" });
  }
});

// @desc    Remove product from compare list
// @route   DELETE /api/compare/:productId
// @access  Private
router.delete("/compare/:productId", protect, async (req, res) => {
  try {
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
      user: req.user._id,
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
