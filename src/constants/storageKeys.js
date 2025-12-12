// constants/storageKeys.js - Centralized storage key definitions

/**
 * Storage keys for secure and async storage
 * Using constants prevents typos and makes refactoring easier
 */
export const STORAGE_KEYS = {
  // Authentication
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  USER_ID: 'user_id',
  
  // User preferences
  PREFERENCES: 'user_preferences',
  THEME: 'theme_preference',
  NOTIFICATIONS: 'notification_settings',
  
  // App state
  ONBOARDING_COMPLETE: 'onboarding_complete',
  LAST_SYNC: 'last_sync_timestamp',
  APP_VERSION: 'app_version',
  
  // Cache
  CACHE: 'app_cache',
  COLOR_CACHE: 'color_cache',
  SCHEME_CACHE: 'scheme_cache',
  
  // Boards and palettes
  SAVED_PALETTES: 'saved_palettes',
  RECENT_COLORS: 'recent_colors',
  FAVORITE_COLORS: 'favorite_colors',
  
  // Session
  SESSION_ID: 'session_id',
  LAST_ACTIVITY: 'last_activity',
};

/**
 * Get all storage keys as an array
 * @returns {string[]}
 */
export const getAllStorageKeys = () => Object.values(STORAGE_KEYS);

/**
 * Check if a key is a valid storage key
 * @param {string} key - The key to check
 * @returns {boolean}
 */
export const isValidStorageKey = (key) => Object.values(STORAGE_KEYS).includes(key);

export default STORAGE_KEYS;
