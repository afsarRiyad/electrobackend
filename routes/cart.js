import { Router } from "express";
import mongoose from "mongoose";
import { Cart, Product, ProductVariant } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";

const router = Router();

const isPositiveInteger = (value) =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;

const populateCart = (query) =>
  query
    .populate("items.product", "name image price stock slug")
    .populate("items.variant", "name sku price stock");

const formatCart = (cart) => {
  const items = cart?.items ?? [];
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => {
    const price = item.variant?.price ?? item.product?.price ?? 0;
    return sum + price * item.quantity;
  }, 0);

  return {
    ...cart,
    items,
    totalItems,
    totalAmount,
  };
};

const getCartData = async (cartId) => {
  const cart = await populateCart(Cart.findById(cartId)).lean();
  return formatCart(cart);
};

// Carts created before item IDs were enabled need a one-time migration so their
// items can be addressed by PUT/DELETE /api/cart/:itemId.
const ensureCartItemIds = async (cart) => {
  const storedCart = await Cart.findById(cart._id).select("items").lean();
  const missingItemIndexes = storedCart?.items
    .map((item, index) => (item._id ? -1 : index))
    .filter((index) => index >= 0) ?? [];

  if (missingItemIndexes.length === 0) return cart;

  for (const index of missingItemIndexes) {
    cart.items[index]._id = new mongoose.Types.ObjectId();
  }
  cart.markModified("items");
  await cart.save();
  return cart;
};

const validateItemId = (itemId, res) => {
  if (mongoose.isObjectIdOrHexString(itemId)) return true;
  res.status(400).json({ message: "A valid cart item ID is required" });
  return false;
};

// Prefer the cart item ID. The product-ID fallback keeps carts created before
// embedded item IDs were enabled removable (one matching product at a time).
const findCartItem = (items, identifier) => {
  const itemIndex = items.findIndex(
    (item) => item._id?.toString() === identifier
  );
  if (itemIndex >= 0) return { item: items[itemIndex], itemIndex };

  const productIndex = items.findIndex(
    (item) => item.product?.toString() === identifier
  );
  if (productIndex >= 0) return { item: items[productIndex], itemIndex: productIndex };

  return { item: null, itemIndex: -1 };
};

const getVariant = async (variantId, productId) => {
  if (!variantId) return null;

  if (!mongoose.isObjectIdOrHexString(variantId)) {
    return "invalid";
  }

  return ProductVariant.findOne({
    _id: variantId,
    product: productId,
    isActive: true,
  });
};

// GET /api/cart
router.get("/", protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.json({ data: formatCart({ items: [] }) });
    }

    cart = await ensureCartItemIds(cart);
    return res.json({ data: await getCartData(cart._id) });
  } catch (err) {
    console.error("Get cart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/cart
router.post("/", protect, async (req, res) => {
  try {
    const { product, quantity = 1, variant } = req.body;

    if (!mongoose.isObjectIdOrHexString(product)) {
      return res.status(400).json({ message: "A valid product ID is required" });
    }
    if (!isPositiveInteger(quantity)) {
      return res.status(400).json({ message: "Quantity must be a positive integer" });
    }

    const productDoc = await Product.findById(product);
    if (!productDoc) {
      return res.status(404).json({ message: "Product not found" });
    }

    const variantDoc = await getVariant(variant, product);
    if (variantDoc === "invalid") {
      return res.status(400).json({ message: "A valid variant ID is required" });
    }
    if (variant && !variantDoc) {
      return res.status(404).json({ message: "Active variant not found for this product" });
    }

    const stockSource = variantDoc ?? productDoc;
    if (stockSource.stock < quantity) {
      return res.status(400).json({
        message: `Out of stock. Available: ${stockSource.stock}, Requested: ${quantity}`,
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    } else {
      cart = await ensureCartItemIds(cart);
    }

    const variantId = variantDoc?._id?.toString() ?? null;
    const existingItem = cart.items.find(
      (item) =>
        item.product.toString() === product &&
        (item.variant?.toString() ?? null) === variantId
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (stockSource.stock < newQuantity) {
        return res.status(400).json({
          message: `Out of stock. Available: ${stockSource.stock}, Requested: ${newQuantity}`,
        });
      }
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ product, quantity, variant: variantDoc?._id ?? null });
    }

    await cart.save();
    return res.json({
      message: "Item added to cart",
      data: await getCartData(cart._id),
    });
  } catch (err) {
    console.error("Add to cart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/cart/:itemId
router.put("/:itemId", protect, async (req, res) => {
  try {
    if (!validateItemId(req.params.itemId, res)) return;

    const { quantity } = req.body;
    if (!isPositiveInteger(quantity)) {
      return res.status(400).json({ message: "Quantity must be a positive integer" });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart = await ensureCartItemIds(cart);

    const { item } = findCartItem(cart.items, req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    const product = await Product.findById(item.product);
    if (!product) {
      return res.status(404).json({ message: "Product no longer exists" });
    }

    const variant = await getVariant(item.variant, item.product);
    if (variant === "invalid" || (item.variant && !variant)) {
      return res.status(409).json({ message: "Cart item variant is no longer available" });
    }

    const stockSource = variant ?? product;
    if (stockSource.stock < quantity) {
      return res.status(400).json({
        message: `Insufficient stock. Available: ${stockSource.stock}, Requested: ${quantity}`,
      });
    }

    item.quantity = quantity;
    await cart.save();
    return res.json({
      message: "Cart item updated",
      data: await getCartData(cart._id),
    });
  } catch (err) {
    console.error("Update cart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/cart/:itemId
router.delete("/:itemId", protect, async (req, res) => {
  try {
    if (!validateItemId(req.params.itemId, res)) return;

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart = await ensureCartItemIds(cart);

    const { item, itemIndex } = findCartItem(cart.items, req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();
    return res.json({
      message: "Item removed from cart",
      data: await getCartData(cart._id),
    });
  } catch (err) {
    console.error("Remove cart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/cart
router.delete("/", protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = [];
    await cart.save();
    return res.json({ message: "Cart cleared", data: formatCart({ items: [] }) });
  } catch (err) {
    console.error("Clear cart error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
