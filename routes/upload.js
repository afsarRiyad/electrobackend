import { Router } from "express";
import { protect } from "../utils/authMiddleware.js";
import { isAdmin } from "../utils/adminMiddleware.js";
import { uploadSingle, uploadMultiple, deleteImage, getPublicIdFromUrl } from "../utils/upload.js";

const router = Router();

// ─── POST /api/upload/single ──────────────────────────────────────────────────
// Upload single image (Admin only)
router.post("/single", protect, isAdmin, uploadSingle, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    return res.status(201).json({
      message: "Image uploaded successfully",
      data: {
        url: req.file.path,
        publicId: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (err) {
    console.error("Single upload error:", err);
    return res.status(500).json({ message: "Server error during upload" });
  }
});

// ─── POST /api/upload/multiple ────────────────────────────────────────────────
// Upload multiple images (Admin only)
router.post("/multiple", protect, isAdmin, uploadMultiple, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadedFiles = req.files.map((file) => ({
      url: file.path,
      publicId: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    }));

    return res.status(201).json({
      message: `${req.files.length} images uploaded successfully`,
      data: uploadedFiles,
    });
  } catch (err) {
    console.error("Multiple upload error:", err);
    return res.status(500).json({ message: "Server error during upload" });
  }
});

// ─── DELETE /api/upload/:publicId ─────────────────────────────────────────────
// Delete image from Cloudinary (Admin only)
router.delete("/:publicId", protect, isAdmin, async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({ message: "Public ID is required" });
    }

    const result = await deleteImage(publicId);

    if (result.success) {
      return res.json({ message: "Image deleted successfully" });
    } else {
      return res.status(500).json({ message: result.error || "Failed to delete image" });
    }
  } catch (err) {
    console.error("Delete image error:", err);
    return res.status(500).json({ message: "Server error during deletion" });
  }
});

// ─── POST /api/upload/delete-by-url ────────────────────────────────────────────
// Delete image by URL (Admin only)
router.post("/delete-by-url", protect, isAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: "Image URL is required" });
    }

    const publicId = getPublicIdFromUrl(url);
    
    if (!publicId) {
      return res.status(400).json({ message: "Could not extract public ID from URL" });
    }

    const result = await deleteImage(publicId);

    if (result.success) {
      return res.json({ message: "Image deleted successfully" });
    } else {
      return res.status(500).json({ message: result.error || "Failed to delete image" });
    }
  } catch (err) {
    console.error("Delete by URL error:", err);
    return res.status(500).json({ message: "Server error during deletion" });
  }
});

export default router;
