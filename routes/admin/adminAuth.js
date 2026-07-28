import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { User } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";
import { logActivity } from "../../utils/activityLog.js";
import { loginAttemptMiddleware, recordSuccessfulLogin, recordFailedLogin } from "../../utils/loginAttemptTracker.js";
import { getCSRFToken, csrfProtection } from "../../utils/csrfProtection.js";
import { validateLogin } from "../../utils/validation.js";

const router = Router();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ─── POST /api/admin/auth/login ───────────────────────────────────────────────
// Admin login — verifies role === 'admin'
router.post("/login", loginAttemptMiddleware, validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    
    if (!username || !password)
      return res.status(400).json({ message: "Username/email and password are required" });

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
        details: { reason: "user_not_found", identifier: username, type: "admin" },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    if (user.role !== "admin") {
      await logActivity({
        user: user._id,
        action: "login_failure",
        entity: "user",
        entityId: user._id,
        details: { reason: "not_admin", role: user.role },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      return res.status(403).json({ message: "Access denied. Admin account required." });
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
        details: { reason: "invalid_password", type: "admin" },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Record successful login to reset attempts
    recordSuccessfulLogin(req.ip || req.connection.remoteAddress, 'ip');
    recordSuccessfulLogin(username.toLowerCase().trim(), 'account');

    // Log successful admin login
    await logActivity({
      user: user._id,
      action: "login_success",
      entity: "user",
      entityId: user._id,
      details: { email: user.email, username: user.username, role: user.role, type: "admin" },
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
      message: "Admin login successful",
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/auth/me ───────────────────────────────────────────────────
router.get("/me", protect, isAdmin, (req, res) => {
  return res.json({ data: req.user });
});

// ─── PUT /api/admin/auth/profile ──────────────────────────────────────────────
// Update admin's own profile
router.put("/profile", protect, isAdmin, csrfProtection, async (req, res) => {
  try {
    const allowed = ["username", "email", "avatar", "phone", "address"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Handle password change inline
    if (req.body.newPassword) {
      if (!req.body.currentPassword)
        return res.status(400).json({ message: "Current password required" });
      const user = await User.findById(req.user._id);
      const ok = await bcrypt.compare(req.body.currentPassword, user.password);
      if (!ok) return res.status(400).json({ message: "Incorrect current password" });
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(req.body.newPassword, salt);
    }

    const updated = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
      select: "-password",
    });

    return res.json({ message: "Profile updated", data: updated });
  } catch (err) {
    console.error("Admin profile update error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/auth/make-admin ─────────────────────────────────────────
// Promote any user to admin (admin only)
router.post("/make-admin", protect, isAdmin, csrfProtection, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const existingUser = await User.findById(userId).select("-password");
    if (!existingUser) return res.status(404).json({ message: "User not found" });

    const previousRole = existingUser.role;
    const user = await User.findByIdAndUpdate(
      userId,
      { role: "admin" },
      { new: true, runValidators: true, select: "-password" }
    );

    // Log role change
    await logActivity({
      user: req.user._id,
      action: "role_change",
      entity: "user",
      entityId: userId,
      details: { 
        previousRole,
        newRole: "admin",
        targetUser: user.username 
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.json({ message: `${user.username} is now an admin`, data: user });
  } catch (err) {
    console.error("Make-admin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/auth/revoke-admin ───────────────────────────────────────
// Revoke admin role (admin only)
router.post("/revoke-admin", protect, isAdmin, csrfProtection, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ message: "userId is required" });
    if (userId === String(req.user._id))
      return res.status(400).json({ message: "You cannot revoke your own admin role" });

    const user = await User.findByIdAndUpdate(
      userId,
      { role: "user" },
      { new: true, select: "-password" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    // Log role change
    await logActivity({
      user: req.user._id,
      action: "role_change",
      entity: "user",
      entityId: userId,
      details: { 
        previousRole: "admin", 
        newRole: "user",
        targetUser: user.username 
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.json({ message: `${user.username} admin role revoked`, data: user });
  } catch (err) {
    console.error("Revoke-admin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/auth/logout ───────────────────────────────────────────────
// Admin logout
router.post("/logout", protect, isAdmin, async (req, res) => {
  try {
    // Log logout
    await logActivity({
      user: req.user._id,
      action: "logout",
      entity: "user",
      entityId: req.user._id,
      details: { 
        email: req.user.email, 
        username: req.user.username,
        role: req.user.role 
      },
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
    console.error("Admin logout error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/auth/csrf-token ───────────────────────────────────────────
// Get CSRF token for authenticated admin requests
router.get("/csrf-token", protect, isAdmin, getCSRFToken);

export default router;
