// constants/storageKeys.js - Centralized storage key constants
// Prevents typos and makes key management easier

export const STORAGE_KEYS = {
  // Authentication
  AUTH_TOKEN: 'fashion_color_wheel_auth_token',
  USER_DATA: 'userData',
  IS_LOGGED_IN: 'isLoggedIn',
  
  // Profile caching
  CACHED_PROFILE: 'cachedProfile',
  PROFILE_CACHE_TIMESTAMP: 'profileCacheTimestamp',
  
  // App settings
  APP_SETTINGS: 'appSettings',
  THEME_PREFERENCE: 'themePreference',
  
  // Color wheel data
  SAVED_PALETTES: 'savedPalettes',
  RECENT_COLORS: 'recentColors',
  
  // Cache management
  CACHE_VERSION: 'cacheVersion',
  LAST_CLEANUP: 'lastCleanup',
};

// Sensitive keys that should use SecureStore
export const SENSITIVE_KEYS = new Set([
  STORAGE_KEYS.AUTH_TOKEN,
  STORAGE_KEYS.USER_DATA,
]);

// Keys that can be cached longer
export const CACHEABLE_KEYS = new Set([
  STORAGE_KEYS.APP_SETTINGS,
  STORAGE_KEYS.THEME_PREFERENCE,
  STORAGE_KEYS.SAVED_PALETTES,
]);

export default STORAGE_KEYS;
