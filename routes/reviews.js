import { Router } from "express";
import { Review, Product } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";

const router = Router();

// Get reviews for a product
router.get("/reviews/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = "newest" } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const perPage = Math.min(Math.max(Number(limit) || 10, 1), 50);

    let sortObj = {};
    switch (sort) {
      case "rating-high":
        sortObj = { rating: -1 };
        break;
      case "rating-low":
        sortObj = { rating: 1 };
        break;
      case "helpful":
        sortObj = { helpful: -1 };
        break;
      case "newest":
      default:
        sortObj = { createdAt: -1 };
        break;
    }

    const [total, reviews] = await Promise.all([
      Review.countDocuments({ product: productId, status: "approved" }),
      Review.find({ product: productId, status: "approved" })
        .sort(sortObj)
        .skip((currentPage - 1) * perPage)
        .limit(perPage)
        .lean()
    ]);

    // Calculate rating distribution
    const ratingStats = await Review.aggregate([
      { $match: { product: productId, status: "approved" } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    const ratingDistribution = {};
    for (let i = 5; i >= 1; i--) {
      ratingDistribution[i] = ratingStats.find(r => r._id === i)?.count || 0;
    }

    res.json({
      data: reviews,
      meta: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
        sort,
        ratingDistribution
      }
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create a review (requires authentication)
router.post("/reviews", protect, async (req, res) => {
  try {
    const { product, rating, title, comment, images } = req.body;
    const user = req.user;

    // Validate required fields
    if (!product || !rating || !title || !comment) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Check if product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ product, user: user._id });
    if (existingReview) {
      return res.status(400).json({ message: "You have already reviewed this product" });
    }

    // Create review
    const review = await Review.create({
      product,
      user: user._id,
      userName: user.firstName || user.email.split('@')[0],
      userEmail: user.email,
      rating,
      title,
      comment,
      images: images || [],
      status: "pending" // Requires admin approval
    });

    res.status(201).json({ data: review });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark review as helpful
router.post("/reviews/:reviewId/helpful", async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.reviewId,
      { $inc: { helpful: 1 } },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ data: review });
  } catch (error) {
    console.error("Error marking review as helpful:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
