import { Router } from "express";
import { Coupon, CouponRedemption } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";

const router = Router();

// @desc    Validate coupon code
// @route   POST /api/coupons/validate
// @access  Public
router.post("/validate", async (req, res) => {
  try {
    const { code, orderTotal, userId } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!coupon) {
      return res.status(404).json({ message: "Invalid coupon code" });
    }

    // Check if coupon is within valid date range
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({ message: "Coupon has expired or is not yet valid" });
    }

    // Check minimum order amount
    if (orderTotal && orderTotal < coupon.minimumOrderAmount) {
      return res.status(400).json({ 
        message: `Minimum order amount of $${coupon.minimumOrderAmount} required` 
      });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ message: "Coupon usage limit exceeded" });
    }

    const previousRedemption = await CouponRedemption.findOne({
      coupon: coupon._id,
      $or: [{ user: req.user._id }, { ipAddress: req.ip }],
    }).lean();
    if (previousRedemption) {
      return res.status(409).json({
        message: previousRedemption.ipAddress === req.ip
          ? "This coupon has already been redeemed from this IP address"
          : "You have already redeemed this coupon",
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (orderTotal * coupon.discountValue) / 100;
    } else {
      discountAmount = coupon.discountValue;
    }

    // Apply maximum discount limit if set
    if (coupon.maximumDiscountAmount && discountAmount > coupon.maximumDiscountAmount) {
      discountAmount = coupon.maximumDiscountAmount;
    }

    // Ensure discount doesn't exceed order total
    if (discountAmount > orderTotal) {
      discountAmount = orderTotal;
    }

    res.json({
      success: true,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        description: coupon.description,
      },
    });
  } catch (error) {
    console.error("Coupon validation error:", error);
    res.status(500).json({ message: "Server error during coupon validation" });
  }
});

// @desc    Preview coupon discount for checkout (does not redeem the coupon)
// @route   POST /api/coupons/apply
// @access  Private
router.post("/apply", protect, async (req, res) => {
  try {
    const { code, orderTotal } = req.body;

    if (!req.user.isVerified) {
      return res.status(403).json({ message: "Verify your email before using a coupon" });
    }

    if (!code) {
      return res.status(400).json({ message: "Coupon code is required" });
    }

    if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
      return res.status(400).json({ message: "A valid order total is required" });
    }

    const now = new Date();

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return res.status(404).json({ message: "Invalid coupon code" });
    }

    if (now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({ message: "Coupon has expired or is not yet valid" });
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ message: "Coupon usage limit exceeded" });
    }

    // Check minimum order amount
    if (orderTotal < coupon.minimumOrderAmount) {
      return res.status(400).json({ 
        message: `Minimum order amount of $${coupon.minimumOrderAmount} required` 
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (orderTotal * coupon.discountValue) / 100;
    } else {
      discountAmount = coupon.discountValue;
    }

    // Apply maximum discount limit if set
    if (coupon.maximumDiscountAmount && discountAmount > coupon.maximumDiscountAmount) {
      discountAmount = coupon.maximumDiscountAmount;
    }

    // Ensure discount doesn't exceed order total
    if (discountAmount > orderTotal) {
      discountAmount = orderTotal;
    }

    res.json({
      success: true,
      message: "Coupon is ready to use at checkout",
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        description: coupon.description,
      },
    });
  } catch (error) {
    console.error("Coupon application error:", error);
    res.status(500).json({ message: "Server error during coupon application" });
  }
});

// @desc    Create new coupon (admin only)
// @route   POST /api/coupons
// @access  Private/Admin
router.post("/", protect, async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscountAmount,
      usageLimit,
      userLimit,
      validFrom,
      validUntil,
      applicableProducts,
      applicableCategories,
    } = req.body;

    if (!code || !discountType || !discountValue || !validUntil) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscountAmount,
      usageLimit,
      userLimit,
      validFrom: validFrom || Date.now(),
      validUntil,
      applicableProducts,
      applicableCategories,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon,
    });
  } catch (error) {
    console.error("Coupon creation error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }
    res.status(500).json({ message: "Server error during coupon creation" });
  }
});

// @desc    Get all coupons (admin only)
// @route   GET /api/coupons
// @access  Private/Admin
router.get("/", protect, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, data: coupons });
  } catch (error) {
    console.error("Get coupons error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Get single coupon
// @route   GET /api/coupons/:id
// @access  Private/Admin
router.get("/:id", protect, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    res.json({ success: true, data: coupon });
  } catch (error) {
    console.error("Get coupon error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Private/Admin
router.put("/:id", protect, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    Object.assign(coupon, req.body);
    await coupon.save();

    res.json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon,
    });
  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
router.delete("/:id", protect, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    await coupon.deleteOne();

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Toggle coupon active status
// @route   PATCH /api/coupons/:id/toggle
// @access  Private/Admin
router.patch("/:id/toggle", protect, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      data: coupon,
    });
  } catch (error) {
    console.error("Toggle coupon error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
