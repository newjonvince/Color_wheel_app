// utils/LRUCache.js - Lightweight LRU (Least Recently Used) Cache implementation

/**
 * LRU Cache implementation for efficient caching with size limits
 * Automatically evicts least recently used items when capacity is reached
 */
export class LRUCache {
  constructor(capacity = 100) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache
   * @param {string} key - The cache key
   * @returns {*} The cached value or undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }

  /**
   * Set a value in the cache
   * @param {string} key - The cache key
   * @param {*} value - The value to cache
   */
  set(key, value) {
    // If key exists, delete it first (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // If at capacity, delete the oldest (first) entry
    else if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }

  /**
   * Check if key exists in cache
   * @param {string} key - The cache key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete a key from the cache
   * @param {string} key - The cache key
   * @returns {boolean} True if key was deleted
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get all keys in the cache
   * @returns {IterableIterator<string>}
   */
  keys() {
    return this.cache.keys();
  }

  /**
   * Get all values in the cache
   * @returns {IterableIterator<*>}
   */
  values() {
    return this.cache.values();
  }

  /**
   * Get all entries in the cache
   * @returns {IterableIterator<[string, *]>}
   */
  entries() {
    return this.cache.entries();
  }

  /**
   * Iterate over all entries
   * @param {Function} callback - Function to call for each entry
   */
  forEach(callback) {
    this.cache.forEach(callback);
  }
}

export default LRUCache;
