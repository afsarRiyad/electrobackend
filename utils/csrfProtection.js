import crypto from 'crypto';

// In-memory store for CSRF tokens (in production, use Redis)
const csrfTokens = new Map();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of csrfTokens.entries()) {
    if (data.expiresAt < now) {
      csrfTokens.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Generate CSRF token
 */
export const generateCSRFToken = (sessionId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  csrfTokens.set(token, {
    sessionId,
    expiresAt,
    createdAt: Date.now()
  });
  
  return token;
};

/**
 * Validate CSRF token
 */
export const validateCSRFToken = (token, sessionId) => {
  const tokenData = csrfTokens.get(token);
  
  if (!tokenData) {
    return false;
  }
  
  if (tokenData.expiresAt < Date.now()) {
    csrfTokens.delete(token);
    return false;
  }
  
  if (tokenData.sessionId !== sessionId) {
    return false;
  }
  
  // Token is valid, remove it (single-use)
  csrfTokens.delete(token);
  return true;
};

/**
 * CSRF protection middleware for state-changing requests
 * This middleware checks for CSRF token in headers for POST, PUT, PATCH, DELETE requests
 */
export const csrfProtection = (req, res, next) => {
  // Only apply to state-changing methods
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }
  
  // Skip if request is from same origin (already handled by CORS)
  // But still validate CSRF token for additional protection
  
  const csrfToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  const sessionId = req.user?._id?.toString() || req.ip;
  
  if (!csrfToken) {
    return res.status(403).json({
      message: 'CSRF token is required for state-changing requests'
    });
  }
  
  if (!validateCSRFToken(csrfToken, sessionId)) {
    return res.status(403).json({
      message: 'Invalid or expired CSRF token'
    });
  }
  
  next();
};

/**
 * Middleware to generate CSRF token and send it in response
 */
export const getCSRFToken = (req, res) => {
  const sessionId = req.user?._id?.toString() || req.ip;
  const token = generateCSRFToken(sessionId);
  
  return res.json({
    csrfToken: token
  });
};
