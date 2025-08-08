import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Get API URL from environment or fallback to localhost
const getApiUrl = () => {
  // Try EAS build environment first, then expo config, then fallback
  const easEnv = Constants.expoConfig?.env || Constants.manifest?.env;
  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra;
  
  return easEnv?.API_URL || extra?.API_URL || 'http://localhost:3000';
};

const API_BASE_URL = `${getApiUrl()}/api`;
const HEALTH_CHECK_URL = `${getApiUrl()}/health`;
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
    this.refreshToken = null;
    this.isOnline = true;
    this.isRefreshing = false;
    this.failedQueue = [];
    
    // Load token from secure storage on initialization
    this.loadTokenFromStorage();
  }

  async setToken(token, refreshToken = null) {
    this.token = token;
    this.refreshToken = refreshToken;
    
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      if (refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      }
    } else {
      await this.clearToken();
    }
  }

  async clearToken() {
    this.token = null;
    this.refreshToken = null;
    
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.warn('Error clearing tokens from secure storage:', error);
    }
  }

  // Load token from secure storage
  async loadTokenFromStorage() {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      
      if (token) {
        this.token = token;
        this.refreshToken = refreshToken;
      }
    } catch (error) {
      console.warn('Error loading tokens from secure storage:', error);
    }
  }

  // Process failed queue after token refresh
  processFailedQueue(error, token = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });
    
    this.failedQueue = [];
  }

  // Refresh token flow
  async refreshAuthToken() {
    if (this.isRefreshing) {
      // If already refreshing, queue this request
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject });
      });
    }

    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    this.isRefreshing = true;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.refreshToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const { token, refreshToken } = data;

      await this.setToken(token, refreshToken);
      this.processFailedQueue(null, token);
      
      return token;
    } catch (error) {
      this.processFailedQueue(error, null);
      await this.clearToken();
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  // Enhanced request method with 401 handling and token refresh
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    // Handle request body
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), config.timeout);
      });

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(url, config),
        timeoutPromise
      ]);

      // Handle different response types
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      // Handle HTTP errors with 401 token refresh
      if (!response.ok) {
        if (response.status === 401 && this.refreshToken && !endpoint.includes('/auth/')) {
          try {
            // Attempt to refresh token and retry request
            await this.refreshAuthToken();
            
            // Retry original request with new token
            const retryConfig = {
              ...config,
              headers: {
                ...config.headers,
                Authorization: `Bearer ${this.token}`,
              },
            };
            
            const retryResponse = await fetch(url, retryConfig);
            const retryData = await retryResponse.json();
            
            if (!retryResponse.ok) {
              const errorMessage = retryData.message || retryData.error || `HTTP ${retryResponse.status}: ${retryResponse.statusText}`;
              const error = new Error(errorMessage);
              error.status = retryResponse.status;
              error.response = retryData;
              throw error;
            }
            
            return retryData;
          } catch (refreshError) {
            // If refresh fails, clear tokens and throw original error
            await this.clearToken();
            const errorMessage = data.message || data.error || 'Authentication failed';
            const error = new Error(errorMessage);
            error.status = response.status;
            error.response = data;
            throw error;
          }
        }
        
        const errorMessage = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.response = data;
        throw error;
      }

      this.isOnline = true;
      return data;

    } catch (error) {
      // Enhanced error handling
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        this.isOnline = false;
        error.message = 'Network connection failed. Please check your internet connection.';
      } else if (error.message === 'Request timeout') {
        error.message = 'Request timed out. Please try again.';
      }

      console.error(`API Request Error [${endpoint}]:`, {
        message: error.message,
        status: error.status,
        url,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  // Authentication Methods
  async register(userData) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: userData,
    });
    
    if (response.token) {
      await this.setToken(response.token, response.refreshToken);
    }
    
    return response;
  }

  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    
    if (response.token) {
      await this.setToken(response.token, response.refreshToken);
    }
    
    return response;
  }

  async checkUsername(username) {
    return this.request(`/auth/check-username/${username}`);
  }

  async logout() {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });
    
    await this.clearToken();
    return response;
  }

  // Color Match Methods
  async getColorMatches(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/colors?${queryString}`);
  }

  async createColorMatch(colorMatch) {
    return this.request('/colors', {
      method: 'POST',
      body: colorMatch,
    });
  }

  async updateColorMatch(id, updates) {
    return this.request(`/colors/${id}`, {
      method: 'PUT',
      body: updates,
    });
  }

  async deleteColorMatch(id) {
    return this.request(`/colors/${id}`, {
      method: 'DELETE',
    });
  }

  async getPublicColorMatches(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/colors/public?${queryString}`);
  }

  async likeColorMatch(id) {
    return this.request(`/colors/${id}/like`, {
      method: 'POST',
    });
  }

  // Board Methods
  async getBoards(type = null) {
    const queryString = type ? `?type=${type}` : '';
    return this.request(`/boards${queryString}`);
  }

  async getBoardItems(boardId) {
    return this.request(`/boards/${boardId}/items`);
  }

  async addToBoard(boardId, colorMatchId) {
    return this.request(`/boards/${boardId}/items`, {
      method: 'POST',
      body: { colorMatchId },
    });
  }

  async removeFromBoard(boardId, itemId) {
    return this.request(`/boards/${boardId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // User Methods
  async getUserProfile() {
    return this.request('/users/profile');
  }

  async updateUserProfile(updates) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: updates,
    });
  }

  async getUserPreferences() {
    return this.request('/users/preferences');
  }

  async updateUserPreferences(preferences) {
    return this.request('/users/preferences', {
      method: 'PUT',
      body: preferences,
    });
  }

  async deleteAccount() {
    const response = await this.request('/users/account', {
      method: 'DELETE',
    });
    
    // Clear all local data after successful account deletion
    await this.clearToken();
    
    return response;
  }

  async requestDataExport() {
    return this.request('/users/export-data', {
      method: 'POST',
    });
  }

  // Enhanced Health Check
  async healthCheck() {
    try {
      const response = await fetch(HEALTH_CHECK_URL, {
        method: 'GET',
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      const data = await response.json();
      this.isOnline = true;
      return data;
    } catch (error) {
      this.isOnline = false;
      console.error('Health check failed:', error);
      throw error;
    }
  }

  // Connection status
  getConnectionStatus() {
    return {
      isOnline: this.isOnline,
      hasToken: !!this.token,
      baseURL: this.baseURL
    };
  }

  // Retry mechanism for failed requests
  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;
        
        // Don't retry on authentication errors or client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`Retrying request to ${endpoint} (attempt ${attempt + 1}/${maxRetries})`);
        }
      }
    }
    
    throw lastError;
  }
}

export default new ApiService();
