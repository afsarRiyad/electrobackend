import { LRUCache } from "lru-cache";

// LRU Cache with size limits and TTL
const cache = new LRUCache({
  max: 500, // Maximum number of items
  ttl: 5 * 60 * 1000, // 5 minutes TTL
  updateAgeOnGet: true, // Reset TTL on access
  updateAgeOnHas: true,
});

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getCache = (key) => {
  return cache.get(key);
};

export const setCache = (key, data, ttl = CACHE_TTL) => {
  cache.set(key, data, { ttl });
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

export const getCacheStats = () => {
  return {
    size: cache.size,
    max: cache.max,
    calculatedSize: cache.calculatedSize,
    itemCount: cache.size,
  };
};
