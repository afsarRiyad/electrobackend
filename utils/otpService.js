import crypto from 'crypto';

// In-memory store for OTPs (in production, use Redis)
const otpStore = new Map();

// Clean up expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Generate a 6-digit OTP code
 */
export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Store OTP with expiration
 */
export const storeOTP = (email, otp, purpose = 'signup') => {
  const key = `${purpose}:${email.toLowerCase().trim()}`;
  const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
  
  otpStore.set(key, {
    otp,
    expiresAt,
    purpose,
    attempts: 0,
    createdAt: Date.now()
  });
  
  return expiresAt;
};

/**
 * Verify OTP
 */
export const verifyOTP = (email, otp, purpose = 'signup') => {
  const key = `${purpose}:${email.toLowerCase().trim()}`;
  const data = otpStore.get(key);
  
  if (!data) {
    return { valid: false, message: 'OTP not found or expired' };
  }
  
  if (data.expiresAt < Date.now()) {
    otpStore.delete(key);
    return { valid: false, message: 'OTP expired' };
  }
  
  if (data.attempts >= 3) {
    otpStore.delete(key);
    return { valid: false, message: 'Maximum attempts exceeded' };
  }
  
  if (data.otp !== otp) {
    data.attempts += 1;
    otpStore.set(key, data);
    const remainingAttempts = 3 - data.attempts;
    return { 
      valid: false, 
      message: `Invalid OTP. ${remainingAttempts} attempts remaining` 
    };
  }
  
  // Valid OTP - remove it
  otpStore.delete(key);
  return { valid: true };
};

/**
 * Check if OTP exists for email (for resend functionality)
 */
export const hasOTP = (email, purpose = 'signup') => {
  const key = `${purpose}:${email.toLowerCase().trim()}`;
  const data = otpStore.get(key);
  return data && data.expiresAt > Date.now();
};

/**
 * Get remaining time for OTP
 */
export const getOTPExpiry = (email, purpose = 'signup') => {
  const key = `${purpose}:${email.toLowerCase().trim()}`;
  const data = otpStore.get(key);
  
  if (!data) return null;
  
  const remaining = Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000));
  return remaining;
};
