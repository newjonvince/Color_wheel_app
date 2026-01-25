// CRASH FIX: Lazy-load AsyncStorage to prevent native bridge access at module load time
let _AsyncStorage = null;
let _isNativeAsyncStorage = null;
let _nativeAsyncStorageLoadError = null;
const getAsyncStorage = () => {
  if (_AsyncStorage) return _AsyncStorage;
  try {
    const mod = require('@react-native-async-storage/async-storage');
    _AsyncStorage = mod.default || mod;
    _isNativeAsyncStorage = true;
  } catch (error) {
    console.warn('safeAsyncStorage: AsyncStorage load failed', error?.message);
    _isNativeAsyncStorage = false;
    _nativeAsyncStorageLoadError = error;
    _AsyncStorage = {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
      multiGet: () => Promise.resolve([]),
      multiSet: () => Promise.resolve(),
      multiRemove: () => Promise.resolve(),
      getAllKeys: () => Promise.resolve([]),
      clear: () => Promise.resolve(),
    };
  }
  return _AsyncStorage;
};

// CIRCULAR DEPENDENCY FIX: Lazy load expoConfigHelper to prevent crash on module initialization
let _isDebugMode = null;
const getIsDebugMode = () => {
  if (_isDebugMode === null) {
    try {
      const helper = require('./expoConfigHelper');
      _isDebugMode = helper.isDebugMode ? helper.isDebugMode() : false;
    } catch (error) {
      console.warn('safeAsyncStorage: expoConfigHelper load failed', error?.message);
      _isDebugMode = false;
    }
  }
  return _isDebugMode;
};

const FALLBACK_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FALLBACK_MAX_ENTRIES = 100;

/**
 * Safe AsyncStorage wrapper with enhanced error handling for iOS production crashes
 * SINGLETON FIX: Proper singleton pattern implementation
 */
class SafeAsyncStorage {
  static instance = null;
  
  constructor() {
    // SINGLETON FIX: Private-ish constructor - prevent direct instantiation
    if (SafeAsyncStorage.instance) {
      throw new Error('Use SafeAsyncStorage.getInstance() instead of new SafeAsyncStorage()');
    }
    
    // Initialize instance properties
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
  }

  static getInstance({ forceReset = false } = {}) {
    // SINGLETON FIX: Proper singleton factory method
    if (forceReset && SafeAsyncStorage.instance) {
      // RACE CONDITION FIX: Clear cached initialization state on reset
      SafeAsyncStorage.instance.initPromise = null;
      SafeAsyncStorage.instance.isAvailable = null;
      // Clear the instance to allow recreation
      SafeAsyncStorage.instance = null;
    }
    
    if (!SafeAsyncStorage.instance) {
      // FIXED: Use new keyword properly
      // Temporarily clear instance check for construction
      const wasInstance = SafeAsyncStorage.instance;
      SafeAsyncStorage.instance = null;  // Allow construction
      
      try {
        SafeAsyncStorage.instance = new SafeAsyncStorage();
      } catch (error) {
        SafeAsyncStorage.instance = wasInstance;  // Restore on failure
        throw error;
      }
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

  async init(signal) {
    if (this.isAvailable === true) {
      return;
    }
    
    // ABORT SIGNAL: Check if already aborted
    if (signal?.aborted) {
      throw new Error('SafeAsyncStorage initialization aborted');
    }
    
    if (this.initPromise) {
      return this.initPromise;
    }

    // RACE CONDITION FIX: Create and assign promise atomically
    this.initPromise = (async () => {
      try {
        await this._performInit(signal);
        this.isAvailable = this.isAvailable === true;
      } catch (error) {
        this.isAvailable = false;
        throw error;
      }
      // RACE CONDITION FIX: Don't clear initPromise in finally block
      // Let it remain for subsequent calls to return the same result
    })();
    
    return this.initPromise;
  }

  async _performInit(signal) {
    try {
      if (_isNativeAsyncStorage === null) {
        getAsyncStorage();
      }

      // ABORT SIGNAL: Check if aborted before starting
      if (signal?.aborted) {
        throw new Error('SafeAsyncStorage initialization aborted');
      }

      if (_isNativeAsyncStorage === false) {
        this.isAvailable = false;
        console.warn('Using in-memory fallback storage');
        return;
      }

      const probeKey = '__safe_storage_probe__';
      const asyncProbe = (async () => {
        if (signal?.aborted) {
          throw new Error('AsyncStorage probe aborted');
        }
        await getAsyncStorage().getItem(probeKey);
        return true;
      })();

      const success = await this._safeTimeout(asyncProbe, 5000, 'AsyncStorage probe', signal);
      
      if (success) {
        this.isAvailable = true;
        // Clear shadow fallback data on successful init to avoid stale state
        this.fallbackStorage.clear();
      } else {
        throw new Error('AsyncStorage probe failed');
      }

    } catch (error) {
      console.error('AsyncStorage initialization failed:', error);
      this.isAvailable = false;
      console.warn('Using in-memory fallback storage');
    }
  }

  _safeTimeout(asyncOperation, timeoutMs, operationName, signal) {
    // CRITICAL FIX: Manual timeout management to prevent uncaught promise rejections
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = null;
      let abortListener = null;

      // ABORT SIGNAL: If already aborted, fail fast (avoid TDZ issues)
      if (signal?.aborted) {
        reject(new Error(`${operationName} aborted`));
        return;
      }
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (abortListener && signal?.removeEventListener) {
          signal.removeEventListener('abort', abortListener);
        }
      };
      
      // ABORT SIGNAL: Set up abort listener
      if (signal?.addEventListener) {
        abortListener = () => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(new Error(`${operationName} aborted`));
          }
        };

        signal.addEventListener('abort', abortListener, { once: true });
      }

      timeoutId = setTimeout(() => {
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
        // SAFETY: Catch any remaining promise rejections
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
        if (getIsDebugMode()) {
          console.log('Retrying AsyncStorage...');
        }
        await this.init();
      } finally {
        this.retryLock = false;
      }
    }

    if (this.isAvailable) {
      try {
        const result = await this._safeTimeout(getAsyncStorage().getItem(key), 5000, 'getAsyncStorage().getItem');
        if (this.failureCount > 0) {
          this.failureCount = 0;
          if (getIsDebugMode()) console.log('AsyncStorage recovered');
        }
        // Drop shadow fallback copy on success
        if (this.fallbackStorage.has(key)) {
          this.fallbackStorage.delete(key);
        }
        return result;
      } catch (error) {
        console.warn(`getAsyncStorage().getItem failed for key "${key}":`, error);
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
        if (getIsDebugMode()) {
          console.log('Retrying AsyncStorage...');
        }
        await this.init();
      } finally {
        this.retryLock = false;
      }
    }

    if (this.isAvailable) {
      try {
        await this._safeTimeout(getAsyncStorage().setItem(key, value), 5000, 'getAsyncStorage().setItem');
        if (this.failureCount > 0) {
          this.failureCount = 0;
          if (getIsDebugMode()) console.log('AsyncStorage recovered');
        }
        // Remove any shadow fallback value
        this.fallbackStorage.delete(key);
        return;
      } catch (error) {
        console.warn(`getAsyncStorage().setItem failed for key "${key}":`, error);
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
      if (getIsDebugMode()) {
        console.log('Retrying AsyncStorage after cooldown...');
      }
      await this.init();
    }

    if (this.isAvailable) {
      try {
        await this._safeTimeout(getAsyncStorage().removeItem(key), 5000, 'getAsyncStorage().removeItem');
        this.failureCount = 0;
        this.fallbackStorage.delete(key);
        return;
      } catch (error) {
        console.warn(`getAsyncStorage().removeItem failed for key "${key}":`, error);
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
      if (getIsDebugMode()) {
        console.log('Retrying AsyncStorage after cooldown...');
      }
      await this.init();
    }

    if (this.isAvailable) {
      try {
        const result = await this._safeTimeout(getAsyncStorage().multiGet(keys), 8000, 'getAsyncStorage().multiGet');
        this.failureCount = 0;
        // On success, clear any shadow entries for these keys
        keys.forEach(key => this.fallbackStorage.delete(key));
        return result;
      } catch (error) {
        console.warn('getAsyncStorage().multiGet failed:', error);
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
        await this._safeTimeout(getAsyncStorage().multiSet(keyValuePairs), 8000, 'getAsyncStorage().multiSet');
        keyValuePairs.forEach(([key]) => this.fallbackStorage.delete(key));
        return;
      } catch (error) {
        console.warn('getAsyncStorage().multiSet failed:', error);
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
        await this._safeTimeout(getAsyncStorage().multiRemove(keys), 8000, 'getAsyncStorage().multiRemove');
        return;
      } catch (error) {
        console.warn('getAsyncStorage().multiRemove failed:', error);
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
        return await this._safeTimeout(getAsyncStorage().getAllKeys(), 5000, 'getAsyncStorage().getAllKeys');
      } catch (error) {
        console.warn('getAsyncStorage().getAllKeys failed:', error);
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
        await this._safeTimeout(getAsyncStorage().clear(), 5000, 'getAsyncStorage().clear');
        this.fallbackStorage.clear();
        return;
      } catch (error) {
        console.warn('getAsyncStorage().clear failed:', error);
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

let _safeAsyncStorageInstance = null;
let _safeAsyncStorageInstanceLoadAttempted = false;
let _safeAsyncStorageInstanceLoadError = null;

const getSafeAsyncStorageInstance = () => {
  if (_safeAsyncStorageInstanceLoadAttempted) return _safeAsyncStorageInstance;
  _safeAsyncStorageInstanceLoadAttempted = true;
  try {
    _safeAsyncStorageInstance = SafeAsyncStorage.getInstance();
  } catch (error) {
    _safeAsyncStorageInstanceLoadError = error;
    console.warn('safeAsyncStorage: SafeAsyncStorage.getInstance failed', error?.message);
    _safeAsyncStorageInstance = {
      init: async () => {},
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
      multiGet: async () => [],
      multiSet: async () => {},
      multiRemove: async () => {},
      getAllKeys: async () => [],
      clear: async () => {},
      isAsyncStorageAvailable: () => false,
      getStorageInfo: () => ({
        isAsyncStorageAvailable: false,
        fallbackStorageSize: 0,
        usingFallback: true,
        error: _safeAsyncStorageInstanceLoadError?.message
      }),
    };
  }
  return _safeAsyncStorageInstance;
};

const callAsync = (methodName, defaultValue) => async (...args) => {
  const instance = getSafeAsyncStorageInstance();
  const method = instance && instance[methodName];
  if (typeof method === 'function') {
    return method.apply(instance, args);
  }
  return defaultValue;
};

export const safeAsyncStorage = {
  init: callAsync('init'),
  getItem: callAsync('getItem', null),
  setItem: callAsync('setItem'),
  removeItem: callAsync('removeItem'),
  multiGet: callAsync('multiGet', []),
  multiSet: callAsync('multiSet'),
  multiRemove: callAsync('multiRemove'),
  getAllKeys: callAsync('getAllKeys', []),
  clear: callAsync('clear'),
  isAsyncStorageAvailable: () => {
    const instance = getSafeAsyncStorageInstance();
    return typeof instance?.isAsyncStorageAvailable === 'function'
      ? instance.isAsyncStorageAvailable()
      : false;
  },
  getStorageInfo: () => {
    const instance = getSafeAsyncStorageInstance();
    return typeof instance?.getStorageInfo === 'function'
      ? instance.getStorageInfo()
      : {
          isAsyncStorageAvailable: false,
          fallbackStorageSize: 0,
          usingFallback: true,
          error: _safeAsyncStorageInstanceLoadError?.message
        };
  },
};

export default safeAsyncStorage;
