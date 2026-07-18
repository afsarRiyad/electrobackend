import { Router } from "express";
import { User, Order, Product } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";

const router = Router();

// ─── GET /api/user/profile ──────────────────────────────────────────────────
// Get comprehensive user dashboard data
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("recentlyViewed", "name image price slug rating")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's order statistics
    const orderStats = await Order.aggregate([
      { $match: { customerEmail: user.email } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] }
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
          },
        }
      }
    ]);

    // Get recent orders (last 5)
    const recentOrders = await Order.find({ customerEmail: user.email })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("items.product", "name image")
      .lean();

    const stats = orderStats[0] || {
      totalOrders: 0,
      totalSpent: 0,
      pendingOrders: 0,
      processingOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
    };

    return res.json({
      data: {
        user,
        stats,
        recentOrders,
      },
    });
  } catch (err) {
    console.error("Get user profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/user/orders ───────────────────────────────────────────────────
// Get user's order history
router.get("/orders", protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = { customerEmail: req.user.email };

    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .populate("items.product", "name image sku")
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.json({
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("Get user orders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/user/recently-viewed ───────────────────────────────────────────
// Get recently viewed products
router.get("/recently-viewed", protect, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const user = await User.findById(req.user._id)
      .populate("recentlyViewed", "name image price slug rating categories brand")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get most recent products (reverse the array)
    const recentlyViewed = user.recentlyViewed
      ? user.recentlyViewed.slice(-limit).reverse()
      : [];

    return res.json({ data: recentlyViewed });
  } catch (err) {
    console.error("Get recently viewed error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/user/recently-viewed ───────────────────────────────────────────
// Track product view
router.post("/recently-viewed", protect, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const user = await User.findById(req.user._id);

    // Remove product if already in recently viewed (to move it to the end)
    user.recentlyViewed = user.recentlyViewed.filter(
      (id) => id.toString() !== productId
    );

    // Add product to recently viewed
    user.recentlyViewed.push(productId);

    // Keep only last 20 recently viewed products
    if (user.recentlyViewed.length > 20) {
      user.recentlyViewed = user.recentlyViewed.slice(-20);
    }

    await user.save();

    return res.json({ 
      message: "Product added to recently viewed",
      data: { recentlyViewed: user.recentlyViewed }
    });
  } catch (err) {
    console.error("Add recently viewed error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/user/recently-viewed/:productId ─────────────────────────────
// Remove product from recently viewed
router.delete("/recently-viewed/:productId", protect, async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user._id);

    user.recentlyViewed = user.recentlyViewed.filter(
      (id) => id.toString() !== productId
    );

    await user.save();

    return res.json({ message: "Product removed from recently viewed" });
  } catch (err) {
    console.error("Remove recently viewed error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/user/profile ───────────────────────────────────────────────────
// Update user profile
router.put("/profile", protect, async (req, res) => {
  try {
    const allowed = [
      "username",
      "phone",
      "avatar",
      "address",
    ];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // If updating username, check if it's already taken
    if (updates.username) {
      const existingUser = await User.findOne({
        username: updates.username,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select("-password");

    return res.json({ message: "Profile updated", data: user });
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
