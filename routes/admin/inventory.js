import { Router } from "express";
import { Inventory, Product } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";

const router = Router();
const guard = [protect, isAdmin];

// ─── GET /api/admin/inventory/low-stock ───────────────────────────────────────
// Must be defined BEFORE /:id to avoid route conflict
router.get("/low-stock", ...guard, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Items where quantity <= lowStockThreshold
    const filter = { $expr: { $lte: ["$quantity", "$lowStockThreshold"] } };

    const [items, total] = await Promise.all([
      Inventory.find(filter)
        .populate("product", "name image sku brand price")
        .sort({ quantity: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Inventory.countDocuments(filter),
    ]);

    return res.json({
      data: items,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("Low stock error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/inventory ─────────────────────────────────────────────────
router.get("/", ...guard, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      location,
      lowStock,
      outOfStock,
      sortBy = "updatedAt",
      order = "desc",
    } = req.query;

    // Build aggregation to join with Product for search
    const matchStage = {};
    if (location) matchStage.location = { $regex: location, $options: "i" };
    if (outOfStock === "true") matchStage.quantity = 0;
    else if (lowStock === "true") matchStage.$expr = { $lte: ["$quantity", "$lowStockThreshold"] };

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    let query = Inventory.find(matchStage)
      .populate("product", "name image sku brand price categories")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(Number(limit));

    const [items, total] = await Promise.all([
      query.lean(),
      Inventory.countDocuments(matchStage),
    ]);

    // Filter by product name/sku after populate (only if search provided)
    const filtered = search
      ? items.filter(
          (i) =>
            i.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
            i.product?.sku?.toLowerCase().includes(search.toLowerCase())
        )
      : items;

    return res.json({
      data: filtered,
      pagination: {
        total: search ? filtered.length : total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil((search ? filtered.length : total) / Number(limit)),
      },
    });
  } catch (err) {
    console.error("List inventory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/inventory/:id ────────────────────────────────────────────
router.get("/:id", ...guard, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id)
      .populate("product", "name image sku brand price stock")
      .lean();
    if (!item) return res.status(404).json({ message: "Inventory record not found" });
    return res.json({ data: item });
  } catch (err) {
    console.error("Get inventory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/inventory ────────────────────────────────────────────────
// Create initial inventory record for a product
router.post("/", ...guard, async (req, res) => {
  try {
    const { product, quantity = 0, lowStockThreshold = 10, location, note } = req.body || {};
    if (!product) return res.status(400).json({ message: "product ID is required" });

    const exists = await Inventory.findOne({ product });
    if (exists) return res.status(400).json({ message: "Inventory record already exists for this product" });

    const productDoc = await Product.findById(product);
    if (!productDoc) return res.status(404).json({ message: "Product not found" });

    const inventory = await Inventory.create({
      product,
      quantity,
      lowStockThreshold,
      location: location || "Main Warehouse",
      history: [
        {
          action: "initial",
          quantityChange: quantity,
          quantityAfter: quantity,
          note: note || "Initial stock setup",
          performedBy: req.user._id,
          date: new Date(),
        },
      ],
    });

    // Sync product stock field
    await Product.findByIdAndUpdate(product, { stock: quantity });

    return res.status(201).json({
      message: "Inventory record created",
      data: await inventory.populate("product", "name image sku brand"),
    });
  } catch (err) {
    console.error("Create inventory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/admin/inventory/:id ─────────────────────────────────────────────
// Full update — restock, adjust, damage etc.
router.put("/:id", ...guard, async (req, res) => {
  try {
    const { action, quantityChange, quantity, lowStockThreshold, location, note } = req.body || {};

    const inventory = await Inventory.findById(req.params.id);
    if (!inventory) return res.status(404).json({ message: "Inventory record not found" });

    // Settings-only update (no stock change)
    if (lowStockThreshold !== undefined) inventory.lowStockThreshold = lowStockThreshold;
    if (location !== undefined) inventory.location = location;

    // Stock change via action
    if (action && quantityChange !== undefined) {
      const validActions = ["restock", "adjustment", "sale", "return", "damage"];
      if (!validActions.includes(action))
        return res.status(400).json({ message: `action must be one of: ${validActions.join(", ")}` });

      const change = Number(quantityChange);
      const newQty = inventory.quantity + change;
      if (newQty < 0) return res.status(400).json({ message: "Stock cannot go below 0" });

      inventory.quantity = newQty;
      inventory.history.push({
        action,
        quantityChange: change,
        quantityAfter: newQty,
        note: note || null,
        performedBy: req.user._id,
        date: new Date(),
      });

      // Sync product stock field
      await Product.findByIdAndUpdate(inventory.product, { stock: newQty });
    } else if (quantity !== undefined) {
      // Absolute set
      const newQty = Number(quantity);
      if (newQty < 0) return res.status(400).json({ message: "Stock cannot be negative" });
      const change = newQty - inventory.quantity;
      inventory.quantity = newQty;
      inventory.history.push({
        action: "adjustment",
        quantityChange: change,
        quantityAfter: newQty,
        note: note || "Manual adjustment",
        performedBy: req.user._id,
        date: new Date(),
      });
      await Product.findByIdAndUpdate(inventory.product, { stock: newQty });
    }

    await inventory.save();

    return res.json({
      message: "Inventory updated",
      data: await inventory.populate("product", "name image sku brand stock"),
    });
  } catch (err) {
    console.error("Update inventory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/admin/inventory/:id ──────────────────────────────────────────
router.delete("/:id", ...guard, async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Inventory record not found" });
    return res.json({ message: "Inventory record deleted" });
  } catch (err) {
    console.error("Delete inventory error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
