// config/env.js - Environment variables validation and management
import Constants from 'expo-constants';

// Lazy logger getter to avoid circular import crashes
let logger = null;
const getLogger = () => {
  if (logger) return logger;
  try {
    const mod = require('../utils/AppLogger');
    logger = mod?.logger || mod?.default || console;
  } catch (error) {
    console.warn('env: AppLogger load failed, using console', error?.message || error);
    logger = console;
  }
  return logger;
};

const getSafeExtra = () => {
  try {
    const expoConfig = Constants?.expoConfig;
    if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
      return expoConfig.extra;
    }
    if (getLogger()?.warn) {
      getLogger().warn('env: expoConfig missing or malformed, using defaults');
    } else {
      console.warn('env: expoConfig missing or malformed, using defaults');
    }
  } catch (error) {
    try {
      getLogger()?.warn?.('env: unable to read expoConfig safely, using defaults', error);
    } catch (_) {
      console.warn('env: unable to read expoConfig safely, using defaults', error);
    }
  }
  return {};
};

const asStringOrUndefined = (value) => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return undefined;
  try {
    return String(value);
  } catch (_) {
    return undefined;
  }
};

// Lazy getter to avoid freezing values before Constants is ready
export const getEnvVars = () => {
  const extra = getSafeExtra();
  return {
    API_BASE_URL: asStringOrUndefined(extra.EXPO_PUBLIC_API_BASE_URL),
    API_STAGING_URL: asStringOrUndefined(extra.EXPO_PUBLIC_API_STAGING_URL),
    ENVIRONMENT: asStringOrUndefined(extra.EXPO_PUBLIC_ENVIRONMENT) || 'production',
    ENABLE_ANALYTICS: extra.EXPO_PUBLIC_ENABLE_ANALYTICS === true,
    ENABLE_CRASH_REPORTING: extra.EXPO_PUBLIC_ENABLE_CRASH_REPORTING !== false,
    DEBUG_MODE: extra.EXPO_PUBLIC_DEBUG_MODE === true,
    LOG_LEVEL: extra.EXPO_PUBLIC_LOG_LEVEL || 'warn',
  };
};

// Get current API URL based on environment
export function getApiUrl() {
  const ENV_VARS = getEnvVars();
  if (ENV_VARS.ENVIRONMENT === 'staging' && ENV_VARS.API_STAGING_URL) {
    return ENV_VARS.API_STAGING_URL;
  }
  return ENV_VARS.API_BASE_URL;
}

// Validate on startup: always return shape { isValid, warnings, errors }
export function validateEnv() {
  try {
    const ENV_VARS = getEnvVars();
    const errors = [];
    const warnings = [];

    if (!ENV_VARS.API_BASE_URL) {
      errors.push('EXPO_PUBLIC_API_BASE_URL is required');
    }

    if (ENV_VARS.ENVIRONMENT === 'staging' && !ENV_VARS.API_STAGING_URL) {
      warnings.push('EXPO_PUBLIC_API_STAGING_URL not set - falling back to production URL');
    }

    if (warnings.length > 0) {
      warnings.forEach(warning => console.warn(`env warning: ${warning}`));
    }

    if (errors.length === 0 && getLogger()?.info) {
      try {
        getLogger().info(`Environment variables validated for ${ENV_VARS.ENVIRONMENT} environment`);
        getLogger().info(`API URL: ${getApiUrl()}`);
      } catch (_) {
        // If logger is unavailable, skip logging to avoid crash
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    };
  } catch (error) {
    try {
      getLogger()?.warn?.('env validation threw:', error);
    } catch (_) {
      console.warn('env validation threw:', error);
    }
    return {
      isValid: false,
      warnings: [],
      errors: [error?.message || 'Environment validation failed'],
    };
  }
}

// Default export for compatibility (snapshot at call time)
export default getEnvVars;
