// utils/crashReporting.js - Production crash reporting with Sentry integration
import Constants from 'expo-constants';

// Lazy logger proxy to avoid circular import crashes
let _loggerInstance = null;
const getLogger = () => {
  if (_loggerInstance) return _loggerInstance;
  try {
    const mod = require('./AppLogger');
    _loggerInstance = mod?.logger || mod?.default || console;
  } catch (error) {
    console.warn('crashReporting: AppLogger load failed, using console', error?.message || error);
    _loggerInstance = console;
  }
  return _loggerInstance;
};

const logger = {
  debug: (...args) => getLogger()?.debug?.(...args),
  info: (...args) => getLogger()?.info?.(...args),
  warn: (...args) => getLogger()?.warn?.(...args),
  error: (...args) => getLogger()?.error?.(...args),
};

// Production-ready environment configuration
const getSafeExpoExtra = () => {
  try {
    const expoConfig = Constants?.expoConfig;
    if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
      return expoConfig.extra;
    }
    console.warn('crashReporting: expoConfig missing or malformed, using defaults');
  } catch (error) {
    console.warn('crashReporting: unable to read expoConfig safely, using defaults', error);
  }
  return {};
};

const extra = getSafeExpoExtra();
const IS_PROD = extra.EXPO_PUBLIC_NODE_ENV === 'production';
const SENTRY_DSN = extra.EXPO_PUBLIC_SENTRY_DSN;

// Sentry instance (lazy loaded)
let Sentry = null;
let isInitialized = false;

/**
 * Initialize crash reporting
 * Should be called as early as possible in the app lifecycle
 */
export const initializeCrashReporting = async () => {
  try {
    // Only initialize in production or if explicitly enabled
    if (!IS_PROD && !extra.EXPO_PUBLIC_ENABLE_CRASH_REPORTING) {
      logger.debug('🔧 Crash reporting disabled (development mode)');
      return;
    }

    if (!SENTRY_DSN) {
      logger.warn('⚠️ SENTRY_DSN not configured - crash reporting disabled');
      return;
    }

    // Lazy load Sentry to avoid bundle size impact in development
    logger.debug('🔧 Initializing Sentry crash reporting...');
    
    // Try to import Sentry
    try {
      Sentry = require('@sentry/react-native').default;
    } catch (importError) {
      logger.warn('⚠️ Sentry not installed - install with: expo install @sentry/react-native');
      return;
    }

    // Initialize Sentry
    Sentry.init({
      dsn: SENTRY_DSN,
      debug: !IS_PROD, // Enable debug in development
      environment: IS_PROD ? 'production' : 'development',
      
      // Performance monitoring
      tracesSampleRate: IS_PROD ? 0.1 : 1.0, // 10% in prod, 100% in dev
      
      // Session tracking
      enableAutoSessionTracking: true,
      
      // Native crash handling
      enableNativeCrashHandling: true,
      
      // Additional configuration
      beforeSend(event, hint) {
        // Filter out development errors
        if (!IS_PROD) {
          logger.debug('🔧 Sentry event (dev):', event.exception?.values?.[0]?.value);
        }
        
        // Don't send certain errors in production
        if (IS_PROD) {
          const error = hint.originalException;
          
          // Skip network errors (too noisy)
          if (error?.message?.includes('Network request failed')) {
            return null;
          }
          
          // Skip cancelled requests
          if (error?.message?.includes('cancelled') || error?.message?.includes('aborted')) {
            return null;
          }
        }
        
        return event;
      },
      
      // Integrations
      integrations: [
        // Add React Navigation integration if available
        ...(global.__REACT_NAVIGATION__ ? [
          new Sentry.ReactNavigationInstrumentation()
        ] : []),
      ],
    });

    // Set user context
    Sentry.setContext('app', {
      version: Constants.expoConfig?.version || '1.0.0',
      buildNumber: Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || 'unknown',
      platform: Constants.platform?.ios ? 'ios' : Constants.platform?.android ? 'android' : 'web',
    });

    // Expose globally for modules that expect global.Sentry
    try {
      global.Sentry = Sentry;
    } catch (globalError) {
      logger.warn('crashReporting: unable to set global.Sentry:', globalError);
    }

    isInitialized = true;
    logger.info('✅ Crash reporting initialized');
    
  } catch (error) {
    logger.error('🚨 Failed to initialize crash reporting:', error);
    // Don't let crash reporting initialization crash the app
  }
};

/**
 * Report an error to crash reporting
 */
export const reportError = (error, context = {}) => {
  try {
    if (!isInitialized || !Sentry) {
      // Fallback to console logging
      logger.error('🚨 Error (no crash reporting):', error, context);
      return;
    }

    // Add context
    if (context && Object.keys(context).length > 0) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
    
    logger.debug('📊 Error reported to crash reporting');
    
  } catch (reportingError) {
    logger.error('🚨 Failed to report error:', reportingError);
    // Fallback to console
    logger.error('🚨 Original error:', error, context);
  }
};

/**
 * Report a message to crash reporting
 */
export const reportMessage = (message, level = 'info', context = {}) => {
  try {
    if (!isInitialized || !Sentry) {
      logger[level](`📊 Message (no crash reporting): ${message}`, context);
      return;
    }

    if (context && Object.keys(context).length > 0) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
        Sentry.captureMessage(message, level);
      });
    } else {
      Sentry.captureMessage(message, level);
    }
    
  } catch (reportingError) {
    logger.error('🚨 Failed to report message:', reportingError);
    logger[level](`📊 Original message: ${message}`, context);
  }
};

/**
 * Set user context for crash reporting
 */
export const setUserContext = (user) => {
  try {
    if (!isInitialized || !Sentry) {
      logger.debug('🔧 User context (no crash reporting):', user?.id);
      return;
    }

    Sentry.setUser({
      id: user?.id,
      email: user?.email,
      username: user?.username,
    });
    
    logger.debug('📊 User context updated');
    
  } catch (error) {
    logger.error('🚨 Failed to set user context:', error);
  }
};

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = (message, category = 'app', level = 'info', data = {}) => {
  try {
    if (!isInitialized || !Sentry) {
      logger.debug(`🍞 Breadcrumb (no crash reporting): [${category}] ${message}`, data);
      return;
    }

    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
    
  } catch (error) {
    logger.error('🚨 Failed to add breadcrumb:', error);
  }
};

/**
 * Performance monitoring
 */
export const startTransaction = (name, operation = 'navigation') => {
  try {
    if (!isInitialized || !Sentry) {
      const startTime = Date.now();
      return {
        finish: () => {
          const duration = Date.now() - startTime;
          logger.debug(`⏱️ Transaction (no crash reporting): ${name} took ${duration}ms`);
        }
      };
    }

    return Sentry.startTransaction({ name, op: operation });
    
  } catch (error) {
    logger.error('🚨 Failed to start transaction:', error);
    return { finish: () => {} }; // Noop fallback
  }
};

/**
 * Check if crash reporting is available
 */
export const isCrashReportingAvailable = () => {
  return isInitialized && Sentry !== null;
};

/**
 * Manually capture a crash for testing
 */
export const testCrashReporting = () => {
  if (!isInitialized || !Sentry) {
    logger.warn('⚠️ Crash reporting not available for testing');
    return;
  }
  
  logger.info('🧪 Testing crash reporting...');
  reportError(new Error('Test crash from crash reporting system'), {
    test: true,
    timestamp: new Date().toISOString(),
  });
};

// Export Sentry instance for advanced usage
export const getSentryInstance = () => Sentry;

export default {
  initializeCrashReporting,
  reportError,
  reportMessage,
  setUserContext,
  addBreadcrumb,
  startTransaction,
  isCrashReportingAvailable,
  testCrashReporting,
  getSentryInstance,
};

