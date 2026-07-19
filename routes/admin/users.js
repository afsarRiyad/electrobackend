import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";

const router = Router();
const guard = [protect, isAdmin];

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// List users — paginated, searchable, filterable
router.get("/", ...guard, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      role,
      status,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) filter.role = role;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password -resetPasswordToken -resetPasswordExpire")
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({
      data: users,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("List users error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/users/:id ─────────────────────────────────────────────────
router.get("/:id", ...guard, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -resetPasswordToken -resetPasswordExpire")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ data: user });
  } catch (err) {
    console.error("Get user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/users ────────────────────────────────────────────────────
// Create a new user (admin can set role)
router.post("/", ...guard, async (req, res) => {
  try {
    const { username, email, password, role = "user", status = "active", phone, address, avatar } = req.body || {};
    if (!username || !email || !password)
      return res.status(400).json({ message: "username, email and password are required" });

    const exists = await User.findOne({ $or: [{ email: email.toLowerCase().trim() }, { username: username.trim() }] });
    if (exists) return res.status(400).json({ message: "User already exists with this email or username" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      role,
      status,
      phone,
      address,
      avatar,
    });

    const { password: _, ...userData } = user.toObject();
    return res.status(201).json({ message: "User created", data: userData });
  } catch (err) {
    console.error("Create user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/admin/users/:id ─────────────────────────────────────────────────
// Update user details (role, status, profile)
router.put("/:id", ...guard, async (req, res) => {
  try {
    const allowed = ["username", "email", "role", "status", "avatar", "phone", "address"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Optional: reset password by admin
    if (req.body.newPassword) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(req.body.newPassword, salt);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
      select: "-password -resetPasswordToken -resetPasswordExpire",
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ message: "User updated", data: user });
  } catch (err) {
    console.error("Update user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/admin/users/:id ──────────────────────────────────────────────
router.delete("/:id", ...guard, async (req, res) => {
  try {
    if (req.params.id === String(req.user._id))
      return res.status(400).json({ message: "You cannot delete your own account" });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/admin/users/:id/status ─────────────────────────────────────────
// Quick activate / suspend toggle
router.put("/:id/status", ...guard, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["active", "suspended"].includes(status))
      return res.status(400).json({ message: "status must be 'active' or 'suspended'" });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, select: "-password" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ message: `User ${status}`, data: user });
  } catch (err) {
    console.error("User status update error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
