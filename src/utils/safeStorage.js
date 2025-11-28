// utils/safeStorage.js - Secure storage with expo-secure-store and proper initialization
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { safeAsyncStorage } from './safeAsyncStorage';

// Lazy logger proxy to avoid circular import crashes
let _loggerInstance = null;
const getLogger = () => {
  if (_loggerInstance) return _loggerInstance;
  try {
    const mod = require('./AppLogger');
    _loggerInstance = mod?.logger || mod?.default || console;
  } catch (error) {
    console.warn('safeStorage: AppLogger load failed, using console', error?.message || error);
    _loggerInstance = console;
  }
  return _loggerInstance;
};

const logger = {
  debug: (...args) => getLogger()?.debug?.(...args),
  info: (...args) => getLogger()?.info?.(...args),
  warn: (...args) => getLogger()?.warn?.(...args),
  error: (...args) => getLogger()?.error?.(...args),
};
import { STORAGE_KEYS } from '../constants/storageKeys';

// Production-ready configuration
const getSafeExpoExtra = () => {
  try {
    const expoConfig = Constants?.expoConfig;
    if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
      return expoConfig.extra;
    }
    console.warn('safeStorage: expoConfig missing or malformed, using defaults');
  } catch (error) {
    console.warn('safeStorage: unable to read expoConfig safely, using defaults', error);
  }
  return {};
};

const extra = getSafeExpoExtra();
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

// Error monitoring for critical failures
const reportError = (error, context) => {
  // Always log critical storage errors in production
  console.error(`[SafeStorage] ${context}:`, error);
  
  // Enhanced production error reporting
  try {
    // Log structured error data for production debugging
    console.error('SafeStorage Error Details:', {
      context,
      message: error?.message || 'Unknown error',
      name: error?.name || 'UnknownError',
      stack: error?.stack?.substring(0, 500), // Truncated stack trace
      timestamp: new Date().toISOString(),
      platform: 'iOS Production'
    });
    
    // Future: Add crash analytics service here
    // Example: Sentry.captureException(error, { tags: { context, platform: 'iOS' } });
  } catch (reportingError) {
    console.error('Failed to report SafeStorage error:', reportingError);
  }
};

// Secure storage for sensitive data - using ES6 import from line 4

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

// Advanced SafeStorage class with proper security separation
class OptimizedSafeStorage {
  constructor() {
    this.secureStore = SecureStore;
    this.isSecureStoreAvailable = false;
    this.isInitialized = false;
    this.asyncStorageUnavailable = false; // Track AsyncStorage availability (permanent flag)
    this.asyncStorageFailureCount = 0;
    this.asyncStorageUnavailableUntil = 0; // Cooldown-based block
    this.secureStoreUnavailable = false; // Track SecureStore availability
    this.cache = new Map();
    this.pendingOperations = new Map();
    this.batchQueue = [];
    this.batchTimer = null;
    this._isMounted = true; // Track mounted state
    this.tokenStorageType = null; // Track where token is stored
    
    // Don't call async initialize() in constructor - race condition
  }

  /**
   * Initialize SecureStore with availability check
   * Must be called explicitly during app startup
   * @param {Object} options - Initialization options
   * @param {AbortSignal} options.signal - Abort signal for cancellation
   */
  async init({ signal } = {}) {
    if (this.isInitialized) {
      return;
    }

    // Check if initialization was aborted
    if (signal?.aborted) {
      throw new Error('SafeStorage initialization aborted');
    }

    try {
      // Test AsyncStorage first (critical dependency)
      let asyncStorageAvailable = false;
      try {
        // Initialize safe AsyncStorage wrapper
        await safeAsyncStorage.init();
        asyncStorageAvailable = safeAsyncStorage.isAsyncStorageAvailable();
        
        // Log critical storage status only in debug mode
        if (IS_DEBUG_MODE) {
          console.log('📱 AsyncStorage status:', asyncStorageAvailable ? '✅ Working' : '❌ Failed');
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
          // ✅ FIX: Manual timeout management for SecureStore with abort signal support
          const secureTest = this.secureStore.isAvailableAsync();

          const secureOperation = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(
              () => reject(new Error('SecureStore availability test timeout')),
              3000 // 3 second timeout for keychain access
            );

            // ✅ FIX: Listen for abort signal
            if (signal?.addEventListener) {
              const abortHandler = () => {
                clearTimeout(timeoutId);
                reject(new Error('SecureStore availability test aborted'));
              };
              signal.addEventListener('abort', abortHandler, { once: true });
            }

            secureTest.then(
              (result) => {
                clearTimeout(timeoutId);
                if (signal?.aborted) {
                  reject(new Error('SecureStore availability test aborted'));
                } else {
                  resolve(result);
                }
              },
              (error) => {
                clearTimeout(timeoutId);
                reject(error);
              }
            );
          });

          this.isSecureStoreAvailable = await secureOperation;
          // Log SecureStore status only in debug mode
          if (IS_DEBUG_MODE) {
            console.log('🔐 SecureStore status:', this.isSecureStoreAvailable ? '✅ Available' : '❌ Not available');
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
      
      // Log initialization status only in debug mode
      if (IS_DEBUG_MODE) {
        console.log('🔐 SafeStorage initialized:', {
          asyncStorage: asyncStorageAvailable,
          secureStore: this.isSecureStoreAvailable,
          platform: 'iOS Production'
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
   * Helper to guard async operations with a timeout to avoid hangs
   */
  _withTimeout(promise, timeoutMs, label) {
    // ✅ CRITICAL FIX: Manual timeout management to prevent uncaught promise rejections
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = null;
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
      
      timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`${label || 'operation'} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      
      promise.then(
        (result) => {
          if (!settled) {
            settled = true;
            cleanup();
            resolve(result);
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(error);
          }
        }
      ).catch((error) => {
        // ✅ SAFETY: Catch any remaining promise rejections
        if (!settled) {
          settled = true;
          cleanup();
          reject(error);
        }
      });
    });
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
    // Opportunistically purge stale cache before each get
    this.clearExpiredCache();

    if (!this.isInitialized) await this.init();
    
    // Check cache first
    const cacheKey = this.getCacheKey(key);
    const cached = this.cache.get(cacheKey);
    if (this.isCacheValid(cached)) {
      return cached.value;
    }

    // Check pending operations
    if (this.pendingOperations.has(key)) {
      return this.pendingOperations.get(key);
    }

    const promise = (async () => {
      try {
        // Try SecureStore for sensitive keys
        if (this.isSensitiveKey(key) && this.isSecureStoreAvailable && !this.secureStoreUnavailable) {
          let value;
          try {
            // Guard against hanging secure reads
            const securePromise = this.secureStore.getItemAsync(key, CONFIG.SECURE_STORE_OPTIONS);
            value = await this._withTimeout(securePromise, 4000, `SecureStore.getItem(${key})`);
          } catch (secureError) {
            logger.warn(`SecureStore.getItem timed out/failed for key '${key}':`, secureError?.message || secureError);
            this.secureStoreUnavailable = true;
            value = null;
          }

          if (value !== null) {
            // Handle TTL wrapped values
            try {
              const parsed = JSON.parse(value);
              if (parsed.expires && Date.now() > parsed.expires) {
                // Expired, remove it
                await this.secureStore.deleteItemAsync(key, CONFIG.SECURE_STORE_OPTIONS);
                return null;
              }
              const result = parsed.value || value;
              this.cache.set(cacheKey, { value: result, timestamp: Date.now() });
              return result;
            } catch {
              // Not wrapped, return as-is
              this.cache.set(cacheKey, { value, timestamp: Date.now() });
              return value;
            }
          }
        }

        // Fallback to AsyncStorage
        const now = Date.now();
        if (this.asyncStorageUnavailable && now < this.asyncStorageUnavailableUntil) {
          logger.warn(`AsyncStorage temporarily unavailable (cooldown) for key '${key}'`);
          return null;
        }

        try {
          const value = await safeAsyncStorage.getItem(key);
          if (value !== null) {
            this.cache.set(cacheKey, { value, timestamp: Date.now() });
          }
          this.asyncStorageFailureCount = 0;
          this.asyncStorageUnavailable = false;
          this.asyncStorageUnavailableUntil = 0;
          return value;
        } catch (asyncError) {
          this.asyncStorageFailureCount += 1;
          this.asyncStorageUnavailableUntil = Date.now() + 5000; // brief backoff
          if (this.asyncStorageFailureCount >= 3) {
            this.asyncStorageUnavailable = true;
          }
          logger.warn(`AsyncStorage.getItem failed for key '${key}':`, asyncError?.message || asyncError);
          return null;
        }
      } finally {
        // ✅ Always clean up pending operation
        this.pendingOperations.delete(key);
      }
    })();

    this.pendingOperations.set(key, promise);
    return promise;
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
          
          // Enhanced error detection for Swift runtime issues
          const errorMessage = secureError?.message || '';
          if (errorMessage.includes('Swift') || 
              errorMessage.includes('native') || 
              errorMessage.includes('metadata') ||
              errorMessage.includes('collection')) {
            console.error('🚨 Swift runtime error detected in SecureStore operation');
          }
          
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
        
        const asyncValue = await safeAsyncStorage.getItem(key);
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
    // Opportunistically purge stale cache before writes
    this.clearExpiredCache();

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
          await safeAsyncStorage.setItem(key, serialized);
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
    // Opportunistic cache cleanup
    this.clearExpiredCache();

    const { batch = false } = options;

    if (batch) {
      return this._addToBatch('remove', key, null, options);
    }

    try {
      // Remove from both storage methods
      const promises = [];
      
      // AsyncStorage removal with error handling
      promises.push(
        safeAsyncStorage.removeItem(key).catch((asyncError) => {
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
      // ✅ Check if mounted before adding to batch
      if (!this._isMounted) {
        reject(new Error('Storage unmounted'));
        return;
      }

      this.batchQueue.push({ operation, key, value, options, resolve, reject });

      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      this.batchTimer = setTimeout(() => {
        // ✅ Check mounted state before processing
        if (this._isMounted) {
          this._processBatch();
        } else {
          // Clean up queue
          this.batchQueue.forEach(item => {
            item.reject(new Error('Storage unmounted'));
          });
          this.batchQueue = [];
        }
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

  // 🔧 Token ONLY goes in SecureStore or nowhere
  async setToken(token) {
    if (!token) {
      throw new Error('Token is required');
    }

    try {
      await this.secureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token, CONFIG.SECURE_STORE_OPTIONS);
      this.tokenStorageType = 'secure';
      logger.info('✅ Token saved to SecureStore');
    } catch (error) {
      logger.error('❌ Failed to save token to SecureStore:', error);
      
      // 🔧 NEVER fallback to AsyncStorage for tokens
      this.tokenStorageType = null;
      
      Alert.alert(
        'Security Error',
        'Cannot securely store authentication. Please enable device security (passcode/biometrics).',
        [{ text: 'OK' }]
      );
      
      throw new Error('Secure storage not available');
    }
  }

  // 🔧 Token ONLY comes from SecureStore
  async getToken() {
    try {
      const token = await this.secureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN, CONFIG.SECURE_STORE_OPTIONS);
      
      if (token) {
        this.tokenStorageType = 'secure';
        return token;
      }
      
      // 🔧 No fallback - if not in SecureStore, token doesn't exist
      this.tokenStorageType = null;
      return null;
      
    } catch (error) {
      logger.error('❌ Failed to get token from SecureStore:', error);
      this.tokenStorageType = null;
      
      // 🔧 Don't check AsyncStorage for tokens
      return null;
    }
  }

  // 🔧 Clear token from both locations for safety
  async clearToken() {
    const errors = [];
    
    try {
      await this.secureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      logger.error('Failed to clear SecureStore token:', error);
      errors.push(error);
    }
    
    // 🔧 Also clear from AsyncStorage in case old version stored it there
    try {
      await safeAsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      logger.error('Failed to clear AsyncStorage token:', error);
      errors.push(error);
    }
    
    this.tokenStorageType = null;
    
    if (errors.length > 0) {
      throw new Error('Failed to fully clear token');
    }
  }

  // dY"? Store user data securely when possible, fallback to AsyncStorage
  async setUserData(userData) {
    let serialized;
    try {
      serialized = JSON.stringify(userData);
    } catch (e) {
      logger?.error?.('Failed to serialize userData for storage', e);
      throw new Error('User data must be JSON-serializable');
    }
    let lastError = null;

    if (this.isSecureStoreAvailable && !this.secureStoreUnavailable) {
      try {
        await this.secureStore.setItemAsync(
          STORAGE_KEYS.USER_DATA,
          serialized,
          CONFIG.SECURE_STORE_OPTIONS
        );
        logger.info('?o. User data saved to SecureStore');
        return;
      } catch (error) {
        lastError = error;
        logger.warn('SecureStore failed to save user data, falling back:', error);
      }
    }

    try {
      await safeAsyncStorage.setItem(STORAGE_KEYS.USER_DATA, serialized);
      logger.info('?o. User data saved to AsyncStorage fallback');
    } catch (error) {
      logger.error('??O Failed to save user data:', error);
      throw (lastError || error);
    }
  }

  async getUserData() {
    if (this.isSecureStoreAvailable && !this.secureStoreUnavailable) {
      try {
        const data = await this.secureStore.getItemAsync(STORAGE_KEYS.USER_DATA);
        if (data !== null && data !== undefined) {
          return JSON.parse(data);
        }
      } catch (error) {
        logger.warn('SecureStore failed to read user data, falling back:', error);
      }
    }

    try {
      const data = await safeAsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('??O Failed to get user data:', error);
      return null;
    }
  }
  /**
   * Enhanced clearAuth with pattern matching - FIXED: More robust with partial success handling
   */
  async clearAuth() {
    const authPatterns = [
      /token/i, /auth/i, /user/i, /session/i, /credential/i
    ];

    const results = {
      asyncStorageCleared: false,
      secureStoreCleared: false,
      cacheCleared: false,
      errors: []
    };

    // Step 1: Clear AsyncStorage auth keys
    try {
      let allKeys = [];
      try {
        allKeys = await safeAsyncStorage.getAllKeys();
      } catch (asyncError) {
        console.error('AsyncStorage.getAllKeys failed during clearAuth:', asyncError.message);
        reportError(asyncError, 'AsyncStorage.getAllKeys failed during clearAuth');
        results.errors.push(`AsyncStorage key retrieval failed: ${asyncError.message}`);
        // Continue with other clearing operations
      }
      
      if (allKeys.length > 0) {
        const authKeys = allKeys.filter(key => 
          authPatterns.some(pattern => pattern.test(key))
        );

        // Remove in batch with individual error handling
        if (authKeys.length > 0) {
          const removeResults = await Promise.allSettled(
            authKeys.map(key => this.removeItem(key, { batch: true }))
          );
          
          const failedRemovals = removeResults
            .map((result, index) => ({ result, key: authKeys[index] }))
            .filter(({ result }) => result.status === 'rejected');
          
          if (failedRemovals.length > 0) {
            const failedKeys = failedRemovals.map(({ key }) => key);
            results.errors.push(`Failed to remove AsyncStorage keys: ${failedKeys.join(', ')}`);
          }
          
          const successCount = removeResults.filter(r => r.status === 'fulfilled').length;
          results.asyncStorageCleared = successCount > 0;
          
          console.log(`🔄 AsyncStorage: ${successCount}/${authKeys.length} auth keys cleared`);
        } else {
          results.asyncStorageCleared = true; // No auth keys to clear
        }
      } else {
        results.asyncStorageCleared = true; // No keys at all
      }
    } catch (error) {
      console.error('AsyncStorage clearing failed:', error.message);
      results.errors.push(`AsyncStorage clearing failed: ${error.message}`);
    }

    // Step 2: Clear SecureStore auth data
    try {
      if (this.isSecureStoreAvailable) {
        // Try to clear known secure keys
        const secureAuthKeys = ['authToken', 'refreshToken', 'userCredentials'];
        const secureResults = await Promise.allSettled(
          secureAuthKeys.map(async (key) => {
            try {
              await this.secureStore.deleteItemAsync(key, CONFIG.SECURE_STORE_OPTIONS);
              return { key, success: true };
            } catch (error) {
              return { key, success: false, error: error.message };
            }
          })
        );
        
        const secureSuccesses = secureResults
          .filter(r => r.status === 'fulfilled' && r.value.success)
          .length;
        
        const secureFailures = secureResults
          .filter(r => r.status === 'fulfilled' && !r.value.success)
          .map(r => r.value);
        
        if (secureFailures.length > 0) {
          const failedKeys = secureFailures.map(f => f.key);
          results.errors.push(`Failed to clear SecureStore keys: ${failedKeys.join(', ')}`);
        }
        
        results.secureStoreCleared = secureSuccesses > 0 || secureAuthKeys.length === 0;
        console.log(`🔐 SecureStore: ${secureSuccesses}/${secureAuthKeys.length} auth keys cleared`);
      } else {
        results.secureStoreCleared = true; // SecureStore not available, nothing to clear
      }
    } catch (error) {
      console.error('SecureStore clearing failed:', error.message);
      results.errors.push(`SecureStore clearing failed: ${error.message}`);
    }

    // Step 3: Clear auth-related cache (this should always succeed)
    try {
      let cacheCleared = 0;
      for (const [cacheKey] of this.cache.entries()) {
        const originalKey = cacheKey.replace('cache_', '');
        if (authPatterns.some(pattern => pattern.test(originalKey))) {
          this.cache.delete(cacheKey);
          cacheCleared++;
        }
      }
      results.cacheCleared = true;
      console.log(`💾 Cache: ${cacheCleared} auth entries cleared`);
    } catch (error) {
      console.error('Cache clearing failed:', error.message);
      results.errors.push(`Cache clearing failed: ${error.message}`);
    }

    // Determine overall success
    const overallSuccess = results.asyncStorageCleared && results.secureStoreCleared && results.cacheCleared;
    
    if (results.errors.length > 0) {
      console.warn('⚠️ clearAuth completed with errors:', results.errors);
      reportError(new Error(results.errors.join('; ')), 'clearAuth partial failure');
    }
    
    if (overallSuccess) {
      console.log('✅ clearAuth completed successfully');
    } else {
      console.warn('⚠️ clearAuth completed with partial success');
    }

    return overallSuccess;
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    try {
      let allKeys = [];
      try {
        allKeys = await safeAsyncStorage.getAllKeys();
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
    this._isMounted = false; // ✅ Mark as unmounted
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // Reject pending batch operations
    this.batchQueue.forEach(item => {
      item.reject(new Error('Storage destroyed'));
    });
    
    this.clearCache();
    this.pendingOperations.clear();
  }
}

// Create singleton instance
const optimizedSafeStorage = new OptimizedSafeStorage();

// Export optimized interface with secure token methods
export const safeStorage = {
  init: (options) => optimizedSafeStorage.init(options), // ✅ CRITICAL FIX: Export init method with options
  getItem: (key) => optimizedSafeStorage.getItem(key),
  setItem: (key, value, options) => optimizedSafeStorage.setItem(key, value, options),
  removeItem: (key, options) => optimizedSafeStorage.removeItem(key, options),
  clearAuth: () => optimizedSafeStorage.clearAuth(),
  getStats: () => optimizedSafeStorage.getStats(),
  clearCache: () => optimizedSafeStorage.clearCache(),
  destroy: () => optimizedSafeStorage.destroy(), // ✅ Export destroy method
  
  // 🔧 Secure token methods - never fallback to AsyncStorage
  setToken: (token) => optimizedSafeStorage.setToken(token),
  getToken: () => optimizedSafeStorage.getToken(),
  clearToken: () => optimizedSafeStorage.clearToken(),
  
  // 🔧 Non-sensitive data methods
  setUserData: (userData) => optimizedSafeStorage.setUserData(userData),
  getUserData: () => optimizedSafeStorage.getUserData(),
};

// Export individual functions for backward compatibility
export const getItem = safeStorage.getItem;
export const setItem = safeStorage.setItem;
export const removeItem = safeStorage.removeItem;
export const clearAuth = safeStorage.clearAuth;

export default safeStorage;

