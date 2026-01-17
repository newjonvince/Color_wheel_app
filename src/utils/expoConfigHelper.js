// utils/expoConfigHelper.js - Shared Expo config access utility
// CRASH FIX: Lazy-load expo-constants to prevent native bridge access at module load time
// This prevents crashes when the module is imported before React Native bridge is ready (~300ms after launch)

let _expoConstants = undefined;

/**
 * Lazily load expo-constants to avoid module-load-time native bridge access
 * @returns {Object|null} The Constants object or null if unavailable
 */
const getExpoConstants = () => {
  if (_expoConstants !== undefined) return _expoConstants;
  try {
    _expoConstants = require('expo-constants')?.default ?? null;
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('expoConfigHelper: expo-constants load failed', error?.message);
    }
    _expoConstants = null;
  }
  return _expoConstants;
};

/**
 * Safely access Expo config extra values
 * Prevents crashes when expoConfig is missing or malformed
 * @returns {Object} The extra config object or empty object
 */
export const getSafeExpoExtra = () => {
  try {
    const Constants = getExpoConstants();
    const expoConfig = Constants?.expoConfig;
    if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
      return expoConfig.extra;
    }
    // CRASH FIX: Use typeof check to prevent ReferenceError in production
    // Only warn in development to avoid console noise in production
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('getSafeExpoExtra: expoConfig missing or malformed, using defaults');
    }
  } catch (error) {
    // CRASH FIX: Use typeof check to prevent ReferenceError in production
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('getSafeExpoExtra: unable to read expoConfig safely', error);
    }
  }
  return {};
};

/**
 * Check if debug mode is enabled via Expo config
 * @returns {boolean} True if debug mode is enabled
 */
export const isDebugMode = () => {
  const extra = getSafeExpoExtra();
  return !!extra.EXPO_PUBLIC_DEBUG_MODE;
};

/**
 * Check if production environment
 * @returns {boolean} True if production
 */
export const isProduction = () => {
  const extra = getSafeExpoExtra();
  return extra.EXPO_PUBLIC_NODE_ENV === 'production';
};

export default {
  getSafeExpoExtra,
  isDebugMode,
  isProduction,
};
