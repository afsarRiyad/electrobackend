import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { User } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";
import { validateLogin, validateSignup } from "../utils/validation.js";
import { logActivity } from "../utils/activityLog.js";
import { loginAttemptMiddleware, recordSuccessfulLogin, recordFailedLogin } from "../utils/loginAttemptTracker.js";
import { getCSRFToken, csrfProtection } from "../utils/csrfProtection.js";

const router = Router();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

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

    // Create user
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
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

    return res.status(201).json({
      message: "User created successfully",
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
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
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

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
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

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

// ─── GET /api/auth/csrf-token ─────────────────────────────────────────────
// Get CSRF token for authenticated requests
router.get("/csrf-token", protect, getCSRFToken);

export default router;
