// config/env.js - Environment variables validation and management
import Constants from 'expo-constants';
import { logger } from '../utils/AppLogger';

const ENV_VARS = {
  API_BASE_URL: Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL,
  API_STAGING_URL: Constants.expoConfig?.extra?.EXPO_PUBLIC_API_STAGING_URL,
  ENVIRONMENT: Constants.expoConfig?.extra?.EXPO_PUBLIC_ENVIRONMENT || 'production',
  ENABLE_ANALYTICS: Constants.expoConfig?.extra?.EXPO_PUBLIC_ENABLE_ANALYTICS === true,
  ENABLE_CRASH_REPORTING: Constants.expoConfig?.extra?.EXPO_PUBLIC_ENABLE_CRASH_REPORTING !== false,
  DEBUG_MODE: Constants.expoConfig?.extra?.EXPO_PUBLIC_DEBUG_MODE === true,
  LOG_LEVEL: Constants.expoConfig?.extra?.EXPO_PUBLIC_LOG_LEVEL || 'warn',
};

// ✅ Get current API URL based on environment
export function getApiUrl() {
  if (ENV_VARS.ENVIRONMENT === 'staging' && ENV_VARS.API_STAGING_URL) {
    return ENV_VARS.API_STAGING_URL;
  }
  return ENV_VARS.API_BASE_URL;
}

// ✅ Validate on startup
export function validateEnv() {
  const missing = [];
  const warnings = [];
  
  if (!ENV_VARS.API_BASE_URL) {
    missing.push('EXPO_PUBLIC_API_BASE_URL');
  }
  
  if (ENV_VARS.ENVIRONMENT === 'staging' && !ENV_VARS.API_STAGING_URL) {
    warnings.push('EXPO_PUBLIC_API_STAGING_URL not set - falling back to production URL');
  }
  
  if (missing.length > 0) {
    throw new Error(
      `🚨 Missing required environment variables: ${missing.join(', ')}\n` +
      `Check your app.config.js "extra" configuration.` 
    );
  }
  
  if (warnings.length > 0) {
    warnings.forEach(warning => console.warn(`⚠️ ${warning}`));
  }
  
  logger.info(`✅ Environment variables validated for ${ENV_VARS.ENVIRONMENT} environment`);
  logger.info(`📡 API URL: ${getApiUrl()}`);
}

export default ENV_VARS;
