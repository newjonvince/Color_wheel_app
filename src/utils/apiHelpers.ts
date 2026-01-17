// utils/apiHelpers.ts - Typed API utility functions with request deduplication
// CRASH FIX: Removed direct import of expo-constants to prevent native bridge access at module load time
// expo-constants is not used in this file - it was a dead import

// CRASH FIX: Safe AbortController wrapper - not all React Native runtimes have AbortController
const isAbortControllerAvailable = typeof AbortController !== 'undefined';

const createSafeAbortController = (): AbortController => {
  if (isAbortControllerAvailable) {
    return new AbortController();
  }
  // Polyfill for environments without AbortController
  let aborted = false;
  const listeners: Array<() => void> = [];
  return {
    signal: {
      get aborted() { return aborted; },
      addEventListener: (type: string, handler: () => void) => { if (type === 'abort') listeners.push(handler); },
      removeEventListener: (type: string, handler: () => void) => {
        if (type === 'abort') {
          const idx = listeners.indexOf(handler);
          if (idx >= 0) listeners.splice(idx, 1);
        }
      },
    },
    abort: () => {
      if (!aborted) {
        aborted = true;
        listeners.forEach(h => { try { h(); } catch (_) {} });
      }
    },
  } as unknown as AbortController;
};

// LAZY LOADING: Avoid circular dependency with safeApiService
let apiService: any = null;
const getApiService = () => {
  if (apiService) return apiService;
  try {
    const serviceModule = require('../services/safeApiService');
    apiService = serviceModule.default || serviceModule;
  } catch (error: any) {
    console.warn('apiHelpers.ts: Failed to load safeApiService:', error.message);
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
let _loggerInstance: any = null;
const getLogger = () => {
  if (_loggerInstance) return _loggerInstance;
  try {
    const mod = require('./AppLogger');
    _loggerInstance = mod?.logger || mod?.default || console;
  } catch (error: any) {
    console.warn('apiHelpers.ts: AppLogger load failed, using console', error?.message || error);
    _loggerInstance = console;
  }
  return _loggerInstance;
};

const logger = {
  debug: (...args: any[]) => getLogger()?.debug?.(...args),
  info: (...args: any[]) => getLogger()?.info?.(...args),
  warn: (...args: any[]) => getLogger()?.warn?.(...args),
  error: (...args: any[]) => getLogger()?.error?.(...args),
};
import type {
  ApiCallOptions,
  SafeApiCallResult,
  BatchApiCallOptions,
  BatchApiCallResult,
  InflightRequest,
  CancellableRequest,
  ErrorType,
  ApiError,
  ApiCallFunction,
  CommunityPost,
  UserProfile,
  ColorMatch,
  PaginatedResponse
} from '../types/api';

// CRASH FIX: Lazy-load expo-constants to prevent native bridge access at module load time
let _expoConstants: any = undefined;
const getExpoConstants = (): any => {
  if (_expoConstants !== undefined) return _expoConstants;
  try {
    _expoConstants = require('expo-constants')?.default ?? null;
  } catch (error: any) {
    console.warn('apiHelpers.ts: expo-constants load failed', error?.message);
    _expoConstants = null;
  }
  return _expoConstants;
};

// Lazy getter for debug mode to avoid module-load-time native bridge access
let _isDebugMode: boolean | null = null;
const getIsDebugMode = (): boolean => {
  if (_isDebugMode !== null) return _isDebugMode;
  try {
    const Constants = getExpoConstants();
    const extra = Constants?.expoConfig?.extra || {};
    _isDebugMode = !!extra.EXPO_PUBLIC_DEBUG_MODE;
  } catch {
    _isDebugMode = false;
  }
  return _isDebugMode;
};

// Production-ready configuration - now uses lazy getter
const IS_DEBUG_MODE = (): boolean => getIsDebugMode();

// Request deduplication to prevent duplicate API calls
const inflightRequests = new Map<string, InflightRequest>();
const retryPromises = new Map<string, Promise<any>>(); // Store retry promises for concurrent calls
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_CACHE_SIZE = 100; // MEMORY FIX: Prevent unbounded Map growth causing Hermes memory pressure

/**
 * Deduplicated API call wrapper - prevents duplicate requests
 * @param key - Unique key for the request
 * @param apiCall - The API call function to execute
 * @param options - Options for error handling and cancellation
 */
const deduplicatedApiCall = async <T>(
  key: string,
  apiCall: ApiCallFunction<T>,
  options: ApiCallOptions = {}
): Promise<T | { cancelled: true }> => {
  const { signal } = options;
  
  // Check if already cancelled
  if (signal?.aborted) {
    throw new Error(`Request cancelled: ${key}`);
  }

  // Check if same request is already in flight
  if (inflightRequests.has(key)) {
    const cached = inflightRequests.get(key)!;
    
    // Check if cached promise is stale
    if (Date.now() - cached.timestamp < REQUEST_TIMEOUT) {
      logger.debug(`Reusing in-flight request: ${key}`);
      return cached.promise;
    } else {
      // Stale promise - remove and make new request
      logger.warn(`Cached request expired: ${key}`);
      inflightRequests.delete(key);
    }
  }

  // Create timeout wrapper
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout: ${key}`));
      inflightRequests.delete(key);
    }, REQUEST_TIMEOUT);
  });

  // Create cancellation wrapper
  // MEMORY FIX: Use { once: true } to auto-remove listener and prevent memory leaks
  const cancellationPromise = signal ? new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => {
      reject(new Error(`Request cancelled: ${key}`));
      inflightRequests.delete(key);
    }, { once: true });
  }) : null;

  // Race between API call, timeout, and cancellation
  const apiPromise = safeApiCall(apiCall, options);
  const promises: Promise<any>[] = [apiPromise, timeoutPromise];
  if (cancellationPromise) promises.push(cancellationPromise);
  
  const requestPromise = Promise.race(promises);

  // MEMORY FIX: Enforce MAX_CACHE_SIZE to prevent unbounded growth
  if (inflightRequests.size >= MAX_CACHE_SIZE) {
    // Remove oldest entries (first 10% of cache)
    const keysToRemove = Array.from(inflightRequests.keys()).slice(0, Math.ceil(MAX_CACHE_SIZE * 0.1));
    keysToRemove.forEach(k => inflightRequests.delete(k));
    logger.warn(`Pruned ${keysToRemove.length} stale requests from cache`);
  }

  // Store promise with timestamp
  inflightRequests.set(key, {
    promise: requestPromise,
    timestamp: Date.now()
  });

  try {
    const result = await requestPromise;
    return result;
  } catch (error) {
    // Don't throw cancellation errors to unmounted components
    if (signal?.aborted && (error as Error).message?.includes('cancelled')) {
      logger.debug(`Request cancelled gracefully: ${key}`);
      return { cancelled: true };
    }
    throw error;
  } finally {
    // Clean up on completion
    inflightRequests.delete(key);
  }
};

/**
 * Wrapper for API calls that ensures service is ready and handles common errors
 * @param apiCall - The API call function to execute
 * @param options - Options for error handling
 */
export const safeApiCall = async <T>(
  apiCall: ApiCallFunction<T>,
  options: ApiCallOptions = {}
): Promise<SafeApiCallResult<T>> => {
  const { 
    errorMessage = 'An error occurred',
    retryCount = 0,
    showAlert,
    signal
  } = options;

  // Generate retry key for this specific API call
  const retryKey = `${apiCall.toString().slice(0, 100)}-${JSON.stringify(options).slice(0, 50)}`;
  
  // Check if there's already a retry in progress for this call
  if (retryPromises.has(retryKey)) {
    logger.debug(`Waiting for existing retry: ${retryKey}`);
    try {
      return await retryPromises.get(retryKey)!;
    } catch (error) {
      // If the retry failed, we'll start our own retry below
      logger.warn(`Existing retry failed, starting new attempt: ${retryKey}`);
    }
  }

  // Create retry promise for concurrent calls to await
  const retryPromise = (async (): Promise<SafeApiCallResult<T>> => {
    let lastError: ApiError | undefined;
    
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // Check if cancelled before each attempt
        if (signal?.aborted) {
          throw new Error('Request cancelled');
        }

        const result = await apiCall();
        return { success: true, data: result };
        
      } catch (error) {
        lastError = error as ApiError;
        
        // Don't retry authentication errors - they won't succeed on retry
        if (lastError.status === 401 || lastError.code === 'UNAUTHORIZED') {
          break;
        }
        
        // If this isn't the last attempt, wait briefly before retrying
        if (attempt < retryCount) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 3000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          if (IS_DEBUG_MODE()) {
            console.log(`Retrying API call (attempt ${attempt + 2}/${retryCount + 1}) after ${delay}ms`);
          }
        }
      }
    }
    
    // All attempts failed - lastError should be defined here since we only reach this if there was an error
    if (!lastError) {
      lastError = { message: 'Unknown error occurred', name: 'UnknownError' } as ApiError;
    }
    
    console.error(`API call failed after ${retryCount + 1} attempts:`, lastError);
  
    const errorInfo: SafeApiCallResult<T> = {
      success: false,
      error: lastError,
      errorType: 'unknown' as ErrorType,
      userMessage: errorMessage,
      shouldShowAlert: showAlert !== undefined ? showAlert : true,
      attemptCount: retryCount + 1
    };

    // Classify errors using proper error properties instead of string matching
    if (lastError?.status === 401 || lastError?.code === 'UNAUTHORIZED' || lastError?.name === 'AuthenticationError') {
      errorInfo.errorType = 'authentication';
      errorInfo.userMessage = 'Please log in again';
      if (showAlert === undefined) errorInfo.shouldShowAlert = true;
    } else if (lastError?.code === 'NETWORK_ERROR' || lastError?.name === 'NetworkError' || !navigator.onLine) {
      errorInfo.errorType = 'network';
      errorInfo.userMessage = 'Network connection failed. Please check your internet connection.';
      if (showAlert === undefined) errorInfo.shouldShowAlert = false;
    } else if (lastError?.code === 'TIMEOUT' || lastError?.name === 'TimeoutError' || lastError?.message?.includes('timeout')) {
      errorInfo.errorType = 'timeout';
      errorInfo.userMessage = 'Request timed out. Please try again.';
      if (showAlert === undefined) errorInfo.shouldShowAlert = false;
    } else if (lastError?.status === 429 || lastError?.code === 'RATE_LIMIT' || lastError?.name === 'RateLimitError') {
      errorInfo.errorType = 'rate_limit';
      errorInfo.userMessage = 'Too many requests. Please wait a moment and try again.';
      if (showAlert === undefined) errorInfo.shouldShowAlert = false;
    } else if ((lastError?.status && lastError.status >= 500) || lastError?.code === 'SERVER_ERROR' || lastError?.name === 'ServerError') {
      errorInfo.errorType = 'server_error';
      errorInfo.userMessage = 'Server is temporarily unavailable. Please try again later.';
      if (showAlert === undefined) errorInfo.shouldShowAlert = false;
    } else if ((lastError?.status && lastError.status >= 400 && lastError.status < 500) || lastError?.code === 'VALIDATION_ERROR' || lastError?.name === 'ValidationError') {
      errorInfo.errorType = 'validation';
      errorInfo.userMessage = lastError?.message || 'Please check your input and try again.';
      if (showAlert === undefined) errorInfo.shouldShowAlert = true;
    } else if (lastError?.status === 404 || lastError?.code === 'NOT_FOUND' || lastError?.name === 'NotFoundError') {
      errorInfo.errorType = 'not_found';
      errorInfo.userMessage = 'The requested resource was not found.';
      if (showAlert === undefined) errorInfo.shouldShowAlert = false;
    } else if (lastError?.message?.includes('cancelled') || lastError?.code === 'CANCELLED') {
      errorInfo.errorType = 'cancelled';
      errorInfo.userMessage = 'Request was cancelled.';
      if (showAlert === undefined) errorInfo.shouldShowAlert = false;
    } else {
      errorInfo.errorType = 'unknown';
      if (showAlert === undefined) errorInfo.shouldShowAlert = true;
    }
    
    return errorInfo;
  })();

  // Store retry promise for concurrent calls
  if (retryCount > 0) {
    retryPromises.set(retryKey, retryPromise);
    
    // Clean up retry promise when done
    retryPromise.finally(() => {
      retryPromises.delete(retryKey);
      logger.debug(`Cleaned up retry promise: ${retryKey}`);
    });
  }

  return retryPromise;
};

/**
 * Batch API calls with proper error handling and cancellation support
 * @param apiCalls - Array of API call functions
 * @param options - Options for error handling and cancellation
 */
export const batchApiCalls = async <T>(
  apiCalls: ApiCallFunction<T>[],
  options: BatchApiCallOptions = {}
): Promise<BatchApiCallResult<T>> => {
  const { 
    failFast = false,
    errorMessage = 'Some operations failed',
    signal
  } = options;

  try {
    if (failFast) {
      // Cancel remaining on first error
      const controller = createSafeAbortController();
      const results: T[] = [];
      
      try {
        for (const call of apiCalls) {
          // Check if cancelled
          if (signal?.aborted || controller.signal.aborted) {
            throw new Error('Batch cancelled');
          }
          
          const result = await call();
          results.push(result);
        }
        return { success: true, data: results };
      } catch (error) {
        // Cancel all pending operations
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
      const errors = results.filter(r => r.status === 'rejected').map(r => r.reason as ApiError);
      
      return { 
        success: errors.length === 0, 
        data: successes, 
        errors,
        partialSuccess: successes.length > 0 && errors.length > 0
      };
    }
    
  } catch (error) {
    console.error('Batch API calls failed:', error);
    return { success: false, error: error as ApiError };
  }
};

/**
 * Request cancellation utilities
 */
export const createCancellableRequest = (): CancellableRequest => {
  const controller = createSafeAbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
    isCancelled: () => controller.signal.aborted
  };
};

export const cancelAllInflightRequests = (): void => {
  const count = inflightRequests.size;
  inflightRequests.clear();
  logger.warn(`Cancelled ${count} in-flight requests`);
};

/**
 * Typed API patterns for different operations
 * All read operations use deduplication, mutations do not
 */
export const apiPatterns = {
  // Deduplicated load community posts (using generic get method)
  loadCommunityPosts: async (cursor: string | null = null, options: ApiCallOptions = {}) => {
    const key = `community-posts-${cursor || 'initial'}`;
    const endpoint = cursor ? `/community/posts?cursor=${cursor}` : '/community/posts';
    
    return deduplicatedApiCall(
      key,
      () => getApiService().get(endpoint, options),
      { errorMessage: 'Failed to load community posts', ...options }
    ) as Promise<SafeApiCallResult<PaginatedResponse<CommunityPost>>>;
  },

  // Deduplicated user profile loading
  loadUserProfile: async (userId: string, options: ApiCallOptions = {}) => {
    const key = `user-profile-${userId}`;
    
    return deduplicatedApiCall(
      key,
      () => getApiService().getUserProfile(options),
      { errorMessage: 'Failed to load user profile', ...options }
    ) as Promise<SafeApiCallResult<UserProfile>>;
  },

  // Deduplicated user posts loading
  loadUserPosts: async (userId: string, cursor: string | null = null, options: ApiCallOptions = {}) => {
    const key = `user-posts-${userId}-${cursor || 'initial'}`;
    const endpoint = cursor ? `/users/${userId}/posts?cursor=${cursor}` : `/users/${userId}/posts`;
    
    return deduplicatedApiCall(
      key,
      () => getApiService().get(endpoint, options),
      { errorMessage: 'Failed to load user posts', ...options }
    ) as Promise<SafeApiCallResult<PaginatedResponse<CommunityPost>>>;
  },

  // Deduplicated followers loading
  loadUserFollowers: async (userId: string, options: ApiCallOptions = {}) => {
    const key = `user-followers-${userId}`;
    
    return deduplicatedApiCall(
      key,
      () => getApiService().get(`/users/${userId}/followers`, options),
      { errorMessage: 'Failed to load followers', ...options }
    ) as Promise<SafeApiCallResult<PaginatedResponse<UserProfile>>>;
  },

  // Deduplicated color matches loading
  loadColorMatches: async (options: ApiCallOptions = {}) => {
    const key = 'color-matches';
    
    return deduplicatedApiCall(
      key,
      () => getApiService().getColorMatches(options),
      { errorMessage: 'Failed to load color matches', ...options }
    ) as Promise<SafeApiCallResult<ColorMatch[]>>;
  },

  // Non-deduplicated operations (mutations should not be deduplicated)
  createColorMatch: async (colorMatchData: Partial<ColorMatch>, options: ApiCallOptions = {}) => {
    return safeApiCall(
      () => getApiService().createColorMatch(colorMatchData),
      { errorMessage: 'Failed to create color match', ...options }
    );
  },

  updateUserSettings: async (settings: Partial<UserProfile>, options: ApiCallOptions = {}) => {
    return safeApiCall(
      () => getApiService().updateSettings(settings),
      { errorMessage: 'Failed to update settings', ...options }
    );
  },

  // Non-deduplicated toggle operations (mutations)
  togglePostLike: async (postId: string, isLiked: boolean, options: ApiCallOptions = {}) => {
    return safeApiCall(
      () => isLiked 
        ? getApiService().delete(`/community/posts/${postId}/like`, options)
        : getApiService().post(`/community/posts/${postId}/like`, {}, options),
      { errorMessage: 'Failed to update like status', ...options }
    );
  },

  toggleUserFollow: async (userId: string, isFollowing: boolean, options: ApiCallOptions = {}) => {
    return safeApiCall(
      () => isFollowing
        ? getApiService().delete(`/community/users/${userId}/follow`, options)
        : getApiService().post(`/community/users/${userId}/follow`, {}, options),
      { errorMessage: 'Failed to update follow status', ...options }
    );
  },

  // Username availability with smart caching (deduplicated)
  checkUsernameAvailability: async (username: string, options: ApiCallOptions = {}) => {
    const key = `username-check-${username}`;
    
    const result = await deduplicatedApiCall(
      key,
      () => getApiService().checkUsername(username, options),
      { errorMessage: 'Failed to check username availability', ...options }
    );

    return result as SafeApiCallResult<{ available: boolean }>;
  },

  // Utility to clear specific request from cache
  clearRequestCache: (key: string): void => {
    inflightRequests.delete(key);
    logger.debug(`Cleared request cache for: ${key}`);
  },

  // Utility to clear all cached requests
  clearAllRequestCache: (): void => {
    const count = inflightRequests.size;
    inflightRequests.clear();
    logger.debug(`Cleared ${count} cached requests`);
  }
};

// CRASH FIX: Replace global setInterval with managed cleanup system
// Global intervals without cleanup can cause RCTFatal crashes when JS context changes
// (e.g., after app resumes from background after hours)
let staleRequestCleanupInterval: ReturnType<typeof setInterval> | null = null;

const cleanupStaleRequests = (): void => {
  try {
    const now = Date.now();
    for (const [key, cached] of inflightRequests.entries()) {
      if (now - cached.timestamp > REQUEST_TIMEOUT) {
        logger.warn(`Cleaning up stale request: ${key}`);
        inflightRequests.delete(key);
      }
    }
  } catch (error: any) {
    // Silently handle errors to prevent crashes in background cleanup
    console.warn('apiHelpers: stale request cleanup error:', error?.message);
  }
};

export const startStaleRequestCleanup = (): void => {
  if (staleRequestCleanupInterval) return; // Already running
  staleRequestCleanupInterval = setInterval(cleanupStaleRequests, 60000);
};

export const stopStaleRequestCleanup = (): void => {
  if (staleRequestCleanupInterval) {
    clearInterval(staleRequestCleanupInterval);
    staleRequestCleanupInterval = null;
  }
};

// Start cleanup only when explicitly called (not at module load time)
// This prevents timers from running before the app is fully initialized
