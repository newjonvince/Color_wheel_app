import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Production-ready configuration
const extra = Constants.expoConfig?.extra || {};
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

/**
 * Safe AsyncStorage wrapper with enhanced error handling for iOS production crashes
 * Addresses the RNCAsyncStorage _ensureSetup crash seen in TestFlight
 */
// ✅ SAFER: Add retry mechanism and don't permanently disable AsyncStorage
class SafeAsyncStorage {
  static instance = null;
  
  constructor() {
    if (SafeAsyncStorage.instance) {
      return SafeAsyncStorage.instance;
    }
    
    this.isAvailable = null;
    this.initPromise = null;
    this.fallbackStorage = new Map();
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.MAX_FAILURES = 3;
    this.RETRY_DELAY = 60000; // 1 minute
    
    // 🔧 Race condition prevention locks
    this.failureLock = false; // Prevent concurrent failure recording
    this.retryLock = false; // Prevent concurrent retry attempts
    
    SafeAsyncStorage.instance = this;
  }

  // 🔧 Thread-safe retry check
  shouldRetryAsyncStorage() {
    if (this.retryLock) return false; // Already retrying
    
    const now = Date.now();
    const backoffMultiplier = Math.min(this.failureCount, 5);
    const currentDelay = this.RETRY_DELAY * backoffMultiplier;
    
    if (now - this.lastFailureTime > currentDelay) {
      this.failureCount = Math.max(0, this.failureCount - 1);
      return true;
    }
    
    return this.failureCount < this.MAX_FAILURES;
  }

  // Thread-safe failure recording
  recordFailure() {
    if (this.failureLock) return; // Prevent concurrent updates
    
    this.failureLock = true;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.MAX_FAILURES) {
      console.warn(`⚠️ AsyncStorage failed ${this.failureCount} times`);
    }
    
    // Release lock after short delay to batch concurrent failures
    setTimeout(() => {
      this.failureLock = false;
    }, 100);
  }

  /**
   * 🔧 Ensure init() only runs once at a time
   */
  async init() {
    if (this.initPromise) {
      return this.initPromise; // Reuse existing initialization
    }

    this.initPromise = this._performInit();
    
    try {
      await this.initPromise;
    } finally {
      // 🔧 Clear promise after completion so future retries work
      setTimeout(() => {
        this.initPromise = null;
      }, 100);
    }
  }

  async _performInit() {
    try {
      if (IS_DEBUG_MODE) {
        console.log('🔄 Initializing SafeAsyncStorage...');
      }

      // Test basic AsyncStorage functionality with minimal operations
      const testKey = '__safe_storage_test__';
      const testValue = 'test_' + Date.now();

      // Use manual timeout pattern to prevent late rejections
      const asyncTest = (async () => {
        await AsyncStorage.setItem(testKey, testValue);
        const retrieved = await AsyncStorage.getItem(testKey);
        await AsyncStorage.removeItem(testKey);
        return retrieved === testValue;
      })();

      const testOperation = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(
          () => reject(new Error('AsyncStorage test timeout')),
          3000
        );

        asyncTest.then(
          (result) => { clearTimeout(timeoutId); resolve(result); },
          (error) => { clearTimeout(timeoutId); reject(error); }
        );
      });

      const success = await testOperation;
      
      if (success) {
        this.isAvailable = true;
        if (IS_DEBUG_MODE) {
          console.log('✅ AsyncStorage is available and working');
        }
      } else {
        throw new Error('AsyncStorage test failed - retrieved value mismatch');
      }

    } catch (error) {
      console.error('❌ AsyncStorage initialization failed:', error);
      this.isAvailable = false;
      
      // Don't throw - use fallback storage instead
      console.warn('⚠️ Using in-memory fallback storage');
    }
  }

  /**
   * Manual timeout pattern to prevent late rejections and memory leaks
   */
  _safeTimeout(asyncOperation, timeoutMs, operationName) {
    let timeoutId;
    let settled = false;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`${operationName} timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });

    return Promise.race([
      asyncOperation.then(
        (result) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            return result;
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            throw error;
          }
        }
      ),
      timeoutPromise
    ]).finally(() => {
      // ✅ Always cleanup
      if (timeoutId) clearTimeout(timeoutId);
    });
  }

  /**
   * 🔧 Safe getItem with proper locking
   */
  async getItem(key) {
    if (this.isAvailable === null) {
      await this.init();
    }

    // 🔧 Use lock to prevent concurrent retry attempts
    if (this.isAvailable === false && !this.retryLock && this.shouldRetryAsyncStorage()) {
      this.retryLock = true;
      
      try {
        if (IS_DEBUG_MODE) {
          console.log('🔄 Retrying AsyncStorage...');
        }
        await this.init();
      } finally {
        this.retryLock = false;
      }
    }

    if (this.isAvailable) {
      try {
        const getOperation = AsyncStorage.getItem(key);
        const result = await this._safeTimeout(getOperation, 5000, 'AsyncStorage.getItem');
        
        // 🔧 Only reset on first success
        if (this.failureCount > 0) {
          this.failureCount = 0;
          console.log('✅ AsyncStorage recovered');
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

    return this.fallbackStorage.get(key) || null;
  }

  /**
   * Safe setItem with fallback
   */
  async setItem(key, value) {
    if (this.isAvailable === null) {
      await this.init();
    }

    // 🔧 Use lock to prevent concurrent retry attempts
    if (this.isAvailable === false && !this.retryLock && this.shouldRetryAsyncStorage()) {
      this.retryLock = true;
      
      try {
        if (IS_DEBUG_MODE) {
          console.log('🔄 Retrying AsyncStorage...');
        }
        await this.init();
      } finally {
        this.retryLock = false;
      }
    }

    if (this.isAvailable) {
      try {
        const setOperation = AsyncStorage.setItem(key, value);
        await this._safeTimeout(setOperation, 5000, 'AsyncStorage.setItem');
        
        // 🔧 Only reset on first success
        if (this.failureCount > 0) {
          this.failureCount = 0;
          console.log('✅ AsyncStorage recovered');
        }
        
        return;
      } catch (error) {
        console.warn(`AsyncStorage.setItem failed for key "${key}":`, error);
        this.recordFailure();
        
        // Temporarily mark as unavailable (will retry after cooldown)
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isAvailable = false;
        }
      }
    }

    // Fallback to in-memory storage
    this.fallbackStorage.set(key, value);
  }

  /**
   * Safe removeItem with fallback
   */
  async removeItem(key) {
    if (this.isAvailable === null) {
      await this.init();
    }

    // Retry AsyncStorage after cooldown period
    if (this.isAvailable === false && this.shouldRetryAsyncStorage()) {
      if (IS_DEBUG_MODE) {
        console.log('🔄 Retrying AsyncStorage after cooldown...');
      }
      await this.init();
    }

    if (this.isAvailable) {
      try {
        const removeOperation = AsyncStorage.removeItem(key);
        await this._safeTimeout(removeOperation, 5000, 'AsyncStorage.removeItem');
        
        // Success! Reset failure count
        this.failureCount = 0;
        
        return;
      } catch (error) {
        console.warn(`AsyncStorage.removeItem failed for key "${key}":`, error);
        this.recordFailure();
        
        // Temporarily mark as unavailable (will retry after cooldown)
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isAvailable = false;
        }
      }
    }

    // Fallback to in-memory storage
    this.fallbackStorage.delete(key);
  }

  /**
   * Safe multiGet with fallback
   */
  async multiGet(keys) {
    if (this.isAvailable === null) {
      await this.init();
    }

    // Retry AsyncStorage after cooldown period
    if (this.isAvailable === false && this.shouldRetryAsyncStorage()) {
      if (IS_DEBUG_MODE) {
        console.log('🔄 Retrying AsyncStorage after cooldown...');
      }
      await this.init();
    }

    if (this.isAvailable) {
      try {
        const multiGetOperation = AsyncStorage.multiGet(keys);
        const result = await this._safeTimeout(multiGetOperation, 8000, 'AsyncStorage.multiGet');
        
        // Success! Reset failure count
        this.failureCount = 0;
        
        return result;
      } catch (error) {
        console.warn('AsyncStorage.multiGet failed:', error);
        this.recordFailure();
        
        // Temporarily mark as unavailable (will retry after cooldown)
        if (this.failureCount >= this.MAX_FAILURES) {
          this.isAvailable = false;
        }
      }
    }

    // Fallback to in-memory storage
    return keys.map(key => [key, this.fallbackStorage.get(key) || null]);
  }

  /**
   * Safe multiSet with fallback
   */
  async multiSet(keyValuePairs) {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable) {
      try {
        const multiSetOperation = AsyncStorage.multiSet(keyValuePairs);
        await this._safeTimeout(multiSetOperation, 8000, 'AsyncStorage.multiSet');
        return;
      } catch (error) {
        console.warn('AsyncStorage.multiSet failed:', error);
        this.isAvailable = false;
      }
    }

    // Fallback to in-memory storage
    keyValuePairs.forEach(([key, value]) => {
      this.fallbackStorage.set(key, value);
    });
  }

  /**
   * Safe multiRemove with fallback
   */
  async multiRemove(keys) {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable) {
      try {
        const multiRemoveOperation = AsyncStorage.multiRemove(keys);
        await this._safeTimeout(multiRemoveOperation, 8000, 'AsyncStorage.multiRemove');
        return;
      } catch (error) {
        console.warn('AsyncStorage.multiRemove failed:', error);
        this.isAvailable = false;
      }
    }

    // Fallback to in-memory storage
    keys.forEach(key => {
      this.fallbackStorage.delete(key);
    });
  }

  /**
   * Get all keys safely
   */
  async getAllKeys() {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable) {
      try {
        const getAllKeysOperation = AsyncStorage.getAllKeys();
        return await this._safeTimeout(getAllKeysOperation, 5000, 'AsyncStorage.getAllKeys');
      } catch (error) {
        console.warn('AsyncStorage.getAllKeys failed:', error);
        this.isAvailable = false;
      }
    }

    // Fallback to in-memory storage
    return Array.from(this.fallbackStorage.keys());
  }

  /**
   * Clear all data safely
   */
  async clear() {
    if (this.isAvailable === null) {
      await this.init();
    }

    if (this.isAvailable) {
      try {
        const clearOperation = AsyncStorage.clear();
        await this._safeTimeout(clearOperation, 5000, 'AsyncStorage.clear');
        return;
      } catch (error) {
        console.warn('AsyncStorage.clear failed:', error);
        this.isAvailable = false;
      }
    }

    // Fallback to in-memory storage
    this.fallbackStorage.clear();
  }

  /**
   * Check if AsyncStorage is available
   */
  isAsyncStorageAvailable() {
    return this.isAvailable === true;
  }

  /**
   * Get storage info
   */
  getStorageInfo() {
    return {
      isAsyncStorageAvailable: this.isAvailable,
      fallbackStorageSize: this.fallbackStorage.size,
      usingFallback: this.isAvailable === false
    };
  }
}

// Export singleton instance
export const safeAsyncStorage = new SafeAsyncStorage();
export default safeAsyncStorage;
