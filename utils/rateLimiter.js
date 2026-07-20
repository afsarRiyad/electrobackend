import rateLimit from "express-rate-limit";

// Common response
const rateLimitMessage = (message) => ({
  success: false,
  message,
});

// General API limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage(
    "Too many requests. Please try again in a few minutes."
  ),
});

// Authentication limiter
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage(
    "Too many login attempts. Please try again after 15 minutes."
  ),
});

// Admin API limiter
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage(
    "Too many admin requests. Please slow down and try again."
  ),
});

// File upload limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage(
    "Upload limit exceeded. Please try again later."
  ),
});