import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { User } from "../utils/models.js";
import { protect } from "../utils/authMiddleware.js";

const router = Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
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

    // Create user
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
    });

    if (user) {
      return res.status(201).json({
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          token: generateToken(user._id),
        },
      });
    } else {
      return res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Server error during registration" });
  }
});

// @desc    Authenticate user & get token (login)
// @route   POST /api/auth/login
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body; // username can be email or username (userhandle)

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

    if (user && (await bcrypt.compare(password, user.password))) {
      return res.json({
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          token: generateToken(user._id),
        },
      });
    } else {
      return res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
});

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
router.get("/me", protect, async (req, res) => {
  return res.json({ data: req.user });
});

export default router;
