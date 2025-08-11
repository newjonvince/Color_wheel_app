// Production-ready logging utility for Railway deployment
// Reduces log output to prevent Railway's 500 logs/sec rate limit

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Log levels: ERROR, WARN, INFO, DEBUG
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Production: Only ERROR and WARN
// Development: All levels
const currentLogLevel = isProduction ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;

const logger = {
  error: (...args) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      console.error('[ERROR]', ...args);
    }
  },
  
  warn: (...args) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.warn('[WARN]', ...args);
    }
  },
  
  info: (...args) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log('[INFO]', ...args);
    }
  },
  
  debug: (...args) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  // Always log critical startup/shutdown messages
  startup: (...args) => {
    console.log('[STARTUP]', ...args);
  },
  
  // Rate-limited logging for high-frequency events
  rateLimited: (() => {
    const lastLog = new Map();
    const RATE_LIMIT_MS = 5000; // Max once per 5 seconds per key
    
    return (key, ...args) => {
      const now = Date.now();
      const lastTime = lastLog.get(key) || 0;
      
      if (now - lastTime > RATE_LIMIT_MS) {
        lastLog.set(key, now);
        logger.info(`[RATE-LIMITED:${key}]`, ...args);
      }
    };
  })()
};

module.exports = logger;
