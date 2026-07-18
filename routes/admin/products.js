import { Router } from "express";
import { Product, Counter } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";

const router = Router();
const guard = [protect, isAdmin];

// Helper: generate a numeric ID using atomic counter
const getNextProductId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: "productId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

// Helper: generate slug from name
const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ─── GET /api/admin/products ──────────────────────────────────────────────────
router.get("/", ...guard, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      brand,
      category,
      isActive,
      lowStock,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }
    if (brand) filter.brand = { $regex: brand, $options: "i" };
    if (category) filter.categories = category;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (lowStock === "true") filter.stock = { $lte: 10, $gt: 0 };
    if (lowStock === "out") filter.stock = 0;

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(filter),
    ]);

    return res.json({
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("Admin list products error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/products/:id ──────────────────────────────────────────────
router.get("/:id", ...guard, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.json({ data: product });
  } catch (err) {
    console.error("Get product error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/products ─────────────────────────────────────────────────
router.post("/", ...guard, async (req, res) => {
  try {
    const {
      name, sku, brand, categories, tags, price, regularPrice, salePrice,
      rating, reviews, stock, image, productUrl, description, isActive, slug,
    } = req.body;

    if (!name || price === undefined)
      return res.status(400).json({ message: "name and price are required" });

    const nextId = await getNextProductId();
    const finalSlug = slug || `${slugify(name)}-${nextId}`;

    const existing = await Product.findOne({ $or: [{ slug: finalSlug }, { sku }] });
    if (existing) return res.status(400).json({ message: "Product with this slug or SKU already exists" });

    const product = await Product.create({
      id: nextId,
      slug: finalSlug,
      name,
      sku,
      brand,
      categories: categories || [],
      tags: tags || [],
      price,
      regularPrice,
      salePrice,
      rating: rating || 0,
      reviews: reviews || 0,
      stock: stock || 0,
      image,
      productUrl,
      description,
      isActive: isActive !== undefined ? isActive : true,
    });

    return res.status(201).json({ message: "Product created", data: product });
  } catch (err) {
    console.error("Create product error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/admin/products/:id ──────────────────────────────────────────────
router.put("/:id", ...guard, async (req, res) => {
  try {
    const allowed = [
      "name", "sku", "brand", "categories", "tags", "price", "regularPrice",
      "salePrice", "rating", "reviews", "stock", "image", "productUrl",
      "description", "isActive", "slug",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json({ message: "Product updated", data: product });
  } catch (err) {
    console.error("Update product error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/admin/products/:id ───────────────────────────────────────────
router.delete("/:id", ...guard, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("Delete product error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/admin/products/:id/stock ─────────────────────────────────────
// Quick stock update without touching other fields
router.patch("/:id/stock", ...guard, async (req, res) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0)
      return res.status(400).json({ message: "Valid stock value required" });

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json({ message: "Stock updated", data: { _id: product._id, stock: product.stock } });
  } catch (err) {
    console.error("Stock update error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/admin/products/:id/toggle ─────────────────────────────────────
// Toggle isActive
router.patch("/:id/toggle", ...guard, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.isActive = !product.isActive;
    await product.save();

    return res.json({ message: `Product ${product.isActive ? "activated" : "deactivated"}`, data: product });
  } catch (err) {
    console.error("Toggle product error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
