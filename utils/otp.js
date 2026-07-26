import crypto from 'crypto';

// Generate 6-digit OTP
export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Check if OTP is valid and not expired
export const validateOTP = (userOTP, storedOTP, otpExpires) => {
  if (!userOTP || !storedOTP) {
    return { valid: false, message: 'OTP is required' };
  }

  if (userOTP !== storedOTP) {
    return { valid: false, message: 'Invalid OTP' };
  }

  if (new Date() > otpExpires) {
    return { valid: false, message: 'OTP has expired' };
  }

  return { valid: true, message: 'OTP is valid' };
};

// Generate OTP expiry time (10 minutes from now)
export const generateOTPExpiry = () => {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
};
