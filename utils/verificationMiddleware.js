import { User } from "./models.js";

// Middleware to check if user is verified
export const requireVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        message: "Email verification required. Please verify your email to access this feature.",
        requiresVerification: true
      });
    }

    next();
  } catch (error) {
    console.error("Verification middleware error:", error);
    res.status(500).json({ message: "Server error during verification check" });
  }
};
