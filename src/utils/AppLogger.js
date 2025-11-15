// utils/AppLogger.js - Production-safe logging with EXPO_PUBLIC flags
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;
const LOG_LEVEL = extra.EXPO_PUBLIC_LOG_LEVEL || 'warn';

class AppLogger {
  constructor() {
    this.isDebugMode = IS_DEBUG_MODE;
    this.logLevel = LOG_LEVEL;
  }
  
  debug(...args) {
    if (this.shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  }
  
  info(...args) {
    if (this.shouldLog('info')) {
      console.log('[INFO]', ...args);
    }
  }
  
  log(...args) {
    // Alias for info for backward compatibility
    this.info(...args);
  }
  
  warn(...args) {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }
  
  error(...args) {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
    // Send to crash reporting in production
    if (!this.isDebugMode) {
      this.reportToSentry(args);
    }
  }
  
  shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    
    // If debug mode is on, show everything
    if (this.isDebugMode) return true;
    
    // Otherwise, only show messages at or above the configured level
    return requestedLevelIndex >= currentLevelIndex;
  }
  
  isImportantMessage(msg) {
    return typeof msg === 'string' && (
      msg.includes('✅') || msg.includes('❌') || msg.includes('🚨') ||
      msg.includes('🔐') || msg.includes('📱') || msg.includes('🔄') ||
      msg.includes('FullColorWheel') || msg.includes('SafeStorage') ||
      msg.includes('API Integration') || msg.includes('AsyncStorage')
    );
  }
  
  reportToSentry(args) {
    // TODO: Implement Sentry integration
    // Example: Sentry.captureException(args[0]);
  }
}

export const logger = new AppLogger();
export default logger;
