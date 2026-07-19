import { Router } from "express";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";
import { Message, User } from "../../utils/models.js";
import { validateMessage } from "../../utils/validation.js";

const router = Router();

// ─── GET /api/admin/inbox ───────────────────────────────────────────────────────
// Get all messages for admin (including messages sent to all admins)
router.get("/", protect, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, category, search } = req.query;
    
    const query = {
      $or: [
        { recipient: req.user._id }, // Messages sent directly to this admin
        { recipient: null }, // Messages sent to all admins
      ],
      isArchived: false,
    };

    // Filter by read status
    if (status === "unread") query.isRead = false;
    if (status === "read") query.isRead = true;

    // Filter by priority
    if (priority) query.priority = priority;

    // Filter by category
    if (category) query.category = category;

    // Search in subject and body
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [messages, total] = await Promise.all([
      Message.find(query)
        .populate("sender", "username email avatar")
        .populate("recipient", "username email avatar")
        .populate("relatedOrder", "orderNumber status")
        .populate("replyTo", "subject")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Message.countDocuments(query),
    ]);

    const unreadCount = await Message.countDocuments({
      $or: [{ recipient: req.user._id }, { recipient: null }],
      isRead: false,
      isArchived: false,
    });

    return res.json({
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      unreadCount,
    });
  } catch (err) {
    console.error("Get inbox error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/inbox/:id ─────────────────────────────────────────────────────
// Get a single message by ID
router.get("/:id", protect, isAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate("sender", "username email avatar")
      .populate("recipient", "username email avatar")
      .populate("relatedOrder", "orderNumber status")
      .populate("replyTo", "subject body sender");

    if (!message) return res.status(404).json({ message: "Message not found" });

    // Check if admin has access to this message
    const hasAccess = 
      message.recipient?.equals(req.user._id) || 
      message.recipient === null ||
      message.sender.equals(req.user._id);

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.json({ data: message });
  } catch (err) {
    console.error("Get message error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/inbox ────────────────────────────────────────────────────────
// Send a new message
router.post("/", protect, isAdmin, validateMessage, async (req, res) => {
  try {
    const { recipient, subject, body, priority, category, relatedOrder, replyTo } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ message: "Subject and body are required" });
    }

    // If recipient is provided, verify it's a valid user
    if (recipient) {
      const recipientUser = await User.findById(recipient);
      if (!recipientUser) {
        return res.status(404).json({ message: "Recipient not found" });
      }
    }

    const message = await Message.create({
      sender: req.user._id,
      recipient: recipient || null, // null means send to all admins
      subject,
      body,
      priority: priority || "normal",
      category: category || "general",
      relatedOrder: relatedOrder || null,
      replyTo: replyTo || null,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "username email avatar")
      .populate("recipient", "username email avatar")
      .populate("relatedOrder", "orderNumber status")
      .populate("replyTo", "subject");

    return res.status(201).json({ message: "Message sent", data: populatedMessage });
  } catch (err) {
    console.error("Send message error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/admin/inbox/:id/read ──────────────────────────────────────────────
// Mark a message as read
router.patch("/:id/read", protect, isAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) return res.status(404).json({ message: "Message not found" });

    // Check if admin has access to this message
    const hasAccess = 
      message.recipient?.equals(req.user._id) || 
      message.recipient === null;

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    message.isRead = true;
    await message.save();

    return res.json({ message: "Message marked as read", data: message });
  } catch (err) {
    console.error("Mark as read error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/admin/inbox/:id/unread ────────────────────────────────────────────
// Mark a message as unread
router.patch("/:id/unread", protect, isAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) return res.status(404).json({ message: "Message not found" });

    // Check if admin has access to this message
    const hasAccess = 
      message.recipient?.equals(req.user._id) || 
      message.recipient === null;

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    message.isRead = false;
    await message.save();

    return res.json({ message: "Message marked as unread", data: message });
  } catch (err) {
    console.error("Mark as unread error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/admin/inbox/:id/archive ───────────────────────────────────────────
// Archive a message
router.patch("/:id/archive", protect, isAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) return res.status(404).json({ message: "Message not found" });

    // Check if admin has access to this message
    const hasAccess = 
      message.recipient?.equals(req.user._id) || 
      message.recipient === null ||
      message.sender.equals(req.user._id);

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    message.isArchived = true;
    await message.save();

    return res.json({ message: "Message archived", data: message });
  } catch (err) {
    console.error("Archive message error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/admin/inbox/:id/unarchive ─────────────────────────────────────────
// Unarchive a message
router.patch("/:id/unarchive", protect, isAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) return res.status(404).json({ message: "Message not found" });

    // Check if admin has access to this message
    const hasAccess = 
      message.recipient?.equals(req.user._id) || 
      message.recipient === null ||
      message.sender.equals(req.user._id);

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    message.isArchived = false;
    await message.save();

    return res.json({ message: "Message unarchived", data: message });
  } catch (err) {
    console.error("Unarchive message error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/admin/inbox/:id ────────────────────────────────────────────────
// Delete a message permanently
router.delete("/:id", protect, isAdmin, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) return res.status(404).json({ message: "Message not found" });

    // Check if admin has access to this message
    const hasAccess = 
      message.recipient?.equals(req.user._id) || 
      message.recipient === null ||
      message.sender.equals(req.user._id);

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Message.findByIdAndDelete(req.params.id);

    return res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("Delete message error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/inbox/archived ───────────────────────────────────────────────
// Get archived messages
router.get("/archived/list", protect, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const query = {
      $or: [
        { recipient: req.user._id },
        { recipient: null },
      ],
      isArchived: true,
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [messages, total] = await Promise.all([
      Message.find(query)
        .populate("sender", "username email avatar")
        .populate("recipient", "username email avatar")
        .populate("relatedOrder", "orderNumber status")
        .populate("replyTo", "subject")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Message.countDocuments(query),
    ]);

    return res.json({
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Get archived messages error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/inbox/sent ────────────────────────────────────────────────────
// Get sent messages
router.get("/sent/list", protect, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const query = {
      sender: req.user._id,
      isArchived: false,
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [messages, total] = await Promise.all([
      Message.find(query)
        .populate("sender", "username email avatar")
        .populate("recipient", "username email avatar")
        .populate("relatedOrder", "orderNumber status")
        .populate("replyTo", "subject")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Message.countDocuments(query),
    ]);

    return res.json({
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Get sent messages error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/admin/inbox/mark-all-read ─────────────────────────────────────────
// Mark all messages as read
router.patch("/mark-all-read/bulk", protect, isAdmin, async (req, res) => {
  try {
    await Message.updateMany(
      {
        $or: [
          { recipient: req.user._id },
          { recipient: null },
        ],
        isRead: false,
        isArchived: false,
      },
      { isRead: true }
    );

    return res.json({ message: "All messages marked as read" });
  } catch (err) {
    console.error("Mark all as read error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
