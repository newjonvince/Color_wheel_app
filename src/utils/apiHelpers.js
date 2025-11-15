// utils/apiHelpers.js - Shared API utility functions
import Constants from 'expo-constants';
import ApiService from '../services/safeApiService';

// Production-ready configuration
const extra = Constants.expoConfig?.extra || {};
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

/**
 * Wrapper for API calls that ensures service is ready and handles common errors
 * @param {Function} apiCall - The API call function to execute
 * @param {Object} options - Options for error handling
 */
export const safeApiCall = async (apiCall, options = {}) => {
  const { 
    errorMessage = 'An error occurred',
    retryCount = 0,
    showAlert // ✅ CONSISTENCY FIX: Accept showAlert option
  } = options;

  let lastError;
  
  // Try the API call with retries
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
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

  // ✅ Classify errors with appropriate alert behavior (unless showAlert explicitly provided)
  if (lastError.message?.includes('Authentication required')) {
    errorInfo.errorType = 'authentication';
    errorInfo.userMessage = 'Please log in again';
    if (showAlert === undefined) errorInfo.shouldShowAlert = true; // ✅ Always show for auth - user needs to take action
  } else if (lastError.message?.includes('Unable to connect to server')) {
    errorInfo.errorType = 'network';
    errorInfo.userMessage = 'Network connection failed. Please check your internet connection.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Don't show alert, show network indicator instead
  } else if (lastError.message?.includes('timed out')) {
    errorInfo.errorType = 'timeout';
    errorInfo.userMessage = 'Request timed out. Please try again.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Silent retry or show toast instead
  } else if (lastError.message?.includes('Rate limit exceeded')) {
    errorInfo.errorType = 'rate_limit';
    errorInfo.userMessage = 'Too many requests. Please wait a moment and try again.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Show toast, not blocking alert
  } else if (lastError.message?.includes('Server error')) {
    errorInfo.errorType = 'server_error';
    errorInfo.userMessage = 'Server is temporarily unavailable. Please try again later.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Show status indicator, not alert
  } else if (lastError.message?.includes('Validation failed') || lastError.message?.includes('Invalid')) {
    errorInfo.errorType = 'validation';
    if (showAlert === undefined) errorInfo.shouldShowAlert = true; // ✅ Show alert - user needs to fix input
  } else if (lastError.message?.includes('Not found') || lastError.message?.includes('Resource not found')) {
    errorInfo.errorType = 'not_found';
    errorInfo.userMessage = 'The requested resource was not found.';
    if (showAlert === undefined) errorInfo.shouldShowAlert = false; // ✅ Handle gracefully in UI
  } else {
    // Unknown errors - be conservative and show alert
    errorInfo.errorType = 'unknown';
    if (showAlert === undefined) errorInfo.shouldShowAlert = true; // ✅ Show alert for unknown errors
  }
  
  return errorInfo;
};

/**
 * Batch API calls with proper error handling
 * @param {Array} apiCalls - Array of API call functions
 * @param {Object} options - Options for error handling
 */
export const batchApiCalls = async (apiCalls, options = {}) => {
  const { 
    failFast = false,
    errorMessage = 'Some operations failed' 
  } = options;

  try {
    if (failFast) {
      // Stop on first error
      const results = [];
      for (const call of apiCalls) {
        const result = await call();
        results.push(result);
      }
      return { success: true, data: results };
    } else {
      // Execute all calls, collect errors
      const results = await Promise.allSettled(apiCalls.map(call => call()));
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
 * Common API patterns for different operations
 * ✅ All patterns now support request cancellation via AbortSignal
 */
export const apiPatterns = {
  // Load user data pattern
  loadUserData: async (options = {}) => {
    return safeApiCall(
      () => ApiService.getUserProfile(options),
      { errorMessage: 'Failed to load user data' }
    );
  },

  // Load color matches pattern
  loadColorMatches: async (options = {}) => {
    return safeApiCall(
      () => ApiService.getColorMatches(options),
      { errorMessage: 'Failed to load color matches' }
    );
  },

  // Load community posts pattern
  loadCommunityPosts: async (cursor = null, options = {}) => {
    return safeApiCall(
      () => {
        const params = cursor ? { cursor } : {};
        const qs = new URLSearchParams(params).toString();
        const endpoint = `/community/posts/community${qs ? `?${qs}` : ''}`;
        return ApiService.get(endpoint, options);
      },
      { errorMessage: 'Failed to load community posts' }
    );
  },

  // Like/unlike post pattern
  togglePostLike: async (postId, isLiked, options = {}) => {
    return safeApiCall(
      () => isLiked 
        ? ApiService.delete(`/community/posts/${postId}/like`, options)
        : ApiService.post(`/community/posts/${postId}/like`, {}, options),
      { errorMessage: 'Failed to update like status' }
    );
  },

  // Follow/unfollow user pattern
  toggleUserFollow: async (userId, isFollowing, options = {}) => {
    return safeApiCall(
      () => isFollowing
        ? ApiService.delete(`/community/users/${userId}/follow`, options)
        : ApiService.post(`/community/users/${userId}/follow`, {}, options),
      { errorMessage: 'Failed to update follow status' }
    );
  },

  // User registration pattern
  registerUser: async (registrationData, options = {}) => {
    return safeApiCall(
      () => ApiService.register(registrationData, options),
      { 
        errorMessage: 'Registration failed. Please try again.'
      }
    );
  },

  // Username availability check pattern
  checkUsernameAvailability: async (username, options = {}) => {
    const result = await safeApiCall(
      () => ApiService.checkUsername(username, options),
      { 
        errorMessage: 'Failed to check username availability'
      }
    );
    
    // For username checks, don't show alerts by default
    if (!result.success) {
      result.shouldShowAlert = false;
    }
    
    return result;
  }
};
