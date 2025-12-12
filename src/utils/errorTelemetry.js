// utils/errorTelemetry.js - Centralized error reporting and telemetry
// Provides consistent error tracking across the application

/**
 * Reports errors to analytics/telemetry services
 * @param {string} eventName - Name of the error event
 * @param {Error} error - The error object
 * @param {Object} context - Additional context about the error
 */
export const reportError = (eventName, error, context = {}) => {
  // Always log to console for development
  console.error(`[${eventName}]`, error, context);
  
  try {
    // Report to Analytics if available
    if (global.Analytics && typeof global.Analytics.trackError === 'function') {
      global.Analytics.trackError(eventName, {
        error: error?.message || 'Unknown error',
        stack: error?.stack?.substring(0, 500), // Limit stack trace size
        timestamp: new Date().toISOString(),
        ...context,
      });
    }
    
    // Report to Sentry if available
    if (global.Sentry && typeof global.Sentry.captureException === 'function') {
      global.Sentry.captureException(error, {
        tags: {
          event: eventName,
          ...context.tags,
        },
        extra: {
          ...context,
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    // Report to Crashlytics if available
    if (global.Crashlytics && typeof global.Crashlytics.recordError === 'function') {
      global.Crashlytics.recordError(error, eventName);
    }
    
  } catch (reportingError) {
    // Don't let error reporting crash the app
    console.warn('Failed to report error to telemetry:', reportingError);
  }
};

/**
 * Reports performance issues to analytics
 * @param {string} eventName - Name of the performance event
 * @param {Object} metrics - Performance metrics
 */
export const reportPerformance = (eventName, metrics = {}) => {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    if (global.Analytics && typeof global.Analytics.trackEvent === 'function') {
      try {
        global.Analytics.trackEvent(`performance_${eventName}`, {
          ...metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.warn('Failed to report performance metrics:', error);
      }
    }
  }
};

/**
 * Reports user actions to analytics
 * @param {string} eventName - Name of the user action
 * @param {Object} properties - Action properties
 */
export const reportUserAction = (eventName, properties = {}) => {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    if (global.Analytics && typeof global.Analytics.trackEvent === 'function') {
      try {
        global.Analytics.trackEvent(`user_${eventName}`, {
          ...properties,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.warn('Failed to report user action:', error);
      }
    }
  }
};

/**
 * Creates a safe wrapper for async functions with error reporting
 * @param {Function} fn - The async function to wrap
 * @param {string} errorEventName - Name for error reporting
 * @param {Object} defaultReturn - Default return value on error
 */
export const withErrorReporting = (fn, errorEventName, defaultReturn = null) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      reportError(errorEventName, error, {
        functionName: fn.name,
        argsCount: args.length,
      });
      return defaultReturn;
    }
  };
};

/**
 * Creates a safe wrapper for sync functions with error reporting
 * @param {Function} fn - The function to wrap
 * @param {string} errorEventName - Name for error reporting
 * @param {Object} defaultReturn - Default return value on error
 */
export const withSyncErrorReporting = (fn, errorEventName, defaultReturn = null) => {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      reportError(errorEventName, error, {
        functionName: fn.name,
        argsCount: args.length,
      });
      return defaultReturn;
    }
  };
};

/**
 * Common error event names for consistency
 */
export const ERROR_EVENTS = {
  // Color wheel errors
  COLOR_WHEEL_GESTURE_FAILED: 'color_wheel_gesture_failed',
  COLOR_WHEEL_RENDER_FAILED: 'color_wheel_render_failed',
  COLOR_ANALYSIS_FAILED: 'color_analysis_failed',
  COLOR_VALIDATION_FAILED: 'color_validation_failed',
  
  // Storage errors
  STORAGE_READ_FAILED: 'storage_read_failed',
  STORAGE_WRITE_FAILED: 'storage_write_failed',
  STORAGE_CLEAR_FAILED: 'storage_clear_failed',
  
  // API errors
  API_REQUEST_FAILED: 'api_request_failed',
  API_AUTH_FAILED: 'api_auth_failed',
  API_TIMEOUT: 'api_timeout',
  
  // Component errors
  COMPONENT_RENDER_FAILED: 'component_render_failed',
  COMPONENT_MOUNT_FAILED: 'component_mount_failed',
  COMPONENT_UPDATE_FAILED: 'component_update_failed',
  
  // Hook errors
  HOOK_INITIALIZATION_FAILED: 'hook_initialization_failed',
  HOOK_UPDATE_FAILED: 'hook_update_failed',
  
  // Image processing errors
  IMAGE_LOAD_FAILED: 'image_load_failed',
  IMAGE_PROCESS_FAILED: 'image_process_failed',
  COLOR_EXTRACTION_FAILED: 'color_extraction_failed',
};

export default {
  reportError,
  reportPerformance,
  reportUserAction,
  withErrorReporting,
  withSyncErrorReporting,
  ERROR_EVENTS,
};
