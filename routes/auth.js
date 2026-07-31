import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Router } from "express";
import { User } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";
import { sendPasswordResetEmail, sendOTPEmail } from "../utils/email.js";
import { validateSignup, validateLogin } from "../utils/validation.js";
import { passport, generateToken as oauthGenerateToken } from "../utils/oauth.js";
import { generateOTP, validateOTP, generateOTPExpiry } from "../utils/otp.js";

const router = Router();

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "15m", // Short-lived access token
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: "7d", // Long-lived refresh token
  });
};

// Validation helpers
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  return { valid: true };
};

const validateUsername = (username) => {
  if (username.length < 3) {
    return { valid: false, message: "Username must be at least 3 characters" };
  }
  if (username.length > 20) {
    return { valid: false, message: "Username must be less than 20 characters" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: "Username can only contain letters, numbers, and underscores" };
  }
  return { valid: true };
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
router.post("/signup", validateSignup, async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate username
    const usernameValidation = validateUsername(username.trim());
    if (!usernameValidation.valid) {
      return res.status(400).json({ message: usernameValidation.message });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // Check if user exists
    const userExists = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { username: username.trim() }
      ],
    });

    if (userExists) {
      return res.status(400).json({ message: "User already exists with this email or username" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = generateOTPExpiry();

    // Create user
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      otp,
      otpExpires,
    });

    // Send OTP email (non-blocking - don't await)
    sendOTPEmail(user.email, otp, user.username).catch(err => {
      console.error("Failed to send OTP email:", err);
    });

    if (user) {
      // Generate tokens for immediate login after signup
      const accessToken = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Store refresh token in user document
      user.refreshTokens.push({
        token: refreshToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        userAgent: req.get("user-agent"),
        ipAddress: req.ip,
      });
      await user.save();

      // Set refresh token as HTTP-only cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });

      return res.status(201).json({
        success: true,
        error: false,
        message: "Signup successful. Please check your email for OTP verification.",
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          isVerified: user.isVerified,
          accessToken,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid user data"
      });
    }
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Server error during registration" });
  }
});

// @desc    Authenticate user & get token (login)
// @route   POST /api/auth/login
// @access  Public
router.post("/login", validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body || {}; // username can be email or username (userhandle)

    if (!username || !password) {
      return res.status(400).json({ message: "Please enter username/email and password" });
    }

    // Find by username or email
    const user = await User.findOne({
      $or: [
        { email: username.toLowerCase().trim() },
        { username: username.trim() }
      ],
    });

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        error: true,
        message: "User not found"
      });
    }

    // Check password
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        error: true,
        message: "Incorrect password"
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in user document
    user.refreshTokens.push({
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    });
    await user.save();

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    return res.json({
      success: true,
      error: false,
      message: user.isVerified ? "Login successful" : "Login successful. Please verify your email for full access.",
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        isVerified: user.isVerified,
        accessToken, // Send access token in response
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
});

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
router.get("/me", protect, async (req, res) => {
  // Return only safe user data, exclude sensitive fields
  const safeUserData = {
    _id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    role: req.user.role,
    status: req.user.status,
    avatar: req.user.avatar,
    isVerified: req.user.isVerified,
    emailVerifiedAt: req.user.emailVerifiedAt,
    phone: req.user.phone,
    companyName: req.user.companyName,
    billingAddress: req.user.billingAddress,
    shippingAddress: req.user.shippingAddress,
    createdAt: req.user.createdAt,
    updatedAt: req.user.updatedAt,
  };
  
  return res.json({ data: safeUserData });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
router.post("/logout", async (req, res) => {
  try {
    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      path: "/",
    });

    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Server error during logout" });
  }
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
router.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    // Find user with this refresh token
    const user = await User.findOne({
      _id: decoded.id,
      "refreshTokens.token": refreshToken,
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Check if refresh token is expired
    const tokenData = user.refreshTokens.find(
      (t) => t.token === refreshToken
    );

    if (!tokenData || new Date(tokenData.expiresAt) < new Date()) {
      // Remove expired token
      user.refreshTokens = user.refreshTokens.filter(
        (t) => t.token !== refreshToken
      );
      await user.save();
      return res.status(401).json({ message: "Refresh token expired" });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id);

    // Token rotation: generate new refresh token
    const newRefreshToken = generateRefreshToken(user._id);

    // Remove old refresh token and add new one
    user.refreshTokens = user.refreshTokens.filter(
      (t) => t.token !== refreshToken
    );
    user.refreshTokens.push({
      token: newRefreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    });
    await user.save();

    // Set new refresh token as HTTP-only cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    return res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Refresh token expired" });
    }
    return res.status(500).json({ message: "Server error during token refresh" });
  }
});

// @desc    Forgot password - Request reset token
// @route   POST /api/auth/forgot-password
// @access  Public
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Please provide your email" });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: "User not found with this email" });
    }

    // Generate token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Save token and expiration to DB
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(user.email, resetToken, user.username);
    
    if (!emailResult.success) {
      console.error("Failed to send password reset email:", emailResult.error);
      // Still return success to avoid exposing email issues to users
      // Log the error for debugging
    }

    return res.json({
      message: "Password reset email sent successfully",
      info: "Please check your email for the password reset link"
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Server error during forgot password" });
  }
});

// @desc    Reset password using token
// @route   POST /api/auth/reset-password
// @access  Public
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // Find user by token and check expiration
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired password reset token" });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Server error during password reset" });
  }
});

// @desc    Change password (authenticated)
// @route   PUT /api/auth/change-password
// @access  Private
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // Find the user (password is not excluded when using findById unless projected out)
    const user = await User.findById(req.user._id);

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Server error during password change" });
  }
});

// @desc    Verify email with OTP (public - requires email)
// @route   POST /api/auth/verify-otp
// @access  Public
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    const validation = validateOTP(otp, user.otp, user.otpExpires);

    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    user.emailVerifiedAt = new Date();
    await user.save();

    res.json({
      success: true,
      error: false,
      message: "Email verified successfully"
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Server error during OTP verification" });
  }
});

// @desc    Resend OTP (authenticated)
// @route   POST /api/auth/resend-otp
// @access  Private
router.post("/resend-otp", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = generateOTPExpiry();

    // Update user with new OTP
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Send OTP email (non-blocking)
    sendOTPEmail(user.email, otp, user.username).catch(err => {
      console.error("Failed to send OTP email:", err);
    });

    res.json({
      success: true,
      error: false,
      message: "OTP sent successfully"
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Server error during OTP resend" });
  }
});

// @desc    Verify email with OTP (authenticated - only requires OTP)
// @route   POST /api/auth/verify-otp/me
// @access  Private
router.post("/verify-otp/me", protect, async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: "OTP is required" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    const validation = validateOTP(otp, user.otp, user.otpExpires);

    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    user.emailVerifiedAt = new Date();
    await user.save();

    res.json({
      success: true,
      error: false,
      message: "Email verified successfully"
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Server error during OTP verification" });
  }
});

// ─── Google OAuth Routes ───────────────────────────────────────────────────────
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  (req, res, next) => {
    console.log("Google callback received:", req.query);
    console.log("CLIENT_URL:", process.env.CLIENT_URL);
    next();
  },
  passport.authenticate("google", { failureRedirect: "/login", session: false }),
  (req, res) => {
    const token = oauthGenerateToken(req.user._id);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    console.log("Redirecting to:", `${clientUrl}/auth/callback?token=${token}`);
    res.redirect(`${clientUrl}/auth/callback?token=${token}`);
  }
);

// ─── Apple OAuth Routes ─────────────────────────────────────────────────────────
router.get("/apple", passport.authenticate("apple", { scope: ["email", "name"] }));

router.post(
  "/apple/callback",
  passport.authenticate("apple", { failureRedirect: "/login", session: false }),
  (req, res) => {
    const token = oauthGenerateToken(req.user._id);
    res.json({ token, user: req.user });
  }
);

export default router;
