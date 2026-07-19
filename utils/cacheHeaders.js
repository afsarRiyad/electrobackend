// Cache header middleware for different types of responses
export const cacheHeaders = (duration) => {
  return (req, res, next) => {
    // Don't cache if user is authenticated (personalized content)
    if (req.headers.authorization) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return next();
    }

    // Apply cache duration
    res.setHeader("Cache-Control", `public, max-age=${duration}`);
    next();
  };
};

// Static content cache (1 hour)
export const staticCache = cacheHeaders(3600);

// API data cache (5 minutes)
export const apiCache = cacheHeaders(300);

// Product data cache (2 minutes)
export const productCache = cacheHeaders(120);

// No cache for dynamic content
export const noCache = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};
