// utils/expoConfigHelper.js - Shared Expo config access utility
import Constants from 'expo-constants';

/**
 * Safely access Expo config extra values
 * Prevents crashes when expoConfig is missing or malformed
 * @returns {Object} The extra config object or empty object
 */
export const getSafeExpoExtra = () => {
  try {
    const expoConfig = Constants?.expoConfig;
    if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
      return expoConfig.extra;
    }
    // ✅ CRASH FIX: Use typeof check to prevent ReferenceError in production
    // Only warn in development to avoid console noise in production
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('getSafeExpoExtra: expoConfig missing or malformed, using defaults');
    }
  } catch (error) {
    // ✅ CRASH FIX: Use typeof check to prevent ReferenceError in production
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
