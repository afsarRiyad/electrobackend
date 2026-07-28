import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Common response
const rateLimitMessage = (message) => ({
  success: false,
  message,
});

// General API limiter - IP-based
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: rateLimitMessage(
    "Too many requests. Please try again in a few minutes."
  ),
});

// Authentication limiter - IP and account-based
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Reduced to 5 attempts per 15 minutes
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    const username = req.body?.username || req.body?.email;
    return username ? `${ip}:${username.toLowerCase().trim()}` : ip;
  },
  message: rateLimitMessage(
    "Too many login attempts. Please try again after 15 minutes."
  ),
});

// Admin API limiter - IP-based
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: rateLimitMessage(
    "Too many admin requests. Please slow down and try again."
  ),
});

// File upload limiter - IP-based
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: rateLimitMessage(
    "Upload limit exceeded. Please try again later."
  ),
});