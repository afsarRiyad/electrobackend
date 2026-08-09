// Custom error classes for better error handling
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

class OrderError extends AppError {
  constructor(message, statusCode = 400, errorCode = 'ORDER_ERROR') {
    super(message, statusCode, errorCode);
  }
}

class PaymentError extends AppError {
  constructor(message, statusCode = 400, errorCode = 'PAYMENT_ERROR') {
    super(message, statusCode, errorCode);
  }
}

class StockError extends AppError {
  constructor(message, product = null) {
    super(message, 400, 'STOCK_ERROR');
    this.product = product;
  }
}

class CouponError extends AppError {
  constructor(message, statusCode = 400, errorCode = 'COUPON_ERROR') {
    super(message, statusCode, errorCode);
  }
}

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    statusCode: err.statusCode,
    errorCode: err.errorCode,
    name: err.name,
    stack: isDevelopment ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.errorCode || 'INTERNAL_ERROR';

  // Handle specific error types - preserve custom messages for our custom errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    // Don't override custom message for ValidationError
    if (!err.message || err.message === 'Validation Error') {
      message = 'Validation Error';
    }
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    const field = Object.keys(err.keyPattern || {})[0];
    message = `${field} already exists`;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Token expired';
  } else if (err.status === 429) {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
    message = err.message || 'Too many requests';
  } else if (err.errorCode === 'COUPON_ERROR') {
    // Always preserve coupon error messages
    statusCode = 400;
    errorCode = 'COUPON_ERROR';
    message = err.message; // Keep the custom coupon message
  } else if (err.errorCode === 'STOCK_ERROR') {
    // Always preserve stock error messages
    statusCode = 400;
    errorCode = 'STOCK_ERROR';
    message = err.message; // Keep the custom stock message
  } else if (err.errorCode === 'ORDER_ERROR') {
    // Always preserve order error messages
    statusCode = err.statusCode || 400;
    errorCode = 'ORDER_ERROR';
    message = err.message; // Keep the custom order message
  }

  // Send error response
  const errorResponse = {
    success: false,
    message,
    errorCode,
  };

  // Add validation errors specifically
  if (err.name === 'ValidationError') {
    errorResponse.errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Add additional details in development
  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details || null;
  }

  // Add field-specific errors if available
  if (err.field) {
    errorResponse.field = err.field;
  }

  // Add product info for stock errors
  if (err.product) {
    errorResponse.product = err.product;
  }

  res.status(statusCode).json(errorResponse);
};

// Async handler wrapper to catch errors in async functions
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  OrderError,
  PaymentError,
  StockError,
  CouponError,
  errorHandler,
  asyncHandler,
};
