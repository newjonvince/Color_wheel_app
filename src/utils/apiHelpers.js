// utils/apiHelpers.js - Shared API utility functions
import ApiService from '../services/safeApiService';

/**
 * Wrapper for API calls that ensures service is ready and handles common errors
 * @param {Function} apiCall - The API call function to execute
 * @param {Object} options - Options for error handling
 */
export const safeApiCall = async (apiCall, options = {}) => {
  const { 
    errorMessage = 'An error occurred',
    retryCount = 0 
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
        
        if (__DEV__) {
          console.log(`Retrying API call (attempt ${attempt + 2}/${retryCount + 1}) after ${delay}ms`);
        }
      }
    }
  }
  
  // All attempts failed
  console.error(`API call failed after ${retryCount + 1} attempts:`, lastError);
  
  // Return structured error information for caller to handle UI
  const errorInfo = {
    success: false,
    error: lastError,
    errorType: 'unknown',
    userMessage: errorMessage,
    shouldShowAlert: true,
    attemptCount: retryCount + 1
  };

  // Classify error types for better handling (match safeApiService error messages)
  if (lastError.message?.includes('Authentication required')) {
    errorInfo.errorType = 'authentication';
    errorInfo.userMessage = 'Please log in again';
  } else if (lastError.message?.includes('Unable to connect to server')) {
    errorInfo.errorType = 'network';
    errorInfo.userMessage = 'Network connection failed. Please check your internet connection.';
  } else if (lastError.message?.includes('timed out')) {
    errorInfo.errorType = 'timeout';
    errorInfo.userMessage = 'Request timed out. Please try again.';
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
 */
export const apiPatterns = {
  // Load user data pattern
  loadUserData: async () => {
    return safeApiCall(
      () => ApiService.getUserProfile(),
      { errorMessage: 'Failed to load user data' }
    );
  },

  // Load color matches pattern
  loadColorMatches: async () => {
    return safeApiCall(
      () => ApiService.getColorMatches(),
      { errorMessage: 'Failed to load color matches' }
    );
  },

  // Load community posts pattern
  loadCommunityPosts: async (cursor = null) => {
    return safeApiCall(
      () => {
        const params = cursor ? { cursor } : {};
        const qs = new URLSearchParams(params).toString();
        const endpoint = `/community/posts/community${qs ? `?${qs}` : ''}`;
        return ApiService.get(endpoint);
      },
      { errorMessage: 'Failed to load community posts' }
    );
  },

  // Like/unlike post pattern
  togglePostLike: async (postId, isLiked) => {
    return safeApiCall(
      () => isLiked 
        ? ApiService.delete(`/community/posts/${postId}/like`)
        : ApiService.post(`/community/posts/${postId}/like`),
      { errorMessage: 'Failed to update like status' }
    );
  },

  // Follow/unfollow user pattern
  toggleUserFollow: async (userId, isFollowing) => {
    return safeApiCall(
      () => isFollowing
        ? ApiService.delete(`/community/users/${userId}/follow`)
        : ApiService.post(`/community/users/${userId}/follow`),
      { errorMessage: 'Failed to update follow status' }
    );
  },

  // User registration pattern
  registerUser: async (registrationData) => {
    return safeApiCall(
      () => ApiService.register(registrationData),
      { 
        errorMessage: 'Registration failed. Please try again.'
      }
    );
  },

  // Username availability check pattern
  checkUsernameAvailability: async (username) => {
    const result = await safeApiCall(
      () => ApiService.checkUsername(username),
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
