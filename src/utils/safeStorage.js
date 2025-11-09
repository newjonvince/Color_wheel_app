// utils/safeStorage.js - Safe storage wrapper with fallbacks
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safe SecureStore wrapper
let SecureStore = null;
try {
  SecureStore = require('expo-secure-store');
} catch (error) {
  console.warn('SecureStore not available, using AsyncStorage fallback:', error.message);
}

// Safe storage operations with fallbacks
export const safeStorage = {
  // Get item with fallbacks
  async getItem(key) {
    try {
      // Try SecureStore first
      if (SecureStore) {
        const value = await SecureStore.getItemAsync(key);
        if (value !== null) return value;
      }
      
      // Fallback to AsyncStorage
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to get item ${key}:`, error.message);
      return null;
    }
  },

  // Set item with fallbacks
  async setItem(key, value) {
    try {
      // Try SecureStore first for sensitive data
      if (SecureStore && (key.includes('token') || key.includes('auth'))) {
        await SecureStore.setItemAsync(key, value);
        return true;
      }
      
      // Use AsyncStorage for other data
      await AsyncStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`Failed to set item ${key}:`, error.message);
      return false;
    }
  },

  // Remove item with fallbacks
  async removeItem(key) {
    try {
      // Try both storage methods
      if (SecureStore) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (e) {
          // SecureStore might throw if key doesn't exist
        }
      }
      
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove item ${key}:`, error.message);
      return false;
    }
  },

  // Clear all auth-related items
  async clearAuth() {
    const authKeys = [
      'fashion_color_wheel_auth_token',
      'authToken',
      'user',
      'userProfile'
    ];

    for (const key of authKeys) {
      await this.removeItem(key);
    }
  }
};

// Export individual functions for backward compatibility
export const getItem = safeStorage.getItem.bind(safeStorage);
export const setItem = safeStorage.setItem.bind(safeStorage);
export const removeItem = safeStorage.removeItem.bind(safeStorage);
export const clearAuth = safeStorage.clearAuth.bind(safeStorage);
