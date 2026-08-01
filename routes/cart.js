import { Router } from "express";
import { Cart, Product } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";

const router = Router();

// ─── GET /api/cart ─────────────────────────────────────────────────────
// Get current user's cart
router.get("/", protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate("items.product", "name image price stock slug")
      .populate("items.variant", "name sku price stock")
      .lean();

    if (!cart) {
      cart = { items: [], totalItems: 0, totalAmount: 0 };
      return res.json({ data: cart });
    }

    // Calculate totals
    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cart.items.reduce((sum, item) => {
      const price = item.variant ? item.variant.price : item.product.price;
      return sum + (price * item.quantity);
    }, 0);

    return res.json({
      data: {
        ...cart,
        totalItems,
        totalAmount,
      },
    });
  } catch (err) {
    console.error("Get cart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/cart ────────────────────────────────────────────────────
// Add item to cart with flexible quantity
router.post("/", protect, async (req, res) => {
  try {
    const { product, quantity = 1, variant } = req.body;

    if (!product) {
      return res.status(400).json({ message: "Product is required" });
    }

    if (quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    // Verify product exists and has stock
    const productDoc = await Product.findById(product);
    if (!productDoc) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (productDoc.stock < quantity) {
      return res.status(400).json({
        message: `Out of stock. Available: ${productDoc.stock}, Requested: ${quantity}`
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === product && 
      (!variant || item.variant?.toString() === variant)
    );

    if (existingItemIndex > -1) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (productDoc.stock < newQuantity) {
        return res.status(400).json({
          message: `Out of stock. Available: ${productDoc.stock}, Requested: ${newQuantity}`
        });
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      cart.items.push({ product, quantity, variant });
    }

    await cart.save();

    // Return updated cart
    const updatedCart = await Cart.findById(cart._id)
      .populate("items.product", "name image price stock slug")
      .populate("items.variant", "name sku price stock")
      .lean();

    const totalItems = updatedCart.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = updatedCart.items.reduce((sum, item) => {
      const price = item.variant ? item.variant.price : item.product.price;
      return sum + (price * item.quantity);
    }, 0);

    return res.json({
      message: "Item added to cart",
      data: {
        ...updatedCart,
        totalItems,
        totalAmount,
      },
    });
  } catch (err) {
    console.error("Add to cart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/cart/:itemId ──────────────────────────────────────────────
// Update cart item quantity
router.put("/:itemId", protect, async (req, res) => {
  try {
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Verify stock
    const product = await Product.findById(item.product);
    if (product && product.stock < quantity) {
      return res.status(400).json({
        message: `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`
      });
    }

    item.quantity = quantity;
    await cart.save();

    // Return updated cart
    const updatedCart = await Cart.findById(cart._id)
      .populate("items.product", "name image price stock slug")
      .populate("items.variant", "name sku price stock")
      .lean();

    const totalItems = updatedCart.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = updatedCart.items.reduce((sum, item) => {
      const price = item.variant ? item.variant.price : item.product.price;
      return sum + (price * item.quantity);
    }, 0);

    return res.json({
      message: "Cart item updated",
      data: {
        ...updatedCart,
        totalItems,
        totalAmount,
      },
    });
  } catch (err) {
    console.error("Update cart item error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/cart/:itemId ────────────────────────────────────────────
// Remove item from cart
router.delete("/:itemId", protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    item.remove();
    await cart.save();

    // Return updated cart
    const updatedCart = await Cart.findById(cart._id)
      .populate("items.product", "name image price stock slug")
      .populate("items.variant", "name sku price stock")
      .lean();

    const totalItems = updatedCart.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = updatedCart.items.reduce((sum, item) => {
      const price = item.variant ? item.variant.price : item.product.price;
      return sum + (price * item.quantity);
    }, 0);

    return res.json({
      message: "Item removed from cart",
      data: {
        ...updatedCart,
        totalItems,
        totalAmount,
      },
    });
  } catch (err) {
    console.error("Remove cart item error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/cart ────────────────────────────────────────────────────
// Clear entire cart
router.delete("/", protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = [];
    await cart.save();

    return res.json({ message: "Cart cleared", data: { items: [], totalItems: 0, totalAmount: 0 } });
  } catch (err) {
    console.error("Clear cart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
