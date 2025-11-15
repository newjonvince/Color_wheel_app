// utils/AppLogger.js - Production-safe logging without console override
import { Platform } from 'react-native';

class AppLogger {
  constructor() {
    this.isDev = __DEV__;
  }
  
  log(...args) {
    if (this.isDev || this.isImportantMessage(args[0])) {
      console.log(...args);
    }
  }
  
  warn(...args) {
    console.warn(...args); // Always show warnings
  }
  
  error(...args) {
    console.error(...args); // Always show errors
    // Send to crash reporting
    if (!this.isDev) {
      this.reportToSentry(args);
    }
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
