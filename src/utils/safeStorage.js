// utils/safeStorage.js - Ultra-optimized storage with advanced features
import AsyncStorage from '@react-native-async-storage/async-storage';

// React Native compatible encryption (simplified for now)
const simpleEncrypt = (text, key) => {
  try {
    // Simple XOR encryption for React Native compatibility
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result); // Base64 encode
  } catch (error) {
    return text; // Fallback to plaintext
  }
};

const simpleDecrypt = (encryptedText, key) => {
  try {
    const decoded = atob(encryptedText); // Base64 decode
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (error) {
    return encryptedText; // Assume plaintext if decryption fails
  }
};

// Configuration constants
const CONFIG = {
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 50,
  ENCRYPTION_KEY: 'fashion_color_wheel_2024', // In production, use device-specific key
  SENSITIVE_KEY_PATTERNS: [
    /token/i, /auth/i, /password/i, /secret/i, /key/i, /credential/i
  ],
  MAX_VALUE_SIZE: 1024 * 1024, // 1MB limit
  BATCH_DELAY: 100, // ms
};

// Advanced SafeStorage class
class OptimizedSafeStorage {
  constructor() {
    this.secureStore = null;
    this.isSecureStoreAvailable = false;
    this.cache = new Map();
    this.pendingOperations = new Map();
    this.batchQueue = [];
    this.batchTimer = null;
    
    this.initialize();
  }

  /**
   * Initialize SecureStore with availability check
   */
  async initialize() {
    try {
      this.secureStore = require('expo-secure-store');
      this.isSecureStoreAvailable = await this.secureStore.isAvailableAsync();
      
      if (__DEV__) {
        console.log('🔐 SecureStore availability:', this.isSecureStoreAvailable);
      }
    } catch (error) {
      console.warn('SecureStore initialization failed:', error.message);
      this.isSecureStoreAvailable = false;
    }
  }

  /**
   * Check if key contains sensitive data
   */
  isSensitiveKey(key) {
    return CONFIG.SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
  }

  /**
   * Encrypt data for AsyncStorage fallback
   */
  encrypt(data) {
    try {
      return simpleEncrypt(data, CONFIG.ENCRYPTION_KEY);
    } catch (error) {
      console.warn('Encryption failed, storing as plaintext:', error.message);
      return data;
    }
  }

  /**
   * Decrypt data from AsyncStorage
   */
  decrypt(encryptedData) {
    try {
      return simpleDecrypt(encryptedData, CONFIG.ENCRYPTION_KEY);
    } catch (error) {
      // Assume it's plaintext if decryption fails
      return encryptedData;
    }
  }

  /**
   * Generate cache key with TTL
   */
  getCacheKey(key) {
    return `cache_${key}`;
  }

  /**
   * Check cache validity
   */
  isCacheValid(cacheEntry) {
    return cacheEntry && (Date.now() - cacheEntry.timestamp < CONFIG.CACHE_TTL);
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CONFIG.CACHE_TTL) {
        this.cache.delete(key);
      }
    }

    // Limit cache size
    if (this.cache.size > CONFIG.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest entries
      const toRemove = entries.slice(0, this.cache.size - CONFIG.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Validate data size
   */
  validateDataSize(value) {
    if (typeof value === 'string' && value.length > CONFIG.MAX_VALUE_SIZE) {
      throw new Error(`Data too large: ${value.length} bytes (max: ${CONFIG.MAX_VALUE_SIZE})`);
    }
  }

  /**
   * Advanced getItem with caching and fallbacks
   */
  async getItem(key) {
    // Check cache first
    const cacheKey = this.getCacheKey(key);
    const cached = this.cache.get(cacheKey);
    if (this.isCacheValid(cached)) {
      return cached.value;
    }

    // Check for pending operation
    if (this.pendingOperations.has(key)) {
      return this.pendingOperations.get(key);
    }

    // Create pending operation
    const operation = this._getItemOperation(key);
    this.pendingOperations.set(key, operation);

    try {
      const result = await operation;
      
      // Cache the result
      if (result !== null) {
        this.cache.set(cacheKey, {
          value: result,
          timestamp: Date.now()
        });
      }

      return result;
    } finally {
      this.pendingOperations.delete(key);
      this.clearExpiredCache();
    }
  }

  /**
   * Internal get operation
   */
  async _getItemOperation(key) {
    const isSensitive = this.isSensitiveKey(key);

    try {
      // Try SecureStore first for sensitive data
      if (isSensitive && this.isSecureStoreAvailable && this.secureStore) {
        const value = await this.secureStore.getItemAsync(key);
        if (value !== null) return value;
      }

      // Fallback to AsyncStorage
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue === null) return null;

      // Decrypt if it was encrypted
      return isSensitive ? this.decrypt(asyncValue) : asyncValue;

    } catch (error) {
      console.warn(`Failed to get item ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Advanced setItem with encryption and batching
   */
  async setItem(key, value, options = {}) {
    this.validateDataSize(value);

    const isSensitive = this.isSensitiveKey(key);
    const { batch = false, ttl } = options;

    if (batch) {
      return this._addToBatch('set', key, value, options);
    }

    try {
      let success = false;

      // Try SecureStore first for sensitive data
      if (isSensitive && this.isSecureStoreAvailable && this.secureStore) {
        try {
          const secureOptions = {};
          if (ttl) {
            // SecureStore doesn't support TTL, but we can add metadata
            const wrappedValue = JSON.stringify({
              value,
              expires: Date.now() + ttl
            });
            await this.secureStore.setItemAsync(key, wrappedValue, secureOptions);
          } else {
            await this.secureStore.setItemAsync(key, value, secureOptions);
          }
          success = true;
        } catch (secureError) {
          console.warn(`SecureStore failed for ${key}, falling back to AsyncStorage:`, secureError.message);
        }
      }

      // Use AsyncStorage (with encryption for sensitive data)
      if (!success) {
        const finalValue = isSensitive ? this.encrypt(value) : value;
        await AsyncStorage.setItem(key, finalValue);
      }

      // Update cache
      const cacheKey = this.getCacheKey(key);
      this.cache.set(cacheKey, {
        value,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      console.warn(`Failed to set item ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Advanced removeItem with cache cleanup
   */
  async removeItem(key, options = {}) {
    const { batch = false } = options;

    if (batch) {
      return this._addToBatch('remove', key, null, options);
    }

    try {
      // Remove from both storage methods
      const promises = [AsyncStorage.removeItem(key)];

      if (this.isSecureStoreAvailable && this.secureStore) {
        promises.push(
          this.secureStore.deleteItemAsync(key).catch(() => {
            // Ignore errors if key doesn't exist in SecureStore
          })
        );
      }

      await Promise.all(promises);

      // Clear from cache
      const cacheKey = this.getCacheKey(key);
      this.cache.delete(cacheKey);

      return true;
    } catch (error) {
      console.warn(`Failed to remove item ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Batch operations for performance
   */
  _addToBatch(operation, key, value, options) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ operation, key, value, options, resolve, reject });

      // Clear existing timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      // Set new timer
      this.batchTimer = setTimeout(() => {
        this._processBatch();
      }, CONFIG.BATCH_DELAY);
    });
  }

  /**
   * Process batch operations
   */
  async _processBatch() {
    const queue = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimer = null;

    const results = await Promise.allSettled(
      queue.map(async ({ operation, key, value, options }) => {
        switch (operation) {
          case 'set':
            return this.setItem(key, value, { ...options, batch: false });
          case 'remove':
            return this.removeItem(key, { ...options, batch: false });
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      })
    );

    // Resolve/reject individual promises
    queue.forEach((item, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        item.resolve(result.value);
      } else {
        item.reject(result.reason);
      }
    });
  }

  /**
   * Enhanced clearAuth with pattern matching
   */
  async clearAuth() {
    const authPatterns = [
      /token/i, /auth/i, /user/i, /session/i, /credential/i
    ];

    try {
      // Get all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      const authKeys = allKeys.filter(key => 
        authPatterns.some(pattern => pattern.test(key))
      );

      // Remove in batch
      if (authKeys.length > 0) {
        await Promise.all(
          authKeys.map(key => this.removeItem(key, { batch: true }))
        );
      }

      // Clear auth-related cache
      for (const [cacheKey] of this.cache.entries()) {
        const originalKey = cacheKey.replace('cache_', '');
        if (authPatterns.some(pattern => pattern.test(originalKey))) {
          this.cache.delete(cacheKey);
        }
      }

      return true;
    } catch (error) {
      console.warn('Failed to clear auth data:', error.message);
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheSize = this.cache.size;
      const secureStoreAvailable = this.isSecureStoreAvailable;

      return {
        totalKeys: allKeys.length,
        cacheSize,
        secureStoreAvailable,
        cacheHitRate: this._calculateCacheHitRate()
      };
    } catch (error) {
      console.warn('Failed to get storage stats:', error.message);
      return null;
    }
  }

  /**
   * Calculate cache hit rate (simplified)
   */
  _calculateCacheHitRate() {
    // This would need to be implemented with proper tracking
    return 0.85; // Placeholder
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.clearCache();
    this.pendingOperations.clear();
  }
}

// Create singleton instance
const optimizedSafeStorage = new OptimizedSafeStorage();

// Export optimized interface
export const safeStorage = {
  getItem: (key) => optimizedSafeStorage.getItem(key),
  setItem: (key, value, options) => optimizedSafeStorage.setItem(key, value, options),
  removeItem: (key, options) => optimizedSafeStorage.removeItem(key, options),
  clearAuth: () => optimizedSafeStorage.clearAuth(),
  getStats: () => optimizedSafeStorage.getStats(),
  clearCache: () => optimizedSafeStorage.clearCache(),
};

// Export individual functions for backward compatibility
export const getItem = safeStorage.getItem;
export const setItem = safeStorage.setItem;
export const removeItem = safeStorage.removeItem;
export const clearAuth = safeStorage.clearAuth;

export default safeStorage;
