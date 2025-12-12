// utils/AppLogger.js - Production-safe logging with EXPO_PUBLIC flags
// ✅ Use shared helper to avoid duplicate code
import { getSafeExpoExtra, isDebugMode } from './expoConfigHelper';

// Lazy-load extra to avoid module-load crashes and handle late Constants
let cachedExtra = null;
const getExtra = () => {
  if (!cachedExtra) {
    cachedExtra = getSafeExpoExtra();
  }
  return cachedExtra;
};

const IS_DEBUG_MODE = isDebugMode;
const LOG_LEVEL = () => {
  const level = getExtra().EXPO_PUBLIC_LOG_LEVEL;
  const validLevels = ['debug', 'info', 'warn', 'error'];
  return validLevels.includes(level) ? level : 'warn';
};

class AppLogger {
  constructor({ lazyInit = true } = {}) {
    this.isDebugMode = false;
    this.logLevel = 'warn';
    this.sentryEnabled = false; // Flag
    this._initialized = false;
    
    // ✅ SENTRY FAILURE TRACKING WITH RECOVERY
    this._sentryFailures = [];
    this._sentryDisabledUntil = null;
    this._maxFailuresInWindow = 10;
    this._failureWindowMs = 5 * 60 * 1000; // 5 minutes
    this._disableDurationMs = 10 * 60 * 1000; // 10 minutes

    if (!lazyInit) {
      this.initialize();
    }
  }

  initialize() {
    this._initialized = true;
    try {
      this.isDebugMode = IS_DEBUG_MODE();
      this.logLevel = LOG_LEVEL();
      // ✅ CRASH FIX: Use typeof check to prevent ReferenceError in production
      if ((typeof __DEV__ === 'undefined' || !__DEV__) && global.Sentry) {
        this.sentryEnabled = true;
      }
    } catch (e) {
      this.isDebugMode = false;
      this.logLevel = 'warn';
      this.sentryEnabled = false;
    }
  }

  ensureInitialized() {
    if (!this._initialized) {
      this.initialize();
    }
  }

  safeConsole(method, tag, args) {
    try {
      const fn = console?.[method];
      if (typeof fn === 'function') {
        fn(tag, ...args);
      }
    } catch (_) {
      // Swallow to avoid crashing on non-serializable args
    }
  }

  shouldLog(level) {
    this.ensureInitialized();
    try {
      const levels = ['debug', 'info', 'warn', 'error'];
      const currentLevelIndex = levels.indexOf(this.logLevel);
      const normalizedCurrentIndex = currentLevelIndex === -1 ? levels.indexOf('warn') : currentLevelIndex;
      const requestedLevelIndex = levels.indexOf(level);
      const normalizedRequestedIndex = requestedLevelIndex === -1 ? levels.indexOf('error') : requestedLevelIndex;
      
      if (this.isDebugMode) return true;
      return normalizedRequestedIndex >= normalizedCurrentIndex;
    } catch (_) {
      // On any internal error, fail safe: log errors only
      return level === 'error';
    }
  }
  
  isImportantMessage(msg) {
    return typeof msg === 'string' && (
      msg.includes('FullColorWheel') ||
      msg.includes('SafeStorage') ||
      msg.includes('API Integration') ||
      msg.includes('AsyncStorage')
    );
  }

  // ✅ SENTRY FAILURE MANAGEMENT WITH RECOVERY
  _cleanOldFailures() {
    const now = Date.now();
    this._sentryFailures = this._sentryFailures.filter(
      timestamp => now - timestamp < this._failureWindowMs
    );
  }

  _isSentryTemporarilyDisabled() {
    if (!this._sentryDisabledUntil) return false;
    
    const now = Date.now();
    if (now > this._sentryDisabledUntil) {
      // ✅ CIRCUIT BREAKER FIX: Re-enable Sentry but don't clear failures until actual success
      this._sentryDisabledUntil = null;
      // ✅ Keep failure history - only clear on actual successful operations via _recordSentrySuccess()
      console.log('[AppLogger] Sentry re-enabled after disable period (failures preserved until success)');
      return false;
    }
    
    return true;
  }

  _recordSentryFailure() {
    const now = Date.now();
    this._cleanOldFailures();
    this._sentryFailures.push(now);
    
    if (this._sentryFailures.length >= this._maxFailuresInWindow) {
      this._sentryDisabledUntil = now + this._disableDurationMs;
      console.warn(`[AppLogger] Temporarily disabling Sentry for ${this._disableDurationMs / 60000} minutes after ${this._maxFailuresInWindow} failures in ${this._failureWindowMs / 60000} minutes`);
    }
  }

  _recordSentrySuccess() {
    // ✅ SUCCESS RESETS: Clear recent failures on successful report
    if (this._sentryFailures.length > 0) {
      this._sentryFailures = [];
      console.log('[AppLogger] Sentry failure count reset after successful report');
    }
  }

  debug(...args) {
    if (this.shouldLog('debug')) {
      this.safeConsole('log', '[DEBUG]', args);
    }
  }
  
  info(...args) {
    if (this.shouldLog('info')) {
      this.safeConsole('log', '[INFO]', args);
    }
  }
  
  log(...args) {
    // Alias for info for backward compatibility
    this.info(...args);
  }
  
  warn(...args) {
    if (this.shouldLog('warn')) {
      this.safeConsole('warn', '[WARN]', args);
    }
  }
  
  error(...args) {
    if (this.shouldLog('error')) {
      this.safeConsole('error', '[ERROR]', args);
    }
    
    if (this.sentryEnabled) {
      this.reportToSentry(args);
    }
  }
  
  reportToSentry(args) {
    try {
      if (!this.sentryEnabled) {
        return;
      }

      // ✅ CHECK TEMPORARY DISABLE STATUS
      if (this._isSentryTemporarilyDisabled()) {
        return; // Skip reporting during disable period
      }

      if (global?.Sentry?.captureException) {
        const error = args?.[0];

        if (error instanceof Error) {
          global.Sentry.captureException(error);
        } else {
          let errorMessage = 'Unknown error';
          try {
            errorMessage =
              typeof error === 'string'
                ? error
                : JSON.stringify(error || 'Unknown error');
          } catch (stringifyErr) {
            // Fallback if JSON.stringify fails (e.g., circular refs)
            errorMessage = String(error || 'Unknown error');
          }
          global.Sentry.captureException(new Error(errorMessage));
        }
        
        // ✅ RECORD SUCCESS: Reset failure count on successful report
        this._recordSentrySuccess();
      }
    } catch (err) {
      // ✅ CRASH FIX: Use typeof check to prevent ReferenceError in production
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[AppLogger] Sentry capture failed:', err);
      }

      // ✅ SMART FAILURE TRACKING: Time-based with recovery
      this._recordSentryFailure();
    }
  }
}

// Create logger lazily initialized to avoid module-load crashes
export const logger = new AppLogger({ lazyInit: true });
export default logger;

