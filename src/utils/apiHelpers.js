// utils/apiHelpers.js - Shared API utility functions with request deduplication
import Constants from 'expo-constants';

// ✅ LAZY LOADING: Avoid circular dependency with safeApiService
let apiService = null;
const getApiService = () => {
  if (apiService) return apiService;
  try {
    const serviceModule = require('../services/safeApiService');
    apiService = serviceModule.default || serviceModule;
  } catch (error) {
    console.warn('apiHelpers: Failed to load safeApiService:', error.message);
    // Create fallback service
    apiService = {
      get: () => Promise.reject(new Error('API service not available')),
      post: () => Promise.reject(new Error('API service not available')),
      delete: () => Promise.reject(new Error('API service not available')),
      getUserProfile: () => Promise.reject(new Error('API service not available')),
      getColorMatches: () => Promise.reject(new Error('API service not available')),
      createColorMatch: () => Promise.reject(new Error('API service not available')),
      updateSettings: () => Promise.reject(new Error('API service not available')),
      checkUsername: () => Promise.reject(new Error('API service not available'))
    };
  }
  return apiService;
};

// Lazy logger proxy to avoid circular import crashes
let _loggerInstance = null;
const getLogger = () => {
  if (_loggerInstance) return _loggerInstance;
  try {
    const mod = require('./AppLogger');
    _loggerInstance = mod?.logger || mod?.default || console;
  } catch (error) {
    console.warn('apiHelpers: AppLogger load failed, using console', error?.message || error);
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

// Production-ready configuration
const getSafeExpoExtra = () => {
  try {
    const expoConfig = Constants?.expoConfig;
    if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
      return expoConfig.extra;
    }
    console.warn('apiHelpers: expoConfig missing or malformed, using defaults');
  } catch (error) {
    console.warn('apiHelpers: unable to read expoConfig safely, using defaults', error);
  }
  return {};
};

const extra = getSafeExpoExtra();
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

// 🔧 React Native compatible network error detection
const isNetworkError = (error) => {
  if (!error) return false;
  
  // Check common network error patterns
  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';
  
  return (
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('fetch') ||
    name.includes('network') ||
    error.code === 'NETWORK_ERROR' ||
    error.status === 0 || // Often indicates network failure
    !error.status // No status usually means network issue
  );
};

// 🔧 Request deduplication to prevent duplicate API calls
const inflightRequests = new Map();
const retryPromises = new Map(); // 🔧 Store retry promises for concurrent calls
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Deduplicated API call wrapper - prevents duplicate requests
 * @param {string} key - Unique key for the request
 * @param {Function} apiCall - The API call function to execute
 * @param {Object} options - Options for error handling and cancellation
 */
const deduplicatedApiCall = async (key, apiCall, options = {}) => {
  const { signal, maxAge = REQUEST_TIMEOUT } = options; // Accept cancellation signal and configurable max age
  // 🔧 Check if already cancelled
  if (signal?.aborted) {
    throw new Error(`Request cancelled: ${key}`);
  }

  // Check if same request is already in flight
  if (inflightRequests.has(key)) {
    const cached = inflightRequests.get(key);
    
    // 🔧 Check if cached promise is stale
    if (Date.now() - cached.timestamp < maxAge) {
      logger.debug(`🔄 Reusing in-flight request: ${key}`);
      return cached.promise;
    } else {
      // 🔧 Stale promise - remove and make new request
      logger.warn(`⏰ Cached request expired: ${key}`);
      inflightRequests.delete(key);
    }
  }

  // ✅ CRITICAL FIX: Manual timeout/cancellation management to prevent uncaught promise rejections
  const apiPromise = safeApiCall(apiCall, options);
  
  const requestPromise = new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;
    let abortHandler = null;
    
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (abortHandler && signal) {
        signal.removeEventListener('abort', abortHandler);
        abortHandler = null;
      }
    };
    
    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        inflightRequests.delete(key);
        reject(new Error(`Request timeout: ${key}`));
      }
    }, REQUEST_TIMEOUT);
    
    // Set up cancellation
    if (signal) {
      abortHandler = () => {
        if (!settled) {
          settled = true;
          cleanup();
          inflightRequests.delete(key);
          reject(new Error(`Request cancelled: ${key}`));
        }
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
    
    // Handle API promise
    apiPromise.then(
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
          inflightRequests.delete(key);
          reject(error);
        }
      }
    ).catch((error) => {
      // ✅ SAFETY: Catch any remaining promise rejections
      if (!settled) {
        settled = true;
        cleanup();
        inflightRequests.delete(key);
        reject(error);
      }
    });
  });

  // 🔧 Store promise with timestamp
  inflightRequests.set(key, {
    promise: requestPromise,
    timestamp: Date.now()
  });

  try {
    const result = await requestPromise;
    if (result && result.cancelled) {
      return result;
    }
    return unwrapSafeApiResult(result, key);
  } catch (error) {
    // 🔧 Don't throw cancellation errors to unmounted components
    if (signal?.aborted && error.message?.includes('cancelled')) {
      logger.debug(`📋 Request cancelled gracefully: ${key}`);
      return { cancelled: true }; // Return safe object instead of throwing
    }
    // 🔧 Always clean up on error
    throw error;
  } finally {
    // 🔧 Clean up timeout to prevent memory leak
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    // 🔧 Clean up on completion
    inflightRequests.delete(key);
  }
};

const unwrapSafeApiResult = (result, key) => {
  if (result && result.cancelled) return result;
  if (result && result.success) return result.data;

  const err =
    (result && result.error) ||
    new Error(
      (result && result.userMessage) ||
        `Request failed${key ? ` for ${key}` : ''}`
    );
  err.safeApiResult = result;
  err.requestKey = key;
  throw err;
};

/**
 * Wrapper for API calls that ensures service is ready and handles common errors
 * @param {Function} apiCall - The API call function to execute
 * @param {Object} options - Options for error handling
 */
export const safeApiCall = async (apiCall, options = {}) => {
  const { 
    errorMessage = 'An error occurred',
    retryCount = 0,
    showAlert, // ✅ CONSISTENCY FIX: Accept showAlert option
    signal
  } = options;

  // 🔧 Generate retry key for this specific API call
  const retryKey = `${apiCall.toString().slice(0, 100)}-${JSON.stringify(options).slice(0, 50)}`;
  
  // 🔧 Check if there's already a retry in progress for this call
  if (retryPromises.has(retryKey)) {
    logger.debug(`⏳ Waiting for existing retry: ${retryKey}`);
    try {
      return await retryPromises.get(retryKey);
    } catch (error) {
      // If the retry failed, we'll start our own retry below
      logger.warn(`🔄 Existing retry failed, starting new attempt: ${retryKey}`);
    }
  }

  // 🔧 Create retry promise for concurrent calls to await
  const retryPromise = (async () => {
    let lastError;
    
    // Try the API call with retries
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // Check if cancelled before each attempt
        if (signal?.aborted) {
          throw new Error('Request cancelled');
        }
        
        // Execute the API call (safeApiService already handles ready state)
        const result = await apiCall();
        return { success: true, data: result };
      
      } catch (error) {
        lastError = error;
        
        // Don't retry authentication errors - they won't succeed on retry
        if (error.message?.includes('Authentication required')) {
          break;
        }
        
        // If this isn't the last attempt, wait briefly before retrying
        if (attempt < retryCount) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 3000); // Exponential backoff, max 3s
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Log retry attempts only in debug mode
          if (IS_DEBUG_MODE) {
            console.log(`🔄 Retrying API call (attempt ${attempt + 2}/${retryCount + 1}) after ${delay}ms`);
          }
        }
      }
    }
    
    // All attempts failed
    console.error(`API call failed after ${retryCount + 1} attempts:`, lastError);
  
  // ✅ More nuanced alert logic - Return structured error information for caller to handle UI
  const errorInfo = {
    success: false,
    error: lastError,
    errorType: 'unknown',
    userMessage: errorMessage,
    shouldShowAlert: showAlert !== undefined ? showAlert : true, // ✅ Use showAlert option if provided
    attemptCount: retryCount + 1
  };

  // 🔧 Classify errors using proper error properties instead of string matching
  if (lastError.status === 401 || lastError.code === 'UNAUTHORIZED' || lastError.name === 'AuthenticationError') {
    errorInfo.errorType = 'authentication';
    errorInfo.userMessage = 'Please log in again';
    if (showAlert === undefined) errorInfo.shouldShowAlert = true; // ✅ Always show for auth - user needs to take action
  } else if (lastError.code === 'NETWORK_ERROR' || lastError.name === 'NetworkError' || isNetworkError(lastError)) {
    errorInfo.errorType = 'network';
    errorInfo.userMessage = 'Network connection failed. Please check your internet connection.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Don't show alert, show network indicator instead
  } else if (lastError.code === 'TIMEOUT' || lastError.name === 'TimeoutError' || lastError.message?.includes('timeout')) {
    errorInfo.errorType = 'timeout';
    errorInfo.userMessage = 'Request timed out. Please try again.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Silent retry or show toast instead
  } else if (lastError.status === 429 || lastError.code === 'RATE_LIMIT' || lastError.name === 'RateLimitError') {
    errorInfo.errorType = 'rate_limit';
    errorInfo.userMessage = 'Too many requests. Please wait a moment and try again.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Show toast, not blocking alert
  } else if (lastError.status >= 500 || lastError.code === 'SERVER_ERROR' || lastError.name === 'ServerError') {
    errorInfo.errorType = 'server_error';
    errorInfo.userMessage = 'Server is temporarily unavailable. Please try again later.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Show status indicator, not alert
  } else if (lastError.status >= 400 && lastError.status < 500 || lastError.code === 'VALIDATION_ERROR' || lastError.name === 'ValidationError') {
    errorInfo.errorType = 'validation';
    errorInfo.userMessage = lastError.message || 'Please check your input and try again.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = true; // ✅ Show alert - user needs to fix input
  } else if (lastError.status === 404 || lastError.code === 'NOT_FOUND' || lastError.name === 'NotFoundError') {
    errorInfo.errorType = 'not_found';
    errorInfo.userMessage = 'The requested resource was not found.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Handle gracefully in UI
  } else if (lastError.message?.includes('cancelled') || lastError.code === 'CANCELLED') {
    errorInfo.errorType = 'cancelled';
    errorInfo.userMessage = 'Request was cancelled.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Don't show alert for cancellations
  } else {
    // Unknown errors - be conservative and show alert
    errorInfo.errorType = 'unknown';
    if (showAlert === undefined) errorInfo.shouldShowAlert = true; // ✅ Show alert for unknown errors
  }
    
    return errorInfo;
  })();

  // 🔧 Store retry promise for concurrent calls
  if (retryCount > 0) {
    retryPromises.set(retryKey, retryPromise);
    
    // 🔧 Clean up retry promise when done with error handling
    retryPromise.finally(() => {
      try {
        retryPromises.delete(retryKey);
        logger.debug(`🧹 Cleaned up retry promise: ${retryKey}`);
      } catch (error) {
        logger.error('🚨 Error during retry cleanup:', error);
      }
    });
  }

  return retryPromise;
};

/**
 * Batch API calls with proper error handling and cancellation support
 * @param {Array} apiCalls - Array of API call functions
 * @param {Object} options - Options for error handling and cancellation
 */
export const batchApiCalls = async (apiCalls, options = {}) => {
  const { 
    failFast = false,
    errorMessage = 'Some operations failed',
    signal // 🔧 Accept cancellation signal
  } = options;

  try {
    if (failFast) {
      // 🔧 Cancel remaining on first error
      const controller = new AbortController();
      const results = [];
      
      try {
        for (const call of apiCalls) {
          // 🔧 Check if cancelled
          if (signal?.aborted || controller.signal.aborted) {
            throw new Error('Batch cancelled');
          }
          
          const result = await call();
          results.push(result);
        }
        return { success: true, data: results };
      } catch (error) {
        // 🔧 Cancel all pending operations
        controller.abort();
        throw error;
      }
    } else {
      // Execute all calls, collect errors
      const results = await Promise.allSettled(
        apiCalls.map(call => 
          signal?.aborted 
            ? Promise.reject(new Error('Batch cancelled'))
            : call()
        )
      );
      
      const successes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      const errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
      
      return { 
        success: errors.length === 0, 
        data: successes, 
        errors,
        partialSuccess: successes.length > 0 && errors.length > 0
      };
    }
    
  } catch (error) {
    console.error('Batch API calls failed:', error);
    return { success: false, error };
  }
};

/**
 * 🔧 Request cancellation utilities
 */
export const createCancellableRequest = () => {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
    isCancelled: () => controller.signal.aborted
  };
};

export const cancelAllInflightRequests = () => {
  const count = inflightRequests.size;
  inflightRequests.clear();
  logger.warn(`🚫 Cancelled ${count} in-flight requests`);
};

/**
 * 🔧 Deduplicated API patterns for different operations
 * All read operations use deduplication, mutations do not
 */
export const apiPatterns = {
  // 🔧 Deduplicated load community posts
  loadCommunityPosts: async (cursor = null, options = {}) => {
    const key = `community-posts-${cursor || 'initial'}`;
    
    return deduplicatedApiCall(
      key,
      () => {
        const params = cursor ? { cursor } : {};
        const qs = new URLSearchParams(params).toString();
        const endpoint = `/community/posts/community${qs ? `?${qs}` : ''}`;
        return getApiService().get(endpoint, options);
      },
      { errorMessage: 'Failed to load community posts', maxAge: 5000 }
    );
  },

  // 🔧 Deduplicated user profile load
  loadUserData: async (options = {}) => {
    return deduplicatedApiCall(
      'user-profile',
      () => getApiService().getUserProfile(options),
      { errorMessage: 'Failed to load user data' }
    );
  },

  // 🔧 Deduplicated color matches load
  loadColorMatches: async (options = {}) => {
    const { limit = 20, offset = 0 } = options;
    const key = `color-matches-${limit}-${offset}`;
    
    return deduplicatedApiCall(
      key,
      () => getApiService().getColorMatches({ limit, offset, ...options }),
      { errorMessage: 'Failed to load color matches', maxAge: 5000 }
    );
  },

  // 🔧 Deduplicated user settings load
  loadUserSettings: async (options = {}) => {
    return deduplicatedApiCall(
      'user-settings',
      () => getApiService().get('/users/preferences', options),
      { errorMessage: 'Failed to load user settings' }
    );
  },

  // 🔧 Non-deduplicated operations (mutations should not be deduplicated)
  createColorMatch: async (colorMatchData, options = {}) => {
    return safeApiCall(
      () => getApiService().createColorMatch(colorMatchData, options),
      { errorMessage: 'Failed to create color match' }
    );
  },

  updateUserSettings: async (settings, options = {}) => {
    return safeApiCall(
      () => getApiService().updateSettings(settings, options),
      { errorMessage: 'Failed to update settings' }
    );
  },

  // 🔧 Non-deduplicated toggle operations (mutations)
  togglePostLike: async (postId, isLiked, options = {}) => {
    return safeApiCall(
      () => isLiked 
        ? getApiService().delete(`/community/posts/${postId}/like`, options)
        : getApiService().post(`/community/posts/${postId}/like`, {}, options),
      { errorMessage: 'Failed to update like status' }
    );
  },

  toggleUserFollow: async (userId, isFollowing, options = {}) => {
    return safeApiCall(
      () => isFollowing
        ? getApiService().delete(`/community/users/${userId}/follow`, options)
        : getApiService().post(`/community/users/${userId}/follow`, {}, options),
      { errorMessage: 'Failed to update follow status' }
    );
  },

  // 🔧 Username availability with smart caching (deduplicated)
  checkUsernameAvailability: async (username, options = {}) => {
    const key = `username-check-${username}`;
    
    const result = await deduplicatedApiCall(
      key,
      () => getApiService().checkUsername(username, options),
      { errorMessage: 'Failed to check username availability' }
    );
    
    // For username checks, don't show alerts by default
    if (!result.success) {
      result.shouldShowAlert = false;
    }
    
    return result;
  },

  // 🔧 Utility to clear specific request from cache
  clearRequestCache: (key) => {
    inflightRequests.delete(key);
    logger.debug(`🧹 Cleared request cache for: ${key}`);
  },

  // 🔧 Utility to clear all cached requests
  clearAllRequestCache: () => {
    const count = inflightRequests.size;
    inflightRequests.clear();
    logger.debug(`🧹 Cleared ${count} cached requests`);
  }
};

// dY"? Add periodic cleanup of stale requests with error handling
let cleanupIntervalId = null;

export const startCleanupInterval = () => {
  if (cleanupIntervalId) {
    return; // Already running
  }

  try {
    cleanupIntervalId = setInterval(() => {
      try {
        const now = Date.now();
        for (const [key, cached] of inflightRequests.entries()) {
          if (now - cached.timestamp > REQUEST_TIMEOUT) {
            logger.warn(`dY1 Cleaning up stale request: ${key}`);
            inflightRequests.delete(key);
          }
        }
      } catch (error) {
        logger.error('dYs" Error during request cleanup:', error);
      }
    }, 60000); // Clean up every minute
    logger.info('dY>` Started API cleanup interval');
  } catch (error) {
    logger.error('dYs" Failed to start cleanup interval:', error);
  }
};

// Export cleanup function to stop the interval if needed
export const stopCleanupInterval = () => {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    logger.info('dY>` Stopped API cleanup interval');
  }
};

// Start automatically on module load
startCleanupInterval();
