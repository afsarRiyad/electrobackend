import jwt from "jsonwebtoken";
import { User } from "./models.js";

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
