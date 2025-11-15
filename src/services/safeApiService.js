// services/safeApiService.js - API service with safe dependency handling
import axios from 'axios';
import { safeStorage } from '../utils/safeStorage';

// Request cancellation support
const CancelToken = axios.CancelToken;

// Safe API configuration with URL validation
const getApiBaseUrl = () => {
  try {
    const Constants = require('expo-constants').default;
    
    // Safe access to expo config with type validation
    const expoConfig = Constants?.expoConfig;
    const extra = expoConfig && typeof expoConfig === 'object' ? expoConfig.extra : null;
    const apiUrl = extra && typeof extra === 'object' ? extra.EXPO_PUBLIC_API_BASE_URL : null;
    
    if (apiUrl && typeof apiUrl === 'string') {
      return apiUrl;
    }
  } catch (error) {
    console.warn('Failed to load Expo Constants:', error.message);
    // Always log Expo Constants errors for production debugging
    console.error('Expo Constants error details:', error);
  }
  
  return process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'https://colorwheelapp-production.up.railway.app';
};

// Safe URL construction with validation
const buildApiRoot = () => {
  try {
    const baseUrl = getApiBaseUrl();
    
    // Validate URL format
    if (!baseUrl || typeof baseUrl !== 'string') {
      throw new Error('Invalid base URL: must be a non-empty string');
    }
    
    // Basic URL validation
    if (!baseUrl.match(/^https?:\/\/.+/)) {
      throw new Error(`Invalid URL format: ${baseUrl}`);
    }
    
    const HOST = baseUrl.replace(/\/+$/, '');
    const API_ROOT = /\/api$/.test(HOST) ? HOST : `${HOST}/api`;
    
    // Validate final API root
    new URL(API_ROOT); // This will throw if URL is invalid
    
    return API_ROOT;
  } catch (error) {
    console.error('Failed to build API root URL:', error.message);
    // Fallback to known good URL
    return 'https://colorwheelapp-production.up.railway.app/api';
  }
};

const API_ROOT = buildApiRoot();

// Safe API service class
class SafeApiService {
  constructor() {
    this.authToken = null;
    this.isReady = false;
    this.readyPromise = this.initialize();
  }

  // Expose ready promise for app bootstrap
  get ready() {
    return this.readyPromise;
  }

  // ✅ SAFER: Comprehensive response validation
  validateAndProcessResponse(response, endpoint) {
    try {
      // Validate response object structure
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response: response is not an object');
      }

      // Validate status code
      if (typeof response.status !== 'number') {
        throw new Error('Invalid response: missing or invalid status code');
      }

      // Check for successful status codes (2xx range)
      if (response.status < 200 || response.status >= 300) {
        // Handle specific error status codes
        const errorMessage = this.getErrorMessageFromResponse(response);
        
        if (response.status === 401) {
          throw new Error(`Authentication failed: ${errorMessage}`);
        } else if (response.status === 403) {
          throw new Error(`Access forbidden: ${errorMessage}`);
        } else if (response.status === 404) {
          throw new Error(`Resource not found: ${errorMessage}`);
        } else if (response.status === 429) {
          throw new Error(`Rate limit exceeded: ${errorMessage}`);
        } else if (response.status >= 500) {
          throw new Error(`Server error (${response.status}): ${errorMessage}`);
        } else {
          throw new Error(`Request failed (${response.status}): ${errorMessage}`);
        }
      }

      // Validate headers
      if (!response.headers || typeof response.headers !== 'object') {
        console.warn(`⚠️ Response missing headers for ${endpoint}`);
      }

      // Validate content type for JSON endpoints
      const contentType = response.headers?.['content-type'] || response.headers?.['Content-Type'];
      if (contentType && !contentType.includes('application/json') && !contentType.includes('text/')) {
        console.warn(`⚠️ Unexpected content type for ${endpoint}: ${contentType}`);
      }

      // Validate response data
      if (response.data === undefined) {
        throw new Error('Invalid response: missing data property');
      }

      // For JSON responses, ensure data is properly parsed
      if (typeof response.data === 'string' && contentType?.includes('application/json')) {
        try {
          response.data = JSON.parse(response.data);
        } catch (parseError) {
          throw new Error(`Invalid JSON response: ${parseError.message}`);
        }
      }

      // Validate response data structure for API responses
      if (response.data && typeof response.data === 'object') {
        // Check for common API error patterns
        if (response.data.error && typeof response.data.error === 'string') {
          throw new Error(`API error: ${response.data.error}`);
        }
        
        if (response.data.message && response.data.success === false) {
          throw new Error(`API error: ${response.data.message}`);
        }
      }

      // Log successful response for debugging (in development)
      if (__DEV__) {
        console.log(`✅ Response validated for ${endpoint}:`, {
          status: response.status,
          contentType,
          dataType: typeof response.data,
          hasData: response.data !== null && response.data !== undefined
        });
      }

      return response.data;
    } catch (validationError) {
      console.error(`❌ Response validation failed for ${endpoint}:`, validationError.message);
      throw validationError;
    }
  }

  // Helper method to extract error messages from response
  getErrorMessageFromResponse(response) {
    try {
      // Try to extract error message from response data
      if (response.data) {
        if (typeof response.data === 'string') {
          return response.data;
        }
        
        if (typeof response.data === 'object') {
          // Common error message patterns
          if (response.data.error) {
            return typeof response.data.error === 'string' 
              ? response.data.error 
              : JSON.stringify(response.data.error);
          }
          
          if (response.data.message) {
            return response.data.message;
          }
          
          if (response.data.detail) {
            return response.data.detail;
          }
          
          // If it's an object but no standard error fields, stringify it
          return JSON.stringify(response.data);
        }
      }
      
      // Fallback to status text
      return response.statusText || `HTTP ${response.status}`;
    } catch (error) {
      return `Unknown error (status: ${response.status})`;
    }
  }

  async initialize() {
    try {
      // ✅ SAFER: Skip fake axios validation - just log API configuration
      console.log('🔄 Initializing SafeApiService...');
      console.log('📡 API Root URL:', API_ROOT);

      // Try to load stored token (depends on safeStorage being initialized)
      let token = null;
      try {
        token = await safeStorage.getItem('fashion_color_wheel_auth_token');
        if (token && typeof token === 'string' && token.trim().length > 0) {
          this.authToken = token;
          // Always log token loading status in production
          console.log('✅ Auth token loaded from storage');
        }
      } catch (storageError) {
        console.warn('Failed to load auth token from storage:', storageError.message);
        // Continue without token - not critical for initialization
      }

      this.isReady = true;
      
      // Always log service initialization in production
      console.log('✅ SafeApiService initialized successfully');
      
      return true;
    } catch (error) {
      console.error('API service initialization failed:', error.message);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Still mark as ready to prevent hanging, but log the failure
      this.isReady = true;
      return false;
    }
  }

  getToken() {
    return this.authToken;
  }

  async setToken(token) {
    try {
      this.authToken = token;
      if (token) {
        await safeStorage.setItem('fashion_color_wheel_auth_token', token);
      } else {
        await safeStorage.removeItem('fashion_color_wheel_auth_token');
      }
      return true;
    } catch (error) {
      console.warn('Failed to set token:', error.message);
      return false;
    }
  }

  // Safe request method with error handling and cancellation support
  async request(endpoint, options = {}) {
    try {
      await this.ready;

      // Support both AbortSignal and axios CancelToken with safe creation
      let cancelToken = options.cancelToken;
      
      // If AbortSignal is provided, convert to axios CancelToken
      if (options.signal && !cancelToken) {
        try {
          const source = CancelToken.source();
          cancelToken = source.token;
          
          // Listen for abort signal
          if (options.signal.aborted) {
            source.cancel('Request aborted');
          } else {
            options.signal.addEventListener('abort', () => {
              source.cancel('Request aborted');
            });
          }
        } catch (cancelError) {
          console.warn('Failed to create cancel token from AbortSignal:', cancelError.message);
          // Continue without cancellation - not critical
        }
      }
      
      // Create default cancel token if none provided
      if (!cancelToken) {
        try {
          const source = CancelToken.source();
          cancelToken = source.token;
        } catch (cancelError) {
          console.warn('Failed to create default cancel token:', cancelError.message);
          // Continue without cancellation - not critical for basic requests
        }
      }

      // ✅ SAFER: Create axios config with comprehensive validation
      const { method = 'GET', data, headers = {}, timeout = 30000, ...restOptions } = options;
      
      // Validate request data if present
      if (data !== undefined) {
        this.validateRequestData(data, method);
      }

      const config = {
        method: method.toUpperCase(),
        url: `${API_ROOT}${endpoint}`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {}),
          ...headers,
        },
        timeout,
        cancelToken,
        ...(data ? { data } : {}),
        ...restOptions,
      };

      // Validate final configuration
      this.validateRequestConfig(config, endpoint);

      // Safe axios request execution with comprehensive response validation
      let response;
      try {
        response = await axios(config);
      } catch (axiosError) {
        // Re-throw with context about the axios failure
        if (axiosError.message?.includes('Network Error') || 
            axiosError.code === 'ECONNREFUSED' ||
            axiosError.code === 'NETWORK_ERROR') {
          throw axiosError; // Let the existing error handling below deal with it
        }
        
        // For other axios errors, add context
        console.error('Axios request execution failed:', axiosError.message);
        throw new Error(`Request execution failed: ${axiosError.message}`);
      }
      
      // ✅ SAFER: Comprehensive response validation
      return this.validateAndProcessResponse(response, endpoint);
    } catch (error) {
      console.warn(`API request failed for ${endpoint}:`, error.message);
      
      // Handle different types of errors
      if (error.response?.status === 401) {
        // Only clear token if this isn't a refresh endpoint to avoid clearing during token rotation
        if (!endpoint.includes('/auth/refresh')) {
          await this.setToken(null);
        }
        throw new Error('Authentication required');
      }
      
      // Handle network errors
      if (error.code === 'ECONNREFUSED' || 
          error.code === 'NETWORK_ERROR' ||
          error.message?.includes('Network Error') ||
          error.message?.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      }
      
      // Handle timeout errors
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('Request timed out. Please try again.');
      }
      
      throw error;
    }
  }

  // Authentication methods
  async login(email, password, options = {}) {
    return this.request('/auth/login', {
      method: 'POST',
      data: { email, password },
      ...options, // Pass through signal and other options
    });
  }

  async demoLogin(options = {}) {
    return this.request('/auth/demo-login', {
      method: 'POST',
      ...options, // Pass through signal and other options
    });
  }

  async getUserProfile(options = {}) {
    return this.request('/auth/profile', options);
  }

  async getUserColorMatches() {
    return this.request('/colors/user-matches');
  }

  // Safe logout
  async logout() {
    try {
      await this.setToken(null);
      await safeStorage.clearAuth();
      return true;
    } catch (error) {
      console.warn('Logout error:', error.message);
      return false;
    }
  }

  // Settings methods
  async updateSettings(settings) {
    return this.request('/users/preferences', {
      method: 'PUT',
      data: settings,
    });
  }

  async deleteAccount() {
    return this.request('/users/account', {
      method: 'DELETE',
    });
  }

  async requestDataExport() {
    return this.request('/users/export', {
      method: 'POST',
    });
  }

  // Color match methods
  async createColorMatch(colorMatchData) {
    return this.request('/colors/matches', {
      method: 'POST',
      data: colorMatchData,
    });
  }

  async getColorMatches(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    if (options.scheme) params.append('scheme', options.scheme);
    if (options.privacy) params.append('privacy', options.privacy);
    if (options.public) params.append('public', options.public);

    const queryString = params.toString();
    return this.request(`/colors/matches${queryString ? '?' + queryString : ''}`);
  }

  async getColorMatch(matchId) {
    return this.request(`/colors/matches/${matchId}`);
  }

  async updateColorMatch(matchId, updateData) {
    return this.request(`/colors/matches/${matchId}`, {
      method: 'PUT',
      data: updateData,
    });
  }

  async deleteColorMatch(matchId) {
    return this.request(`/colors/matches/${matchId}`, {
      method: 'DELETE',
    });
  }

  async validateHex(hexColor) {
    return this.request('/colors/validate', {
      method: 'POST',
      data: { hex: hexColor },
    });
  }

  // Community/likes methods
  async likeColorMatch(matchId) {
    return this.request(`/likes/color-matches/${matchId}`, {
      method: 'POST',
    });
  }

  async unlikeColorMatch(matchId) {
    return this.request(`/likes/color-matches/${matchId}`, {
      method: 'DELETE',
    });
  }

  async getColorMatchLikes(matchId) {
    return this.request(`/likes/color-matches/${matchId}`);
  }

  // ✅ NEW: Batch API for getting multiple color match likes at once
  async getBatchColorMatchLikes(matchIds, options = {}) {
    return this.request('/likes/color-matches/batch', {
      method: 'POST',
      data: { matchIds },
      ...options
    });
  }

  // Generic HTTP methods for apiHelpers compatibility
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, data = {}, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', data });
  }

  async put(endpoint, data = {}, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', data });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // Registration and username methods for SignUpScreen
  async register(registrationData, options = {}) {
    return this.request('/auth/register', {
      method: 'POST',
      data: registrationData,
      ...options, // Pass through signal and other options
    });
  }

  async checkUsername(username, options = {}) {
    return this.request('/auth/check-username', {
      method: 'POST',
      data: { username },
      ...options, // Pass through signal and other options
    });
  }

  // Health check method to test API connectivity
  async healthCheck() {
    try {
      const response = await this.request('/health', {
        method: 'GET',
        timeout: 5000, // Short timeout for health check
      });
      return { available: true, response };
    } catch (error) {
      console.warn('API health check failed:', error.message);
      return { 
        available: false, 
        error: error.message,
        isNetworkError: error.message?.includes('Unable to connect to server') || 
                       error.message?.includes('Network Error') ||
                       error.message?.includes('fetch') ||
                       error.code === 'ECONNREFUSED'
      };
    }
  }

  // ✅ SAFER: Validate request data before sending
  validateRequestData(data, method) {
    try {
      // Check for null or undefined (which are valid for some requests)
      if (data === null || data === undefined) {
        return; // Valid for GET, DELETE, etc.
      }

      // Validate data type
      if (typeof data !== 'object' && typeof data !== 'string') {
        throw new Error(`Invalid request data type: ${typeof data}. Expected object or string.`);
      }

      // For objects, check for circular references and validate structure
      if (typeof data === 'object') {
        try {
          JSON.stringify(data); // This will throw if there are circular references
        } catch (stringifyError) {
          throw new Error(`Invalid request data: ${stringifyError.message}`);
        }

        // Check for potentially dangerous properties
        if (data.constructor && data.constructor !== Object && data.constructor !== Array) {
          console.warn('⚠️ Request data contains non-plain object with constructor:', data.constructor.name);
        }
      }

      // Validate data size (prevent extremely large payloads)
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      // ✅ SAFER: React Native compatible size calculation (Blob API doesn't exist in RN)
      let dataSizeBytes;
      try {
        // Try TextEncoder first (modern environments)
        dataSizeBytes = new TextEncoder().encode(dataString).length;
      } catch (encoderError) {
        // Fallback to string length approximation (older RN versions)
        dataSizeBytes = dataString.length * 2; // Rough UTF-16 estimate
      }
      const dataSizeKB = dataSizeBytes / 1024;
      
      if (dataSizeKB > 10240) { // 10MB limit
        throw new Error(`Request data too large: ${dataSizeKB.toFixed(2)}KB. Maximum allowed: 10MB`);
      }

      // Log large payloads for monitoring
      if (dataSizeKB > 100) { // 100KB
        console.warn(`⚠️ Large request payload: ${dataSizeKB.toFixed(2)}KB for ${method} request`);
      }

    } catch (validationError) {
      throw new Error(`Request data validation failed: ${validationError.message}`);
    }
  }

  // ✅ SAFER: Validate request configuration
  validateRequestConfig(config, endpoint) {
    try {
      // Validate required properties
      if (!config || typeof config !== 'object') {
        throw new Error('Config must be an object');
      }

      if (!config.method || typeof config.method !== 'string') {
        throw new Error('Config must have a valid method');
      }

      if (!config.url || typeof config.url !== 'string') {
        throw new Error('Config must have a valid URL');
      }

      // Validate URL format
      try {
        new URL(config.url);
      } catch (urlError) {
        throw new Error(`Invalid URL format: ${config.url}`);
      }

      // Validate method
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      if (!validMethods.includes(config.method.toUpperCase())) {
        throw new Error(`Invalid HTTP method: ${config.method}`);
      }

      // Validate headers
      if (config.headers && typeof config.headers !== 'object') {
        throw new Error('Headers must be an object');
      }

      // Validate timeout
      if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
        throw new Error('Timeout must be a positive number');
      }

      // Validate data for methods that shouldn't have body
      if (['GET', 'HEAD', 'DELETE'].includes(config.method.toUpperCase()) && config.data) {
        console.warn(`⚠️ ${config.method} request with body data for ${endpoint}`);
      }

      // Validate auth token format if present
      if (config.headers?.Authorization) {
        const authHeader = config.headers.Authorization;
        if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
          throw new Error('Invalid Authorization header format');
        }
        
        const token = authHeader.substring(7); // Remove "Bearer "
        if (token.length < 10) {
          throw new Error('Authorization token appears to be too short');
        }
      }

    } catch (validationError) {
      throw new Error(`Request config validation failed: ${validationError.message}`);
    }
  }
}

// Create singleton instance
const safeApiService = new SafeApiService();

export default safeApiService;
