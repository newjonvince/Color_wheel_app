// services/safeApiService.js - API service with safe dependency handling
import axios from 'axios';
import { safeStorage } from '../utils/safeStorage';

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

  get ready() {
    return this.readyPromise;
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

  // Safe request method with error handling
  async request(endpoint, options = {}) {
    try {
      await this.ready;

      const config = {
        method: 'GET',
        ...options,
        url: `${API_ROOT}${endpoint}`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers,
        },
        timeout: 10000,
      };

      // Add auth header if token exists
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.warn(`API request failed for ${endpoint}:`, error.message);
      
      // Return safe fallback responses
      if (error.response?.status === 401) {
        // Clear invalid token
        await this.setToken(null);
        throw new Error('Authentication required');
      }
      
      throw error;
    }
  }

  // Authentication methods
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      data: { email, password },
    });
  }

  async demoLogin() {
    return this.request('/auth/demo-login', {
      method: 'POST',
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
}

// Create singleton instance
const safeApiService = new SafeApiService();

export default safeApiService;
