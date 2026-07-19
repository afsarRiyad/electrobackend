// Simple in-memory cache for admin stats
const cache = new Map();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getCache = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return item.data;
};

export const setCache = (key, data, ttl = CACHE_TTL) => {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl,
  });
};

export const clearCache = (key) => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
};

export const clearCachePattern = (pattern) => {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
};
