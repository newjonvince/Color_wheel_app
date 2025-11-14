// services/safeApiService.js - API service with safe dependency handling
import axios from 'axios';
import { safeStorage } from '../utils/safeStorage';

// Request cancellation support
const CancelToken = axios.CancelToken;

// Safe API configuration
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

const HOST = getApiBaseUrl().replace(/\/+$/, '');
const API_ROOT = /\/api$/.test(HOST) ? HOST : `${HOST}/api`;

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
      // Try to load stored token
      const token = await safeStorage.getItem('fashion_color_wheel_auth_token');
      if (token) {
        this.authToken = token;
      }
      this.isReady = true;
      return true;
    } catch (error) {
      console.warn('API service initialization failed:', error.message);
      this.isReady = true; // Still mark as ready to prevent hanging
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

      // Support both AbortSignal and axios CancelToken
      let cancelToken = options.cancelToken;
      
      // If AbortSignal is provided, convert to axios CancelToken
      if (options.signal && !cancelToken) {
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
      }
      
      // Create default cancel token if none provided
      if (!cancelToken) {
        const source = CancelToken.source();
        cancelToken = source.token;
      }
      
      // Extract timeout to enforce cap, allow other options to override
      const { timeout: requestedTimeout, ...restOptions } = options;

      const config = {
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

      const response = await axios(config);
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
