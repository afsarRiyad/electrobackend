import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { User } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";
import { validateLogin, validateSignup } from "../utils/validation.js";
import { logActivity } from "../utils/activityLog.js";
import { loginAttemptMiddleware, recordSuccessfulLogin, recordFailedLogin } from "../utils/loginAttemptTracker.js";
import { getCSRFToken, csrfProtection } from "../utils/csrfProtection.js";
import { generateOTP, storeOTP, verifyOTP, hasOTP, getOTPExpiry } from "../utils/otpService.js";
import { sendOTPEmail, sendWelcomeEmail } from "../utils/emailService.js";

const router = Router();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// Vercel and Render use different sites, so production requests need a
// cross-site cookie. Local development remains protected by SameSite=Strict.
const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

const clearAuthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  path: "/",
};

// ─── POST /api/auth/send-otp ───────────────────────────────────────────────
// Send OTP for email verification
router.post("/send-otp", async (req, res) => {
  try {
    const { email, purpose = 'signup' } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user already exists (for signup)
    if (purpose === 'signup') {
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }
    }

    // Generate and store OTP
    const otp = generateOTP();
    const expiresAt = storeOTP(email, otp, purpose);

    // Send OTP email
    await sendOTPEmail(email, otp, purpose);

    return res.json({
      message: "OTP sent successfully",
      data: {
        email,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    });
  } catch (err) {
    console.error("Send OTP error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
});

// ─── POST /api/auth/verify-otp ─────────────────────────────────────────────
// Verify OTP code and mark user as verified
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, purpose = 'signup' } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Verify OTP
    const result = verifyOTP(email, otp, purpose);

    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    // If signup purpose, mark user as verified
    if (purpose === 'signup') {
      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (user) {
        user.isVerified = true;
        user.emailVerifiedAt = new Date();
        user.otp = null;
        user.otpExpires = null;
        await user.save();

        // Log verification
        await logActivity({
          user: user._id,
          action: "email_verified",
          entity: "user",
          entityId: user._id,
          details: { email: user.email },
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      return res.json({
        message: "Email verified successfully",
        data: {
          email,
          verified: true,
        },
      });
    }

    return res.json({
      message: "OTP verified successfully",
      data: {
        email,
        verified: true,
      },
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/auth/resend-otp ─────────────────────────────────────────────
// Resend OTP code
router.post("/resend-otp", async (req, res) => {
  try {
    const { email, purpose = 'signup' } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if there's an existing OTP that hasn't expired
    const existingOTP = hasOTP(email, purpose);
    const remainingTime = getOTPExpiry(email, purpose);

    // Rate limiting: if OTP was sent recently, wait before resending
    if (existingOTP && remainingTime && remainingTime > 120) {
      return res.status(429).json({
        message: `Please wait ${Math.floor(remainingTime / 60)} minutes before requesting a new OTP`,
        remainingTime,
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = storeOTP(email, otp, purpose);

    // Send OTP email
    await sendOTPEmail(email, otp, purpose);

    return res.json({
      message: "OTP resent successfully",
      data: {
        email,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    return res.status(500).json({ message: "Failed to resend OTP" });
  }
});

// ─── POST /api/auth/signup ───────────────────────────────────────────────
router.post("/signup", validateSignup, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { username: username.trim() }],
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (unverified by default)
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      isVerified: false,
    });

    // Log signup
    await logActivity({
      user: user._id,
      action: "signup",
      entity: "user",
      entityId: user._id,
      details: { email: user.email, username: user.username },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Send verification OTP
    const otp = generateOTP();
    const expiresAt = storeOTP(email, otp, 'signup');
    await sendOTPEmail(email, otp, 'signup');

    // Sign the user in immediately so they can access dashboard (with limited access)
    const token = generateToken(user._id);
    res.cookie("token", token, authCookieOptions);

    return res.status(201).json({
      message: "User created successfully. Please verify your email to access all features.",
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVerified: false,
        requiresVerification: true,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────
router.post("/login", loginAttemptMiddleware, validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username/email and password are required" });
    }

    const user = await User.findOne({
      $or: [{ email: username.toLowerCase().trim() }, { username: username.trim() }],
    });

    if (!user) {
      recordFailedLogin(req.ip || req.connection.remoteAddress, 'ip');
      recordFailedLogin(username.toLowerCase().trim(), 'account');
      await logActivity({
        user: null,
        action: "login_failure",
        entity: "user",
        details: { reason: "user_not_found", identifier: username },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.status === "suspended") {
      await logActivity({
        user: user._id,
        action: "login_failure",
        entity: "user",
        entityId: user._id,
        details: { reason: "account_suspended" },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      recordFailedLogin(req.ip || req.connection.remoteAddress, 'ip');
      recordFailedLogin(username.toLowerCase().trim(), 'account');
      await logActivity({
        user: user._id,
        action: "login_failure",
        entity: "user",
        entityId: user._id,
        details: { reason: "invalid_password" },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Record successful login to reset attempts
    recordSuccessfulLogin(req.ip || req.connection.remoteAddress, 'ip');
    recordSuccessfulLogin(username.toLowerCase().trim(), 'account');
    
    // Log successful login
    await logActivity({
      user: user._id,
      action: "login_success",
      entity: "user",
      entityId: user._id,
      details: { email: user.email, username: user.username },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Generate token and set as HTTP-only cookie
    const token = generateToken(user._id);
    res.cookie("token", token, authCookieOptions);

    return res.json({
      message: "Login successful",
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────
router.post("/logout", protect, async (req, res) => {
  try {
    // Log logout
    await logActivity({
      user: req.user._id,
      action: "logout",
      entity: "user",
      entityId: req.user._id,
      details: { email: req.user.email, username: req.user.username },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Clear HTTP-only cookie
    res.clearCookie("token", clearAuthCookieOptions);

    return res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────
router.get("/me", protect, (req, res) => {
  return res.json({ data: req.user });
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────
// Send OTP for password reset
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: "User not found with this email" });
    }

    // Generate and store OTP for password reset
    const otp = generateOTP();
    const expiresAt = storeOTP(email, otp, 'forgot-password');

    // Send OTP email
    await sendOTPEmail(email, otp, 'forgot-password');

    return res.json({
      message: "Password reset OTP sent successfully",
      data: {
        email,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Failed to send password reset OTP" });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────
// Reset password with OTP
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required" });
    }

    // Verify OTP
    const result = verifyOTP(email, otp, 'forgot-password');

    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    // Log password reset
    await logActivity({
      user: user._id,
      action: "password_reset",
      entity: "user",
      entityId: user._id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/auth/verification-status ───────────────────────────────────
// Check if user's email is verified
router.get("/verification-status", protect, (req, res) => {
  return res.json({
    data: {
      isVerified: req.user.isVerified || false,
      email: req.user.email,
      emailVerifiedAt: req.user.emailVerifiedAt,
    },
  });
});

// ─── GET /api/auth/csrf-token ─────────────────────────────────────────────
// Get CSRF token for authenticated requests
router.get("/csrf-token", protect, getCSRFToken);

export default router;
