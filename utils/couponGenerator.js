// Generate unique coupon codes for new users
import crypto from 'crypto';

export const generateUniqueCouponCode = () => {
  // Generate a random 8-character coupon code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const createWelcomeCouponForUser = async (userEmail, userId, discountValue = 40, discountType = 'percentage') => {
  const { Coupon } = await import('../utils/models.js');
  
  // Generate unique coupon code with collision detection
  let code;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    code = generateUniqueCouponCode();
    const existingCoupon = await Coupon.findOne({ code });
    if (!existingCoupon) break;
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    throw new Error("Failed to generate unique coupon code after multiple attempts");
  }
  
  const now = new Date();
  const validUntil = new Date();
  validUntil.setMonth(validUntil.getMonth() + 1); // Valid for 1 month
  
  // Create coupon with usage limit of 1 (single use)
  const coupon = await Coupon.create({
    code: code,
    description: `Welcome coupon for ${userEmail}`,
    discountType: discountType,
    discountValue: discountValue,
    maximumDiscountAmount: discountType === 'percentage' ? 100 : null, // Max 100 if percentage
    minimumOrderAmount: 0, // No minimum for welcome coupons
    usageLimit: 1, // Single use only
    usageCount: 0,
    isActive: true,
    validFrom: now,
    validUntil: validUntil,
    createdBy: userId, // Add the user who is receiving the coupon as the creator
  });
  
  return coupon;
};
