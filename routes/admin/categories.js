import { Router } from "express";
import { Category, Product } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";
import { activityMiddleware } from "../../utils/activityLog.js";
import { clearCachePattern } from "../../utils/cache.js";

const router = Router();
const guard = [protect, isAdmin];

// Helper: generate slug from name
const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ─── GET /api/admin/categories ───────────────────────────────────────────────
// List categories with hierarchy and filters
router.get("/", ...guard, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      isActive,
      parent,
      includeChildren = "true",
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (parent === "null" || parent === "") {
      filter.parent = null;
    } else if (parent) {
      filter.parent = parent;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort({ displayOrder: 1, name: 1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("parent", "name slug")
        .lean(),
      Category.countDocuments(filter),
    ]);

    // Include children if requested
    let categoriesWithChildren = categories;
    if (includeChildren === "true") {
      const allCategories = await Category.find().lean();
      const buildTree = (parentId = null) => {
        return allCategories
          .filter(cat => String(cat.parent) === String(parentId))
          .map(cat => ({
            ...cat,
            children: buildTree(cat._id),
          }));
      };
      
      if (!parent && !search) {
        categoriesWithChildren = buildTree();
      }
    }

    return res.json({
      data: categoriesWithChildren,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("Get categories error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/categories/tree ───────────────────────────────────────────
// Get full category tree
router.get("/tree", ...guard, async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    const buildTree = (parentId = null) => {
      return categories
        .filter(cat => String(cat.parent) === String(parentId))
        .map(cat => ({
          ...cat,
          children: buildTree(cat._id),
        }));
    };

    return res.json({ data: buildTree() });
  } catch (err) {
    console.error("Get category tree error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/categories/:id ────────────────────────────────────────────
// Get single category with details
router.get("/:id", ...guard, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate("parent", "name slug")
      .lean();

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Get child categories
    const children = await Category.find({ parent: req.params.id })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Get product count in this category
    const productCount = await Product.countDocuments({ 
      categories: category.name,
      isActive: true 
    });

    return res.json({
      data: {
        ...category,
        children,
        productCount,
      },
    });
  } catch (err) {
    console.error("Get category error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/categories ──────────────────────────────────────────────
// Create new category
router.post("/", ...guard, activityMiddleware('create', 'category'), async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      parent,
      image,
      icon,
      isActive,
      displayOrder,
      attributes,
      metaTitle,
      metaDescription,
      metaKeywords,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const finalSlug = slug || slugify(name);

    // Check if slug already exists
    const existing = await Category.findOne({ slug: finalSlug });
    if (existing) {
      return res.status(400).json({ message: "Category with this slug already exists" });
    }

    // Validate parent exists if provided
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({ message: "Parent category not found" });
      }
    }

    const category = await Category.create({
      name: name.trim(),
      slug: finalSlug,
      description,
      parent,
      image,
      icon,
      isActive: isActive !== undefined ? isActive : true,
      displayOrder: displayOrder || 0,
      attributes: attributes || [],
      metaTitle,
      metaDescription,
      metaKeywords: metaKeywords || [],
    });

    // Clear category cache
    clearCachePattern("categories");

    return res.status(201).json({ message: "Category created", data: category });
  } catch (err) {
    console.error("Create category error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/admin/categories/:id ───────────────────────────────────────────
// Update category
router.put("/:id", ...guard, activityMiddleware('update', 'category'), async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      parent,
      image,
      icon,
      isActive,
      displayOrder,
      attributes,
      metaTitle,
      metaDescription,
      metaKeywords,
    } = req.body || {};

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Validate parent exists if provided and different
    if (parent && String(parent) !== String(category.parent)) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({ message: "Parent category not found" });
      }
      // Prevent circular reference
      if (String(parent) === String(req.params.id)) {
        return res.status(400).json({ message: "Category cannot be its own parent" });
      }
    }

    // Check if new slug conflicts with existing category
    if (slug && slug !== category.slug) {
      const existing = await Category.findOne({ slug, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ message: "Slug already in use" });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (slug !== undefined) updates.slug = slug;
    if (description !== undefined) updates.description = description;
    if (parent !== undefined) updates.parent = parent;
    if (image !== undefined) updates.image = image;
    if (icon !== undefined) updates.icon = icon;
    if (isActive !== undefined) updates.isActive = isActive;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;
    if (attributes !== undefined) updates.attributes = attributes;
    if (metaTitle !== undefined) updates.metaTitle = metaTitle;
    if (metaDescription !== undefined) updates.metaDescription = metaDescription;
    if (metaKeywords !== undefined) updates.metaKeywords = metaKeywords;

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate("parent", "name slug");

    // Clear category cache
    clearCachePattern("categories");

    return res.json({ message: "Category updated", data: updated });
  } catch (err) {
    console.error("Update category error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/admin/categories/:id ─────────────────────────────────────────
// Delete category
router.delete("/:id", ...guard, activityMiddleware('delete', 'category'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Check if category has children
    const childCount = await Category.countDocuments({ parent: req.params.id });
    if (childCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete category with subcategories. Delete or move subcategories first." 
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ categories: category.name });
    if (productCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete category with products. Reassign products first." 
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    // Clear category cache
    clearCachePattern("categories");

    return res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("Delete category error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/admin/categories/:id/toggle ───────────────────────────────────
// Toggle category active status
router.patch("/:id/toggle", ...guard, activityMiddleware('update', 'category'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    category.isActive = !category.isActive;
    await category.save();

    // Clear category cache
    clearCachePattern("categories");

    return res.json({ message: "Category status toggled", data: category });
  } catch (err) {
    console.error("Toggle category error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/admin/categories/:id/reorder ──────────────────────────────────
// Reorder categories
router.patch("/reorder", ...guard, async (req, res) => {
  try {
    const { orders } = req.body || {};

    if (!Array.isArray(orders)) {
      return res.status(400).json({ message: "Orders array is required" });
    }

    const bulkOps = orders.map(({ id, displayOrder }) => ({
      updateOne: {
        filter: { _id: id },
        update: { displayOrder },
      },
    }));

    await Category.bulkWrite(bulkOps);

    // Clear category cache
    clearCachePattern("categories");

    return res.json({ message: "Categories reordered" });
  } catch (err) {
    console.error("Reorder categories error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/categories/:id/attributes ───────────────────────────────
// Add attribute to category
router.post("/:id/attributes", ...guard, async (req, res) => {
  try {
    const { name, type, required, options, defaultValue } = req.body || {};

    if (!name || !type) {
      return res.status(400).json({ message: "Attribute name and type are required" });
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Check if attribute already exists
    if (category.attributes.some(attr => attr.name === name)) {
      return res.status(400).json({ message: "Attribute already exists" });
    }

    category.attributes.push({
      name,
      type,
      required: required || false,
      options: options || [],
      defaultValue,
    });

    await category.save();

    return res.json({ message: "Attribute added", data: category });
  } catch (err) {
    console.error("Add attribute error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/admin/categories/:id/attributes/:attributeName ─────────────
// Remove attribute from category
router.delete("/:id/attributes/:attributeName", ...guard, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    category.attributes = category.attributes.filter(
      attr => attr.name !== req.params.attributeName
    );

    await category.save();

    return res.json({ message: "Attribute removed", data: category });
  } catch (err) {
    console.error("Remove attribute error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
