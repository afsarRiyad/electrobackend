import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { User } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";

const router = Router();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ─── POST /api/admin/auth/login ───────────────────────────────────────────────
// Admin login — verifies role === 'admin'
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    
    if (!username || !password)
      return res.status(400).json({ message: "Username/email and password are required" });

    const user = await User.findOne({
      $or: [{ email: username.toLowerCase().trim() }, { username: username.trim() }],
    });

    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (user.role !== "admin")
      return res.status(403).json({ message: "Access denied. Admin account required." });
    if (user.status === "suspended")
      return res.status(403).json({ message: "Account suspended. Contact support." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    return res.json({
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        token: generateToken(user._id),
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
router.put("/profile", protect, isAdmin, async (req, res) => {
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
router.post("/make-admin", protect, isAdmin, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const user = await User.findByIdAndUpdate(
      userId,
      { role: "admin" },
      { new: true, select: "-password" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ message: `${user.username} is now an admin`, data: user });
  } catch (err) {
    console.error("Make-admin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/auth/revoke-admin ───────────────────────────────────────
// Revoke admin role (admin only)
router.post("/revoke-admin", protect, isAdmin, async (req, res) => {
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

    return res.json({ message: `${user.username} admin role revoked`, data: user });
  } catch (err) {
    console.error("Revoke-admin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
