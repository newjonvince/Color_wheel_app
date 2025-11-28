import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Production-ready configuration
const getSafeExpoExtra = () => {
  try {
    const expoConfig = Constants?.expoConfig;
    if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
      return expoConfig.extra;
    }
    console.warn('safeAsyncStorage: expoConfig missing or malformed, using defaults');
  } catch (error) {
    console.warn('safeAsyncStorage: unable to read expoConfig safely, using defaults', error);
  }
  return {};
};

let cachedExtra = null;
const getExtra = () => {
  if (!cachedExtra) {
    cachedExtra = getSafeExpoExtra();
  }
  return cachedExtra;
};
const isDebugMode = () => !!getExtra().EXPO_PUBLIC_DEBUG_MODE;

const FALLBACK_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FALLBACK_MAX_ENTRIES = 100;

/**
 * Safe AsyncStorage wrapper with enhanced error handling for iOS production crashes
 */
class SafeAsyncStorage {
  static instance = null;
  
  constructor({ allowReinit = false } = {}) {
    if (SafeAsyncStorage.instance && !allowReinit) {
      return SafeAsyncStorage.instance;
    }
    
    this.isAvailable = null;
    this.initPromise = null;
    this.fallbackStorage = new Map();
    this.failureCount = 0;
    this.pendingFailures = 0;
    this.lastFailureTime = 0;
    this.MAX_FAILURES = 3;
    this.RETRY_DELAY = 60000; // 1 minute
    
    this.failureLock = false;
    this.retryLock = false;
    
    SafeAsyncStorage.instance = this;
  }

  static getInstance({ forceReset = false } = {}) {
    if (forceReset) {
      SafeAsyncStorage.instance = null;
    }
    if (!SafeAsyncStorage.instance) {
      SafeAsyncStorage.instance = new SafeAsyncStorage({ allowReinit: true });
    }
    return SafeAsyncStorage.instance;
  }

  shouldRetryAsyncStorage() {
    if (this.retryLock) return false;
    
    const now = Date.now();
    const backoffMultiplier = Math.min(this.failureCount, 5);
    const currentDelay = this.RETRY_DELAY * backoffMultiplier;
    
    if (now - this.lastFailureTime > currentDelay) {
      this.failureCount = Math.max(0, this.failureCount - 1);
      return true;
    }
    
    return this.failureCount < this.MAX_FAILURES;
  }

  recordFailure() {
    if (this.failureLock) {
      this.pendingFailures = (this.pendingFailures || 0) + 1;
      return;
    }
    
    this.failureLock = true;
    try {
      const totalFailures = 1 + (this.pendingFailures || 0);
      this.failureCount += totalFailures;
      this.pendingFailures = 0;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.MAX_FAILURES) {
        console.warn(`AsyncStorage failed ${this.failureCount} times`);
      }
    } finally {
      this.failureLock = false;
    }
  }

  async init() {
    if (this.isAvailable === true) {
      return;
    }
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        await this._performInit();
        this.isAvailable = true;
      } catch (error) {
        this.isAvailable = false;
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();
    
    return this.initPromise;
  }

  async _performInit() {
    try {
      console.log('🔧 Initializing SafeAsyncStorage...');

      const testKey = '__safe_storage_test__';
      const testValue = 'test_' + Date.now();

      console.log('📱 Testing AsyncStorage operations...');
      const asyncTest = (async () => {
        console.log('  - Testing setItem...');
        await AsyncStorage.setItem(testKey, testValue);
        console.log('  - Testing getItem...');
        const retrieved = await AsyncStorage.getItem(testKey);
        console.log('  - Testing removeItem...');
        await AsyncStorage.removeItem(testKey);
        console.log('  - Verifying data integrity...');
        return retrieved === testValue;
      })();

      const success = await this._safeTimeout(asyncTest, 5000, 'AsyncStorage test');
      
      if (success) {
        this.isAvailable = true;
        // Clear shadow fallback data on successful init to avoid stale state
        this.fallbackStorage.clear();
        if (isDebugMode()) {
          console.log('AsyncStorage is available and working');
        }
      } else {
        throw new Error('AsyncStorage test failed - retrieved value mismatch');
      }

    } catch (error) {
      console.error('AsyncStorage initialization failed:', error);
      this.isAvailable = false;
      console.warn('Using in-memory fallback storage');
    }
  }

  _safeTimeout(asyncOperation, timeoutMs, operationName) {
    // ✅ CRITICAL FIX: Manual timeout management to prevent uncaught promise rejections
    return new Promise((resolve, reject) => {
      let settled = false;
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
      
      let timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`${operationName} timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      
      asyncOperation.then(
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

  _setFallback(key, value) {
    const now = Date.now();
    // Drop expired entries opportunistically
    for (const [entryKey, entry] of this.fallbackStorage.entries()) {
      if (now - entry.timestamp > FALLBACK_TTL_MS) {
        this.fallbackStorage.delete(entryKey);
      }
    }

    this.fallbackStorage.set(key, { value, timestamp: now });
    if (this.fallbackStorage.size > FALLBACK_MAX_ENTRIES) {
      // Remove oldest entries to prevent unbounded growth
      const entries = Array.from(this.fallbackStorage.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, this.fallbackStorage.size - FALLBACK_MAX_ENTRIES);
      toRemove.forEach(([oldKey]) => this.fallbackStorage.delete(oldKey));
    }
  }

  async getItem(key) {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable === false && !this.retryLock && this.shouldRetryAsyncStorage()) {
      this.retryLock = true;
      try {
        if (isDebugMode()) {
          console.log('Retrying AsyncStorage...');
        }
        await this.init();
      } finally {
        this.retryLock = false;
      }
    }

    if (this.isAvailable) {
      try {
        const result = await this._safeTimeout(AsyncStorage.getItem(key), 5000, 'AsyncStorage.getItem');
        if (this.failureCount > 0) {
          this.failureCount = 0;
          if (isDebugMode()) console.log('AsyncStorage recovered');
        }
        // Drop shadow fallback copy on success
        if (this.fallbackStorage.has(key)) {
          this.fallbackStorage.delete(key);
        }
        return result;
      } catch (error) {
        console.warn(`AsyncStorage.getItem failed for key "${key}":`, error);
        this.recordFailure();
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isAvailable = false;
        }
      }
    }

    const fallbackEntry = this.fallbackStorage.get(key);
    if (fallbackEntry && Date.now() - fallbackEntry.timestamp < FALLBACK_TTL_MS) {
      return fallbackEntry.value;
    }
    // Expired or missing
    if (fallbackEntry) {
      this.fallbackStorage.delete(key);
    }
    return null;
  }

  async setItem(key, value) {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable === false && !this.retryLock && this.shouldRetryAsyncStorage()) {
      this.retryLock = true;
      try {
        if (isDebugMode()) {
          console.log('Retrying AsyncStorage...');
        }
        await this.init();
      } finally {
        this.retryLock = false;
      }
    }

    if (this.isAvailable) {
      try {
        await this._safeTimeout(AsyncStorage.setItem(key, value), 5000, 'AsyncStorage.setItem');
        if (this.failureCount > 0) {
          this.failureCount = 0;
          if (isDebugMode()) console.log('AsyncStorage recovered');
        }
        // Remove any shadow fallback value
        this.fallbackStorage.delete(key);
        return;
      } catch (error) {
        console.warn(`AsyncStorage.setItem failed for key "${key}":`, error);
        this.recordFailure();
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isAvailable = false;
        }
      }
    }

    // Store with TTL metadata in fallback
    this._setFallback(key, value);
  }

  async removeItem(key) {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable === false && this.shouldRetryAsyncStorage()) {
      if (isDebugMode()) {
        console.log('Retrying AsyncStorage after cooldown...');
      }
      await this.init();
    }

    if (this.isAvailable) {
      try {
        await this._safeTimeout(AsyncStorage.removeItem(key), 5000, 'AsyncStorage.removeItem');
        this.failureCount = 0;
        this.fallbackStorage.delete(key);
        return;
      } catch (error) {
        console.warn(`AsyncStorage.removeItem failed for key "${key}":`, error);
        this.recordFailure();
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isAvailable = false;
        }
      }
    }

    this.fallbackStorage.delete(key);
  }

  async multiGet(keys) {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable === false && this.shouldRetryAsyncStorage()) {
      if (isDebugMode()) {
        console.log('Retrying AsyncStorage after cooldown...');
      }
      await this.init();
    }

    if (this.isAvailable) {
      try {
        const result = await this._safeTimeout(AsyncStorage.multiGet(keys), 8000, 'AsyncStorage.multiGet');
        this.failureCount = 0;
        // On success, clear any shadow entries for these keys
        keys.forEach(key => this.fallbackStorage.delete(key));
        return result;
      } catch (error) {
        console.warn('AsyncStorage.multiGet failed:', error);
        this.recordFailure();
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isAvailable = false;
        }
      }
    }

    return keys.map(key => {
      const entry = this.fallbackStorage.get(key);
      if (entry && Date.now() - entry.timestamp < FALLBACK_TTL_MS) {
        return [key, entry.value];
      }
      if (entry) {
        this.fallbackStorage.delete(key);
      }
      return [key, null];
    });
  }

  async multiSet(keyValuePairs) {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable) {
      try {
        await this._safeTimeout(AsyncStorage.multiSet(keyValuePairs), 8000, 'AsyncStorage.multiSet');
        keyValuePairs.forEach(([key]) => this.fallbackStorage.delete(key));
        return;
      } catch (error) {
        console.warn('AsyncStorage.multiSet failed:', error);
        this.isAvailable = false;
      }
    }

    keyValuePairs.forEach(([key, value]) => {
      this._setFallback(key, value);
    });
  }

  async multiRemove(keys) {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable) {
      try {
        await this._safeTimeout(AsyncStorage.multiRemove(keys), 8000, 'AsyncStorage.multiRemove');
        return;
      } catch (error) {
        console.warn('AsyncStorage.multiRemove failed:', error);
        this.isAvailable = false;
      }
    }

    keys.forEach(key => {
      this.fallbackStorage.delete(key);
    });
  }

  async getAllKeys() {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable) {
      try {
        return await this._safeTimeout(AsyncStorage.getAllKeys(), 5000, 'AsyncStorage.getAllKeys');
      } catch (error) {
        console.warn('AsyncStorage.getAllKeys failed:', error);
        this.isAvailable = false;
      }
    }

    const now = Date.now();
    const keys = [];
    for (const [key, entry] of this.fallbackStorage.entries()) {
      if (entry && now - entry.timestamp < FALLBACK_TTL_MS) {
        keys.push(key);
      } else {
        this.fallbackStorage.delete(key);
      }
    }
    return keys;
  }

  async clear() {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable) {
      try {
        await this._safeTimeout(AsyncStorage.clear(), 5000, 'AsyncStorage.clear');
        this.fallbackStorage.clear();
        return;
      } catch (error) {
        console.warn('AsyncStorage.clear failed:', error);
        this.isAvailable = false;
      }
    }

    this.fallbackStorage.clear();
  }

  isAsyncStorageAvailable() {
    return this.isAvailable === true;
  }

  getStorageInfo() {
    return {
      isAsyncStorageAvailable: this.isAvailable,
      fallbackStorageSize: this.fallbackStorage.size,
      usingFallback: this.isAvailable === false
    };
  }
}

export const safeAsyncStorage = SafeAsyncStorage.getInstance();
export default safeAsyncStorage;
