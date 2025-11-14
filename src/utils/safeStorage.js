// utils/safeStorage.js - Secure storage with expo-secure-store and proper initialization
import AsyncStorage from '@react-native-async-storage/async-storage';

// Error monitoring for critical failures
const reportError = (error, context) => {
  if (__DEV__) {
    console.error(`[SafeStorage] ${context}:`, error);
  } else {
    // In production, send to error monitoring service (Sentry, Bugsnag, etc.)
    try {
      // Example: Sentry.captureException(error, { tags: { context } });
      console.error(`[SafeStorage] ${context}:`, error.message);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }
};

// Secure storage for sensitive data
let SecureStore = null;
try {
  SecureStore = require('expo-secure-store');
} catch (error) {
  console.warn('expo-secure-store not available, using AsyncStorage only');
  reportError(error, 'SecureStore module loading failed');
}

// Configuration constants
const CONFIG = {
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 50,
  SENSITIVE_KEY_PATTERNS: [
    /token/i, /auth/i, /password/i, /secret/i, /key/i, /credential/i
  ],
  MAX_VALUE_SIZE: 1024 * 1024, // 1MB limit
  BATCH_DELAY: 100, // ms
  SECURE_STORE_OPTIONS: {
    keychainService: 'fashion-color-wheel',
    requireAuthentication: false, // Set to true for biometric protection
  },
};

// Advanced SafeStorage class
class OptimizedSafeStorage {
  constructor() {
    this.secureStore = SecureStore;
    this.isSecureStoreAvailable = false;
    this.isInitialized = false;
    this.asyncStorageUnavailable = false; // Track AsyncStorage availability
    this.secureStoreUnavailable = false; // Track SecureStore availability
    this.cache = new Map();
    this.pendingOperations = new Map();
    this.batchQueue = [];
    this.batchTimer = null;
    
    // Don't call async initialize() in constructor - race condition
  }

  /**
   * Initialize SecureStore with availability check
   * Must be called explicitly during app startup
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test AsyncStorage first (critical dependency)
      let asyncStorageAvailable = false;
      try {
        // Test AsyncStorage with a safe operation
        const testKey = '__safeStorage_test__';
        
        // Manual timeout management (safer than Promise.race)
        const asyncTest = (async () => {
          await AsyncStorage.setItem(testKey, 'test');
          const testValue = await AsyncStorage.getItem(testKey);
          await AsyncStorage.removeItem(testKey);
          return testValue === 'test';
        })();

        const testOperation = new Promise((resolve, reject) => {
          const timeoutId = setTimeout(
            () => reject(new Error('AsyncStorage test timeout')),
            5000
          );

          asyncTest.then(
            (result) => {
              clearTimeout(timeoutId);
              resolve(result);
            },
            (error) => {
              clearTimeout(timeoutId);
              reject(error);
            }
          );
        });
        
        asyncStorageAvailable = await testOperation;
        
        if (__DEV__) {
          console.log('📱 AsyncStorage test:', asyncStorageAvailable ? '✅ Working' : '❌ Failed');
        }
      } catch (asyncError) {
        console.error('❌ AsyncStorage is not available or corrupted:', asyncError.message);
        reportError(asyncError, 'AsyncStorage test failed during initialization');
        
        // CRITICAL: Mark storage as unavailable but don't crash the app
        asyncStorageAvailable = false;
        
        // Set a flag to prevent storage operations
        this.asyncStorageUnavailable = true;
      }

      // Test SecureStore availability (optional dependency) with timeout protection
      if (this.secureStore) {
        try {
          // Manual timeout management for SecureStore (safer than Promise.race)
          const secureTest = this.secureStore.isAvailableAsync();

          const secureOperation = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(
              () => reject(new Error('SecureStore availability test timeout')),
              3000 // 3 second timeout for keychain access
            );

            secureTest.then(
              (result) => {
                clearTimeout(timeoutId);
                resolve(result);
              },
              (error) => {
                clearTimeout(timeoutId);
                reject(error);
              }
            );
          });

          this.isSecureStoreAvailable = await secureOperation;
          if (__DEV__) {
            console.log('🔐 SecureStore test:', this.isSecureStoreAvailable ? '✅ Available' : '❌ Not available');
          }
        } catch (secureError) {
          console.warn('SecureStore availability check failed:', secureError.message);
          reportError(secureError, 'SecureStore availability check failed');
          this.isSecureStoreAvailable = false;
          
          // Mark SecureStore as unavailable to prevent future crashes
          this.secureStoreUnavailable = true;
        }
      } else {
        this.isSecureStoreAvailable = false;
        this.secureStoreUnavailable = true;
      }
      
      this.isInitialized = true;
      
      if (__DEV__) {
        console.log('🔐 SafeStorage initialized:', {
          asyncStorage: asyncStorageAvailable,
          secureStore: this.isSecureStoreAvailable
        });
      }

      // Warn if AsyncStorage failed but continue
      if (!asyncStorageAvailable) {
        console.warn('⚠️ SafeStorage initialized with AsyncStorage issues - storage operations may fail');
      }
      
    } catch (error) {
      console.error('SafeStorage initialization failed:', error.message);
      reportError(error, 'SafeStorage initialization failed');
      this.isSecureStoreAvailable = false;
      this.isInitialized = true; // Mark as initialized even if tests failed
    }
  }

  /**
   * Check if key contains sensitive data
   */
  isSensitiveKey(key) {
    return CONFIG.SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
  }

  /**
   * Ensure initialization before operations
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      console.warn('SafeStorage not initialized. Call safeStorage.init() during app startup.');
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
   * Normalize value for storage (ensure string)
   */
  normalizeValueForStorage(value) {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch (e) {
      throw new Error('Value must be serializable to JSON');
    }
  }

  /**
   * Validate data size on serialized value
   */
  validateDataSize(serializedValue) {
    if (typeof serializedValue === 'string' && serializedValue.length > CONFIG.MAX_VALUE_SIZE) {
      throw new Error(`Data too large: ${serializedValue.length} bytes (max: ${CONFIG.MAX_VALUE_SIZE})`);
    }
  }

  /**
   * Advanced getItem with caching and fallbacks
   */
  async getItem(key) {
    // Ensure initialization
    if (!this.isInitialized) await this.init();
    
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
    this.ensureInitialized();
    const isSensitive = this.isSensitiveKey(key);

    try {
      // Try SecureStore first for sensitive data
      if (isSensitive && this.isSecureStoreAvailable && this.secureStore && !this.secureStoreUnavailable) {
        try {
          const value = await this.secureStore.getItemAsync(key, CONFIG.SECURE_STORE_OPTIONS);
          if (value !== null) {
            // Handle TTL wrapped values
            try {
              const parsed = JSON.parse(value);
              if (parsed.expires && Date.now() > parsed.expires) {
                // Expired, remove it
                await this.secureStore.deleteItemAsync(key, CONFIG.SECURE_STORE_OPTIONS);
                return null;
              }
              return parsed.value || value;
            } catch {
              // Not wrapped, return as-is
              return value;
            }
          }
        } catch (secureError) {
          console.warn(`SecureStore.getItem failed for key '${key}':`, secureError.message);
          reportError(secureError, `SecureStore.getItem failed for key: ${key}`);
          
          // Mark SecureStore as unavailable to prevent future crashes
          this.secureStoreUnavailable = true;
          // Continue to AsyncStorage fallback
        }
      }

      // Fallback to AsyncStorage (for non-sensitive data or when SecureStore unavailable)
      try {
        // Check if AsyncStorage is available
        if (this.asyncStorageUnavailable) {
          console.warn(`AsyncStorage unavailable, cannot get key '${key}'`);
          return null;
        }
        
        const asyncValue = await AsyncStorage.getItem(key);
        if (asyncValue === null) return null;

        // For sensitive data in AsyncStorage, warn about insecure storage
        if (isSensitive) {
          console.warn(`Sensitive key '${key}' stored in AsyncStorage (insecure). Consider using SecureStore.`);
        }

        return asyncValue;
      } catch (asyncError) {
        console.error(`AsyncStorage.getItem failed for key '${key}':`, asyncError.message);
        reportError(asyncError, `AsyncStorage.getItem failed for key: ${key}`);
        
        // Mark AsyncStorage as unavailable to prevent future crashes
        this.asyncStorageUnavailable = true;
        return null;
      }

    } catch (error) {
      console.warn(`Failed to get item ${key}:`, error.message);
      reportError(error, `Storage operation failed for key: ${key}`);
      return null;
    }
  }

  /**
   * Advanced setItem with secure storage and batching
   */
  async setItem(key, value, options = {}) {
    // Ensure initialization
    if (!this.isInitialized) await this.init();
    
    // Normalize and validate the value
    const serialized = this.normalizeValueForStorage(value);
    this.validateDataSize(serialized);

    const isSensitive = this.isSensitiveKey(key);
    const { batch = false, ttl } = options;

    if (batch) {
      return this._addToBatch('set', key, serialized, options);
    }

    try {
      let success = false;

      // Try SecureStore first for sensitive data
      if (isSensitive && this.isSecureStoreAvailable && this.secureStore && !this.secureStoreUnavailable) {
        try {
          if (ttl) {
            // SecureStore doesn't support TTL, but we can add metadata
            const wrappedValue = JSON.stringify({
              value: serialized,
              expires: Date.now() + ttl
            });
            await this.secureStore.setItemAsync(key, wrappedValue, CONFIG.SECURE_STORE_OPTIONS);
          } else {
            await this.secureStore.setItemAsync(key, serialized, CONFIG.SECURE_STORE_OPTIONS);
          }
          success = true;
        } catch (secureError) {
          console.warn(`SecureStore failed for ${key}, falling back to AsyncStorage:`, secureError.message);
          reportError(secureError, `SecureStore.setItem failed for key: ${key}`);
          
          // Mark SecureStore as unavailable to prevent future crashes
          this.secureStoreUnavailable = true;
        }
      }

      // Use AsyncStorage as fallback
      if (!success) {
        try {
          // Check if AsyncStorage is available
          if (this.asyncStorageUnavailable) {
            console.warn(`AsyncStorage unavailable, cannot set key '${key}'`);
            throw new Error('AsyncStorage unavailable');
          }
          
          // For sensitive data in AsyncStorage, warn about insecure storage
          if (isSensitive) {
            console.warn(`Storing sensitive key '${key}' in AsyncStorage (insecure). Consider using SecureStore.`);
          }
          await AsyncStorage.setItem(key, serialized);
        } catch (asyncError) {
          console.error(`AsyncStorage.setItem failed for key '${key}':`, asyncError.message);
          reportError(asyncError, `AsyncStorage.setItem failed for key: ${key}`);
          
          // Mark AsyncStorage as unavailable to prevent future crashes
          this.asyncStorageUnavailable = true;
          throw new Error(`Storage operation failed: ${asyncError.message}`);
        }
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
      const promises = [];
      
      // AsyncStorage removal with error handling
      promises.push(
        AsyncStorage.removeItem(key).catch((asyncError) => {
          console.error(`AsyncStorage.removeItem failed for key '${key}':`, asyncError.message);
          reportError(asyncError, `AsyncStorage.removeItem failed for key: ${key}`);
          // Don't throw - continue with other operations
        })
      );

      if (this.isSecureStoreAvailable && this.secureStore && !this.secureStoreUnavailable) {
        promises.push(
          this.secureStore.deleteItemAsync(key).catch((secureError) => {
            console.warn(`SecureStore.deleteItem failed for key '${key}':`, secureError.message);
            reportError(secureError, `SecureStore.deleteItem failed for key: ${key}`);
            
            // Mark SecureStore as unavailable to prevent future crashes
            this.secureStoreUnavailable = true;
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
      // Get all AsyncStorage keys with error handling
      let allKeys = [];
      try {
        allKeys = await AsyncStorage.getAllKeys();
      } catch (asyncError) {
        console.error('AsyncStorage.getAllKeys failed during clearAuth:', asyncError.message);
        reportError(asyncError, 'AsyncStorage.getAllKeys failed during clearAuth');
        return; // Can't proceed without keys
      }
      
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
      let allKeys = [];
      try {
        allKeys = await AsyncStorage.getAllKeys();
      } catch (asyncError) {
        console.error('AsyncStorage.getAllKeys failed during getStats:', asyncError.message);
        reportError(asyncError, 'AsyncStorage.getAllKeys failed during getStats');
        // Continue with empty keys array
      }
      
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
  init: () => optimizedSafeStorage.init(), // ✅ CRITICAL FIX: Export init method
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
