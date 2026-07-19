import { Router } from "express";
import { Customer, Order } from "../../utils/models.js";
import { protect } from "../../utils/authMiddleware.js";
import { isAdmin } from "../../utils/adminMiddleware.js";

const router = Router();
const guard = [protect, isAdmin];

// ─── GET /api/admin/customers ─────────────────────────────────────────────────
router.get("/", ...guard, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Customer.countDocuments(filter),
    ]);

    return res.json({
      data: customers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("List customers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/customers/:id ────────────────────────────────────────────
router.get("/:id", ...guard, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    return res.json({ data: customer });
  } catch (err) {
    console.error("Get customer error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/admin/customers ────────────────────────────────────────────────
router.post("/", ...guard, async (req, res) => {
  try {
    const { name, email, phone, avatar, address, status, notes } = req.body || {};
    if (!name || !email)
      return res.status(400).json({ message: "name and email are required" });

    const exists = await Customer.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ message: "Customer with this email already exists" });

    const customer = await Customer.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone,
      avatar,
      address,
      status: status || "active",
      notes,
    });

    return res.status(201).json({ message: "Customer created", data: customer });
  } catch (err) {
    console.error("Create customer error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/admin/customers/:id ─────────────────────────────────────────────
router.put("/:id", ...guard, async (req, res) => {
  try {
    const allowed = ["name", "email", "phone", "avatar", "address", "status", "notes"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    return res.json({ message: "Customer updated", data: customer });
  } catch (err) {
    console.error("Update customer error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/admin/customers/:id ──────────────────────────────────────────
router.delete("/:id", ...guard, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    return res.json({ message: "Customer deleted" });
  } catch (err) {
    console.error("Delete customer error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /api/admin/customers/:id/orders ─────────────────────────────────────
// All orders belonging to a customer
router.get("/:id/orders", ...guard, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find({ customer: req.params.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Order.countDocuments({ customer: req.params.id }),
    ]);

    return res.json({
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("Customer orders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PUT /api/admin/customers/:id/status ─────────────────────────────────────
router.put("/:id/status", ...guard, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["active", "inactive", "blocked"].includes(status))
      return res.status(400).json({ message: "Invalid status value" });

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    return res.json({ message: `Customer status updated to ${status}`, data: customer });
  } catch (err) {
    console.error("Customer status error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
