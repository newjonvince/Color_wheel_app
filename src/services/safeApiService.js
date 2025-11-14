// services/safeApiService.js - API service with safe dependency handling
import axios from 'axios';
import { safeStorage } from '../utils/safeStorage';

// Request cancellation support
const CancelToken = axios.CancelToken;

// Safe API configuration with URL validation
const getApiBaseUrl = () => {
  try {
    const Constants = require('expo-constants').default;
    if (Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL) {
      return Constants.expoConfig.extra.EXPO_PUBLIC_API_BASE_URL;
    }
  } catch (error) {
    console.warn('Failed to load Expo Constants:', error.message);
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

  async initialize() {
    try {
      // Test axios configuration safety first
      try {
        // Test basic axios config creation without making a request
        const testConfig = {
          method: 'GET',
          url: `${API_ROOT}/health`,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 1000, // Very short timeout for config test
          validateStatus: () => true, // Accept any status for config test
        };
        
        // This will validate the config without making a request
        const axiosInstance = axios.create(testConfig);
        if (!axiosInstance) {
          throw new Error('Failed to create axios instance');
        }
        
        if (__DEV__) {
          console.log('✅ Axios configuration validated successfully');
          console.log('📡 API Root URL:', API_ROOT);
        }
      } catch (axiosError) {
        console.error('❌ Axios configuration failed:', axiosError.message);
        throw new Error(`Axios setup failed: ${axiosError.message}`);
      }

      // Try to load stored token (depends on safeStorage being initialized)
      let token = null;
      try {
        token = await safeStorage.getItem('fashion_color_wheel_auth_token');
        if (token && typeof token === 'string' && token.trim().length > 0) {
          this.authToken = token;
          if (__DEV__) {
            console.log('✅ Auth token loaded from storage');
          }
        }
      } catch (storageError) {
        console.warn('Failed to load auth token from storage:', storageError.message);
        // Continue without token - not critical for initialization
      }

      this.isReady = true;
      
      if (__DEV__) {
        console.log('✅ SafeApiService initialized successfully');
      }
      
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
      
      // Extract timeout to enforce cap, allow other options to override
      const { timeout: requestedTimeout, ...restOptions } = options;

      // Safe config construction with validation
      let config;
      try {
        config = {
          method: 'GET',
          url: `${API_ROOT}${endpoint}`,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers,
          },
          cancelToken,
          ...restOptions, // Allow other options to override
          timeout: Math.min(10000, requestedTimeout ?? 10000), // Real cap - applied after options
        };

        // Add auth header if token exists
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }

        // Validate final URL
        new URL(config.url); // This will throw if URL is malformed
        
      } catch (configError) {
        console.error('Failed to create request config:', configError.message);
        throw new Error(`Invalid request configuration: ${configError.message}`);
      }

      // Safe axios request execution
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
      
      return response.data;
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

  async getUserProfile() {
    return this.request('/auth/profile');
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
  async register(registrationData) {
    return this.request('/auth/register', {
      method: 'POST',
      data: registrationData,
    });
  }

  async checkUsername(username) {
    return this.request('/auth/check-username', {
      method: 'POST',
      data: { username },
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
}

// Create singleton instance
const safeApiService = new SafeApiService();

export default safeApiService;
