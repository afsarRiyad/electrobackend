import jwt from "jsonwebtoken";
import { User } from "./models.js";

const extractToken = (req) => {
  // Try to get token from Authorization header first (access token)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return req.headers.authorization.split(" ")[1];
  }
  // Fallback to cookie for backward compatibility
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
};

export const protect = async (req, res, next) => {
  let token;

  // Try to get token from Authorization header first (access token)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  // Fallback to cookie for backward compatibility
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: true,
      requireAuth: true,
      message: "Please log in to continue"
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from the token
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: true,
        requireAuth: true,
        message: "Account not found. Please log in again"
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        error: true,
        requireAuth: true,
        tokenExpired: true,
        message: "Session expired. Please log in again"
      });
    }
    return res.status(401).json({ 
      success: false,
      error: true,
      requireAuth: true,
      message: "Invalid authentication. Please log in again"
    });
  }
};

// Resolves which account a wishlist/compare/cart entry belongs to: a logged-in
// user takes precedence, otherwise the guest session id (x-guest-id header or
// guestId in body/query). Returns null when neither is present.
export const resolveOwner = (req) => {
  if (req.user) return { user: req.user._id };
  if (req.guestId) return { guestId: req.guestId };
  return null;
};

// Like `protect`, but does not require a token. Authenticates the user when a
// valid token is supplied (so logged-in calls keep working) and always reads the
// guest session id, allowing guest wishlist/compare/cart access.
export const protectOptional = async (req, res, next) => {
  const token = extractToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (user) {
        req.user = user;
      }
    } catch (error) {
      // Invalid or expired token: fall back to guest mode instead of failing.
    }
  }

  const guestId =
    req.headers["x-guest-id"] || req.body?.guestId || req.query?.guestId || null;
  req.guestId =
    typeof guestId === "string" && guestId.length > 0 && guestId.length <= 100
      ? guestId
      : null;

  return next();
};
