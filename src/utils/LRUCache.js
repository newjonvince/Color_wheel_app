// utils/LRUCache.js - Memory-safe LRU cache implementation
// ✅ SAFER: Use LRU cache with size limit to prevent memory leaks

class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return undefined;
    
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    // Delete if exists (to update order)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }
  
  clear() {
    this.cache.clear();
  }
  
  size() {
    return this.cache.size;
  }
  
  has(key) {
    return this.cache.has(key);
  }
}

// ✅ Use LRU cache with reasonable limits
const storageKeyCache = new LRUCache(100); // Max 100 users cached

export const getMatchesKey = (userId) => {
  const cacheKey = userId || 'anon';
  
  let key = storageKeyCache.get(cacheKey);
  if (!key) {
    key = `savedColorMatches:${cacheKey}`;
    storageKeyCache.set(cacheKey, key);
  }
  
  return key;
};

export default LRUCache;
