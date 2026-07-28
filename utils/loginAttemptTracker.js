// In-memory store for login attempts (in production, use Redis)
const loginAttempts = new Map();
const accountLockouts = new Map();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (data.expiresAt < now) {
      loginAttempts.delete(key);
    }
  }
  for (const [key, data] of accountLockouts.entries()) {
    if (data.expiresAt < now) {
      accountLockouts.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

/**
 * Check if IP or account is rate limited
 * Returns object with { allowed: boolean, delayMs: number, remainingAttempts: number }
 *
 * This function intentionally does not mutate the attempt counters. Counters are
 * updated only after a failed authentication so successful logins are never
 * treated as failed attempts.
 */
export const checkLoginAttempt = (identifier, type = 'ip') => {
  const key = `${type}:${identifier}`;
  const now = Date.now();
  
  // Check if account is locked
  if (type === 'account') {
    const lockout = accountLockouts.get(key);
    if (lockout && lockout.expiresAt > now) {
      return {
        allowed: false,
        locked: true,
        remainingTime: Math.ceil((lockout.expiresAt - now) / 1000),
        message: 'Account temporarily locked due to repeated failed attempts'
      };
    }
  }
  
  const attempts = loginAttempts.get(key);
  
  if (!attempts || attempts.expiresAt < now) {
    return { allowed: true, remainingAttempts: 5 };
  }
  
  const remainingAttempts = 5 - attempts.count;
  
  // Progressive delay calculation
  if (attempts.count >= 5) {
    // Lock account after 5 failed attempts
    if (type === 'account') {
      const lockDuration = Math.min(30 * 60 * 1000, Math.pow(2, attempts.count - 5) * 60 * 1000); // Max 30 minutes
      accountLockouts.set(key, {
        expiresAt: now + lockDuration,
        attemptCount: attempts.count
      });
      return {
        allowed: false,
        locked: true,
        remainingTime: Math.ceil(lockDuration / 1000),
        message: 'Account temporarily locked due to repeated failed attempts'
      };
    }
    
    // For IP-based, just block with delay
    const delayMs = Math.min(30000, Math.pow(2, attempts.count - 5) * 1000); // Max 30 second delay
    return {
      allowed: false,
      delayMs,
      message: 'Too many failed attempts. Please try again later.'
    };
  }
  
  // Add progressive delay after the 3rd and 4th failed attempts
  if (attempts.count >= 3) {
    const delayMs = (attempts.count - 2) * 1000; // 1s after 3rd, 2s after 4th failure
    return {
      allowed: true,
      delayMs,
      remainingAttempts,
      message: `${delayMs / 1000}s delay before next attempt`
    };
  }
  
  return { allowed: true, remainingAttempts };
};

/**
 * Record successful login to reset attempts
 */
export const recordSuccessfulLogin = (identifier, type = 'ip') => {
  const key = `${type}:${identifier}`;
  loginAttempts.delete(key);
  
  if (type === 'account') {
    accountLockouts.delete(key);
  }
};

/**
 * Record failed login attempt
 */
export const recordFailedLogin = (identifier, type = 'ip') => {
  const key = `${type}:${identifier}`;
  const now = Date.now();
  
  const attempts = loginAttempts.get(key);
  if (!attempts || attempts.expiresAt < now) {
    loginAttempts.set(key, {
      count: 1,
      expiresAt: now + (15 * 60 * 1000),
      firstAttempt: now
    });
  } else {
    attempts.count += 1;
    loginAttempts.set(key, attempts);
  }
};

/**
 * Middleware to check login attempts before processing
 */
export const loginAttemptMiddleware = async (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { username } = req.body;
  
  // Check IP-based rate limiting
  const ipCheck = checkLoginAttempt(ip, 'ip');
  if (!ipCheck.allowed) {
    if (ipCheck.locked) {
      return res.status(429).json({
        message: ipCheck.message,
        remainingTime: ipCheck.remainingTime
      });
    }
    if (ipCheck.delayMs) {
      return res.status(429).json({
        message: ipCheck.message,
        retryAfter: Math.ceil(ipCheck.delayMs / 1000)
      });
    }
    return res.status(429).json({ message: ipCheck.message });
  }
  
  // If username provided, also check account-based rate limiting
  let accountCheck = null;
  if (username) {
    accountCheck = checkLoginAttempt(username.toLowerCase().trim(), 'account');
    if (!accountCheck.allowed) {
      if (accountCheck.locked) {
        return res.status(423).json({
          message: accountCheck.message,
          remainingTime: accountCheck.remainingTime
        });
      }
      return res.status(429).json({ message: accountCheck.message });
    }
  }
  
  // Attach check results to request for use in route handlers
  req.loginAttemptCheck = { ip: ipCheck, account: accountCheck };
  next();
};

/**
 * Middleware to record successful login
 */
export const recordLoginSuccess = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const ip = req.ip || req.connection.remoteAddress;
      const { username } = req.body;
      
      recordSuccessfulLogin(ip, 'ip');
      if (username) {
        recordSuccessfulLogin(username.toLowerCase().trim(), 'account');
      }
    }
    return originalJson(data);
  };
  next();
};
