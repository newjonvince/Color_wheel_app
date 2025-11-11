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

  try {
    // Execute the API call (safeApiService already handles ready state)
    const result = await apiCall();
    return { success: true, data: result };
    
  } catch (error) {
    console.error('API call failed:', error);
    
    // Return structured error information for caller to handle UI
    const errorInfo = {
      success: false,
      error,
      errorType: 'unknown',
      userMessage: errorMessage,
      shouldShowAlert: true
    };

    // Classify error types for better handling
    if (error.message?.includes('Authentication required')) {
      errorInfo.errorType = 'authentication';
      errorInfo.userMessage = 'Please log in again';
    } else if (error.message?.includes('Network Error') || error.message?.includes('fetch')) {
      errorInfo.errorType = 'network';
      errorInfo.userMessage = 'Network connection failed. Please check your internet connection.';
    } else if (error.message?.includes('timeout')) {
      errorInfo.errorType = 'timeout';
      errorInfo.userMessage = 'Request timed out. Please try again.';
    }
    
    return errorInfo;
  }
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
  loadUserData: async (userId) => {
    return safeApiCall(
      () => ApiService.getUserProfile(userId),
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
