import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer to use memory storage
const storage = multer.memoryStorage();

// File filter to validate image types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed."), false);
  }
};

// Configure Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5, // Maximum 5 files at once
  },
});

// Helper function to upload buffer to Cloudinary
const uploadToCloudinary = (buffer, folder = "techmart/products") => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { 
        folder: folder,
        allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });
};

// Single image upload middleware with Cloudinary upload
export const uploadSingle = async (req, res, next) => {
  upload.single("image")(req, res, async (err) => {
    if (err) return next(err);
    
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer);
        req.file.cloudinaryResult = result;
        req.file.path = result.secure_url;
        req.file.filename = result.public_id;
      } catch (error) {
        return next(error);
      }
    }
    next();
  });
};

// Multiple images upload middleware with Cloudinary upload
export const uploadMultiple = async (req, res, next) => {
  upload.array("images", 5)(req, res, async (err) => {
    if (err) return next(err);
    
    if (req.files && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map(file => 
          uploadToCloudinary(file.buffer)
        );
        const results = await Promise.all(uploadPromises);
        
        req.files = req.files.map((file, index) => ({
          ...file,
          cloudinaryResult: results[index],
          path: results[index].secure_url,
          filename: results[index].public_id,
        }));
      } catch (error) {
        return next(error);
      }
    }
    next();
  });
};

// Delete image from Cloudinary
export const deleteImage = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    return { success: false, error: error.message };
  }
};

// Extract public ID from Cloudinary URL
export const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  try {
    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{folder}/{public_id}.{format}
    const parts = url.split("/");
    const filename = parts[parts.length - 1];
    const publicId = filename.split(".")[0];
    
    // Include folder in public ID
    const folderIndex = parts.indexOf("upload") + 1;
    const folder = parts.slice(folderIndex, -1).join("/");
    
    return folder ? `${folder}/${publicId}` : publicId;
  } catch (error) {
    console.error("Error extracting public ID from URL:", error);
    return null;
  }
};

export default upload;
