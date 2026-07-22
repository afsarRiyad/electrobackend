import { body, param, query, validationResult } from "express-validator";

// Validation middleware handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

// Auth validation
export const validateSignup = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3-30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email required")
    .isLength({ max: 100 })
    .withMessage("Email too long"),
  body("password")
    .custom((value) => {
      if (!value) {
        throw new Error("Password fields are required");
      }
      if (value.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        throw new Error("Password must contain at least one uppercase letter, one lowercase letter, and one number");
      }
      return true;
    }),
  body("confirmPassword")
    .custom((value, { req }) => {
      // If password is provided but confirmPassword is empty
      if (req.body.password && !value) {
        throw new Error("Please confirm your password");
      }
      // If both are provided, they must match
      if (req.body.password && value && value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
  body("agreeToTerms")
    .notEmpty()
    .withMessage("You must agree to the terms and conditions")
    .custom((value) => {
      if (value !== true && value !== "true") {
        throw new Error("You must agree to the terms and conditions");
      }
      return true;
    }),
  handleValidationErrors,
];

export const validateLogin = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username or email required"),
  body("password")
    .notEmpty()
    .withMessage("Password required"),
  handleValidationErrors,
];

// Product validation
export const validateProductQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Min price must be a positive number"),
  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Max price must be a positive number"),
  handleValidationErrors,
];

export const validateProductId = [
  param("idOrSlug")
    .notEmpty()
    .withMessage("Product ID or slug required"),
  handleValidationErrors,
];

// Order validation
export const validateOrderCreate = [
  body("customerName")
    .trim()
    .notEmpty()
    .withMessage("Customer name required"),
  body("customerEmail")
    .trim()
    .isEmail()
    .withMessage("Valid email required"),
  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item required"),
  body("items.*.productId")
    .notEmpty()
    .withMessage("Product ID required"),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
  body("totalAmount")
    .isFloat({ min: 0 })
    .withMessage("Total amount must be positive"),
  handleValidationErrors,
];

// Admin validation
export const validateAdminProduct = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name required"),
  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be positive"),
  body("stock")
    .isInt({ min: 0 })
    .withMessage("Stock must be non-negative"),
  handleValidationErrors,
];

export const validateUserId = [
  param("id")
    .isMongoId()
    .withMessage("Valid user ID required"),
  handleValidationErrors,
];

// Message validation
export const validateMessage = [
  body("subject")
    .trim()
    .notEmpty()
    .isLength({ max: 200 })
    .withMessage("Subject required (max 200 characters)"),
  body("body")
    .trim()
    .notEmpty()
    .withMessage("Message body required"),
  body("priority")
    .optional()
    .isIn(["low", "normal", "high", "urgent"])
    .withMessage("Invalid priority"),
  body("category")
    .optional()
    .isIn(["general", "support", "order", "payment", "other"])
    .withMessage("Invalid category"),
  handleValidationErrors,
];
