import { Router } from "express";
import { Wishlist, Product } from "../utils/models.js";
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

// @desc    Get wishlist (user or guest session)
// @route   GET /api/wishlist
// @access  Private or guest
router.get("/wishlist", protectOptional, async (req, res) => {
  try {
    const owner = requireOwner(req, res);
    if (!owner) return;

    const wishlistItems = await Wishlist.find(owner)
      .populate("product")
      .sort({ createdAt: -1 });

    // Format to return just the products array
    const products = wishlistItems.map(item => item.product).filter(Boolean);

    return res.json({ data: products });
  } catch (error) {
    console.error("Get wishlist error:", error);
    return res.status(500).json({ message: "Server error retrieving wishlist" });
  }
});

// @desc    Add product to wishlist (user or guest session)
// @route   POST /api/wishlist
// @access  Private or guest
router.post("/wishlist", protectOptional, async (req, res) => {
  try {
    const owner = requireOwner(req, res);
    if (!owner) return;

    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Find the product (supports both mongoose ObjectId and numeric product id)
    let product;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    }
    
    if (!product) {
      // Fallback: search by custom numeric product ID
      const numericId = Number(productId);
      if (!isNaN(numericId)) {
        product = await Product.findOne({ id: numericId });
      }
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if already in wishlist
    const exists = await Wishlist.findOne({
      ...owner,
      product: product._id,
    });

    if (exists) {
      return res.status(400).json({ message: "Product already in wishlist" });
    }

    // Add to wishlist
    await Wishlist.create({
      ...owner,
      product: product._id,
    });

    return res.status(201).json({ message: "Product added to wishlist", data: product });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    return res.status(500).json({ message: "Server error adding to wishlist" });
  }
});

// @desc    Remove product from wishlist (user or guest session)
// @route   DELETE /api/wishlist/:productId
// @access  Private or guest
router.delete("/wishlist/:productId", protectOptional, async (req, res) => {
  try {
    const owner = requireOwner(req, res);
    if (!owner) return;

    const { productId } = req.params;

    // Find the product first to get its mongo _id
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

    const result = await Wishlist.findOneAndDelete({
      ...owner,
      product: product._id,
    });

    if (!result) {
      return res.status(404).json({ message: "Product was not in wishlist" });
    }

    return res.json({ message: "Product removed from wishlist" });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    return res.status(500).json({ message: "Server error removing from wishlist" });
  }
});

export default router;