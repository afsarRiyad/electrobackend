import { Router } from "express";
import { Product, ProductAttribute, Category } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";
import { activityMiddleware } from "../../utils/activityLog.js";

const router = Router();
const guard = [protect, isAdmin];

// ─── GET /api/admin/product-attributes/:productId ─────────────────────────────
// Get all attributes for a product
router.get("/:productId", ...guard, async (req, res) => {
  try {
    const attributes = await ProductAttribute.find({ product: req.params.productId })
      .sort({ name: 1 })
      .lean();

    return res.json({ data: attributes });
  } catch (err) {
    console.error("Get product attributes error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/product-attributes ───────────────────────────────────────
// Add attribute to product
router.post("/", ...guard, activityMiddleware('create', 'product'), async (req, res) => {
  try {
    const { product, name, value, type } = req.body || {};

    if (!product || !name || !value || !type) {
      return res.status(400).json({ message: "Product, name, value, and type are required" });
    }

    // Verify product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if attribute already exists for this product
    const existing = await ProductAttribute.findOne({ product, name });
    if (existing) {
      return res.status(400).json({ message: "Attribute already exists for this product" });
    }

    const attribute = await ProductAttribute.create({
      product,
      name,
      value,
      type,
    });

    return res.status(201).json({ message: "Attribute added", data: attribute });
  } catch (err) {
    console.error("Add product attribute error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/admin/product-attributes/:id ─────────────────────────────────────
// Update product attribute
router.put("/:id", ...guard, activityMiddleware('update', 'product'), async (req, res) => {
  try {
    const { name, value, type } = req.body || {};

    const attribute = await ProductAttribute.findById(req.params.id);
    if (!attribute) {
      return res.status(404).json({ message: "Attribute not found" });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (value !== undefined) updates.value = value;
    if (type !== undefined) updates.type = type;

    const updated = await ProductAttribute.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    return res.json({ message: "Attribute updated", data: updated });
  } catch (err) {
    console.error("Update product attribute error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/admin/product-attributes/:id ───────────────────────────────────
// Delete product attribute
router.delete("/:id", ...guard, activityMiddleware('delete', 'product'), async (req, res) => {
  try {
    const attribute = await ProductAttribute.findById(req.params.id);
    if (!attribute) {
      return res.status(404).json({ message: "Attribute not found" });
    }

    await ProductAttribute.findByIdAndDelete(req.params.id);

    return res.json({ message: "Attribute deleted" });
  } catch (err) {
    console.error("Delete product attribute error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/product-attributes/bulk ───────────────────────────────────
// Bulk add attributes to product
router.post("/bulk", ...guard, activityMiddleware('create', 'product'), async (req, res) => {
  try {
    const { product, attributes } = req.body || {};

    if (!product || !Array.isArray(attributes)) {
      return res.status(400).json({ message: "Product and attributes array are required" });
    }

    // Verify product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete existing attributes for this product
    await ProductAttribute.deleteMany({ product });

    // Create new attributes
    const attributeDocs = attributes.map(attr => ({
      product,
      name: attr.name,
      value: attr.value,
      type: attr.type,
    }));

    const createdAttributes = await ProductAttribute.insertMany(attributeDocs);

    return res.status(201).json({ 
      message: "Attributes added in bulk", 
      data: createdAttributes 
    });
  } catch (err) {
    console.error("Bulk add product attributes error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/product-attributes/schema/:categoryId ───────────────────────
// Get attribute schema from category (for form generation)
router.get("/schema/:categoryId", ...guard, async (req, res) => {
  try {
    const category = await Category.findById(req.params.categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.json({ data: category.attributes });
  } catch (err) {
    console.error("Get category schema error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
