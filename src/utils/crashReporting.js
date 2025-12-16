// utils/crashReporting.js - Crash reporting utility with Sentry integration
// CIRCULAR DEPENDENCY FIX: Lazy load expoConfigHelper to prevent crash on module initialization
let _isDebugMode = null;
let _isProduction = null;

const getIsDebugMode = () => {
  if (_isDebugMode === null) {
    try {
      const helper = require('./expoConfigHelper');
      _isDebugMode = helper.isDebugMode ? helper.isDebugMode() : false;
    } catch (error) {
      console.warn('crashReporting: expoConfigHelper load failed', error?.message);
      _isDebugMode = false;
    }
  }
  return _isDebugMode;
};

const getIsProduction = () => {
  if (_isProduction === null) {
    try {
      const helper = require('./expoConfigHelper');
      _isProduction = helper.isProduction ? helper.isProduction() : true; // Default to production for safety
    } catch (error) {
      console.warn('crashReporting: expoConfigHelper load failed', error?.message);
      _isProduction = true; // Default to production for safety
    }
  }
  return _isProduction;
};

// Sentry instance (lazy loaded to avoid crashes if Sentry isn't available)
let Sentry = null;
let isInitialized = false;

/**
 * Initialize crash reporting (Sentry)
 * Should be called early in app startup
 */
export const initializeCrashReporting = async (options = {}) => {
  if (isInitialized) {
    if (getIsDebugMode()) {
      console.log('[CrashReporting] Already initialized');
    }
    return { success: true, alreadyInitialized: true };
  }

  try {
    // Only initialize Sentry in production
    if (getIsProduction()) {
      try {
        // Dynamic import to avoid bundling issues if Sentry isn't installed
        const SentryModule = await import('@sentry/react-native');
        Sentry = SentryModule;
        
        // Initialize with default options if not already done
        if (options.dsn) {
          Sentry.init({
            dsn: options.dsn,
            enableAutoSessionTracking: true,
            sessionTrackingIntervalMillis: 30000,
            ...options,
          });
        }
        
        isInitialized = true;
        console.log('[CrashReporting] Sentry initialized successfully');
        return { success: true };
      } catch (sentryError) {
        // Sentry not available - graceful degradation
        console.warn('[CrashReporting] Sentry not available:', sentryError.message);
        isInitialized = true; // Mark as initialized to prevent retries
        return { success: false, error: 'Sentry not available' };
      }
    } else {
      if (getIsDebugMode()) {
        console.log('[CrashReporting] Skipping Sentry initialization in development');
      }
      isInitialized = true;
      return { success: true, skipped: true };
    }
  } catch (error) {
    console.error('[CrashReporting] Initialization failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Report an error to crash reporting service
 * @param {Error|string} error - The error to report
 * @param {Object} context - Additional context for the error
 */
export const reportError = (error, context = {}) => {
  try {
    // Always log to console in development
    if (getIsDebugMode()) {
      console.error('[CrashReporting] Error:', error, context);
    }

    // Report to Sentry if available
    if (Sentry?.captureException) {
      if (error instanceof Error) {
        Sentry.captureException(error, {
          extra: context,
        });
      } else {
        Sentry.captureException(new Error(String(error)), {
          extra: { originalError: error, ...context },
        });
      }
    }
  } catch (reportingError) {
    // Fail silently to avoid crashing the app
    if (getIsDebugMode()) {
      console.warn('[CrashReporting] Failed to report error:', reportingError);
    }
  }
};

/**
 * Set user context for crash reports
 * @param {Object} user - User information
 */
export const setUserContext = (user = {}) => {
  try {
    if (Sentry?.setUser) {
      Sentry.setUser({
        id: user.id || user.userId,
        email: user.email,
        username: user.username || user.name,
        ...user,
      });
    }
  } catch (error) {
    if (getIsDebugMode()) {
      console.warn('[CrashReporting] Failed to set user context:', error);
    }
  }
};

/**
 * Clear user context (on logout)
 */
export const clearUserContext = () => {
  try {
    if (Sentry?.setUser) {
      Sentry.setUser(null);
    }
  } catch (error) {
    if (getIsDebugMode()) {
      console.warn('[CrashReporting] Failed to clear user context:', error);
    }
  }
};

/**
 * Add a breadcrumb for debugging
 * @param {Object} breadcrumb - Breadcrumb data
 */
export const addBreadcrumb = (breadcrumb = {}) => {
  try {
    if (Sentry?.addBreadcrumb) {
      Sentry.addBreadcrumb({
        category: breadcrumb.category || 'app',
        message: breadcrumb.message,
        level: breadcrumb.level || 'info',
        data: breadcrumb.data,
      });
    }
  } catch (error) {
    if (getIsDebugMode()) {
      console.warn('[CrashReporting] Failed to add breadcrumb:', error);
    }
  }
};

/**
 * Capture a message (non-error event)
 * @param {string} message - The message to capture
 * @param {string} level - Severity level
 */
export const captureMessage = (message, level = 'info') => {
  try {
    if (Sentry?.captureMessage) {
      Sentry.captureMessage(message, level);
    } else if (getIsDebugMode()) {
      console.log(`[CrashReporting] Message (${level}):`, message);
    }
  } catch (error) {
    if (getIsDebugMode()) {
      console.warn('[CrashReporting] Failed to capture message:', error);
    }
  }
};

export default {
  initializeCrashReporting,
  reportError,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  captureMessage,
};
