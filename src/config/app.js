// config/app.js - Ultra-optimized app configuration with caching and validation
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { logger } from '../utils/AppLogger';

// 🔧 FIXED: Import navigation function at module level to prevent circular dependency
let getStateFromPathDefault = null;
try {
  const navigationModule = require('@react-navigation/native');
  getStateFromPathDefault = navigationModule.getStateFromPath;
} catch (error) {
  logger.warn('🔧 Navigation module not available during config load:', error.message);
  // Will be handled gracefully in the getStateFromPath function
}

// Production-ready environment configuration
const extra = Constants.expoConfig?.extra || {};
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;
const IS_DEV = IS_DEBUG_MODE;
const IS_PROD = !IS_DEBUG_MODE;

// Performance constants
const PERFORMANCE_CONFIG = {
  // Timeout configurations
  TIMEOUTS: {
    APP_INIT: IS_DEV ? 15000 : 10000, // Longer timeout in dev for debugging
    PROFILE_LOAD: IS_DEV ? 8000 : 5000,
    INIT_DELAY: IS_DEV ? 100 : 50, // Slightly longer delay in dev
  },
  
  // Memory management
  MEMORY: {
    MAX_CACHE_SIZE: 100,
    CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
  },
  
  // Performance monitoring
  MONITORING: {
    ENABLED: IS_DEV,
    LOG_THRESHOLD: 100, // Log operations taking longer than 100ms
  }
};

// Memoized app configuration (created once, reused)
const createAppConfig = (() => {
  let cachedConfig = null;
  
  return () => {
    if (cachedConfig) {
      // 🔧 Return deep clone to prevent mutations
      return JSON.parse(JSON.stringify(cachedConfig));
    }
    
    cachedConfig = {
      // Deep linking configuration with validation
      linking: {
        prefixes: ['colorwheel://', 'https://fashioncolorwheel.app'],
        config: { 
          screens: { 
            Community: 'community', 
            ColorWheel: 'wheel', 
            Profile: 'profile', 
            Settings: 'settings' 
          } 
        },
        // 🔧 FIXED: Safe deep linking with circular dependency prevention
        getStateFromPath: (path, options) => {
          try {
            // Use the safely imported function (no circular dependency)
            if (getStateFromPathDefault && typeof getStateFromPathDefault === 'function') {
              return getStateFromPathDefault(path, options);
            } else {
              // Fallback: Try lazy loading if not available at module load
              logger.warn('🔧 Attempting lazy load of navigation function');
              const navigationModule = require('@react-navigation/native');
              if (navigationModule?.getStateFromPath) {
                getStateFromPathDefault = navigationModule.getStateFromPath;
                return getStateFromPathDefault(path, options);
              }
            }
            
            // Final fallback: return undefined to go to initial route
            logger.warn('🔧 Navigation function not available, using fallback');
            return undefined;
          } catch (error) {
            logger.error('🚨 Deep linking error:', error);
            return undefined; // Return to initial route
          }
        },
      },

      // Optimized tab navigation configuration
      tabNavigation: {
        initialRouteName: "ColorWheel",
        screenOptions: {
          tabBarActiveTintColor: '#e74c3c',
          tabBarInactiveTintColor: '#7f8c8d',
          headerShown: false,
          // Performance optimizations
          lazy: true,
          unmountOnBlur: false, // Keep screens mounted for faster navigation
          freezeOnBlur: true, // Freeze inactive screens to save memory
        },
        options: {
          // iOS-only optimizations - no Android settings needed
          detachInactiveScreens: false, // Keep screens attached for iOS performance
        }
      },

      // Enhanced tab icons with custom images and emoji fallbacks
      tabIcons: {
        Community: { 
          focused: '🌍', 
          unfocused: '🌎',
          description: 'Community tab - connects users together'
        },
        ColorWheel: { 
          focused: '🌈', 
          unfocused: '⭕',
          description: 'Color Wheel tab - main color selection tool'
        },
        Profile: { 
          focused: '👤', 
          unfocused: '👥',
          description: 'Profile tab - user profile and boards'
        },
        Settings: { 
          focused: '⚙️', 
          unfocused: '🔧',
          description: 'Settings tab - app configuration'
        },
      },

      // Performance-optimized initialization settings
      initialization: PERFORMANCE_CONFIG.TIMEOUTS,
      
      // Performance monitoring configuration
      performance: PERFORMANCE_CONFIG.MONITORING,
      
      // Memory management configuration
      memory: PERFORMANCE_CONFIG.MEMORY,
    };
    
    // Validate configuration in development
    if (IS_DEV) {
      validateAppConfig(cachedConfig);
    }
    
    // 🔧 Freeze object to prevent mutations in development
    if (__DEV__) {
      Object.freeze(cachedConfig);
      Object.freeze(cachedConfig.linking);
      Object.freeze(cachedConfig.linking.config);
      Object.freeze(cachedConfig.linking.config.screens);
      // Note: getStateFromPath is a function, don't freeze it
    }
    
    return JSON.parse(JSON.stringify(cachedConfig));
  };
})();

// Configuration validation (development only)
const validateAppConfig = (config) => {
  const requiredScreens = ['Community', 'ColorWheel', 'Profile', 'Settings'];
  const configuredScreens = Object.keys(config.linking.config.screens);
  
  const missingScreens = requiredScreens.filter(screen => !configuredScreens.includes(screen));
  if (missingScreens.length > 0) {
    console.warn('⚠️ Missing screen configurations:', missingScreens);
  }
  
  const iconScreens = Object.keys(config.tabIcons);
  const missingIcons = requiredScreens.filter(screen => !iconScreens.includes(screen));
  if (missingIcons.length > 0) {
    console.warn('⚠️ Missing tab icons:', missingIcons);
  }
  
  logger.debug('✅ App configuration validated successfully');
};

// Memoized configuration getter
export const APP_CONFIG = createAppConfig();

// Optimized initialization with error handling and performance monitoring
let isInitialized = false;
let initializationPromise = null;

export const initializeAppConfig = () => {
  // Return existing promise if already initializing
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // Return immediately if already initialized
  if (isInitialized) {
    return Promise.resolve();
  }
  
  initializationPromise = new Promise((resolve, reject) => { // 🔧 Added reject
    const startTime = Date.now();
    
    try {
      // Production JS fatal handler with enhanced error reporting
      if (IS_PROD && global?.ErrorUtils?.setGlobalHandler) {
        const originalHandler = global.ErrorUtils.getGlobalHandler?.();
        
        global.ErrorUtils.setGlobalHandler((error, isFatal) => {
          // Enhanced error logging for production
          const errorInfo = {
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            isFatal,
            timestamp: new Date().toISOString(),
            platform: Platform.OS,
            version: Platform.Version,
          };
          
          console.error('🚨 JS Fatal Error:', JSON.stringify(errorInfo, null, 2));
          
          // Call original handler
          originalHandler?.(error, isFatal);
        });
      }

      if (IS_PROD) {
        // ✅ PRODUCTION: No debug logging at all
        if (__DEV__) {
          logger.debug('Production logging configured');
        }
      }
      
      // Development-specific optimizations
      if (IS_DEV) {
        // Enable performance monitoring
        if (APP_CONFIG.performance.ENABLED) {
          logger.debug('🚀 Performance monitoring enabled');
        }
        
        // Log configuration summary
        logger.debug('📱 App configuration initialized:', {
          screens: Object.keys(APP_CONFIG.linking.config.screens).length,
          icons: Object.keys(APP_CONFIG.tabIcons).length,
          performance: APP_CONFIG.performance.ENABLED,
        });
      }
      
      isInitialized = true;
      
      const initTime = Date.now() - startTime;
      if (IS_DEV && initTime > 10) {
        logger.debug(`⏱️ App config initialization took ${initTime}ms`);
      }
      
      resolve();
      
    } catch (error) {
      console.error('❌ App configuration initialization failed:', error);
      
      // 🔧 Reject on critical errors
      if (IS_PROD) {
        // In production, fail gracefully
        logger.error('Critical config error, using defaults');
        resolve(); // Allow app to continue with defaults
      } else {
        // In development, fail loud
        reject(error);
      }
    }
  });
  
  return initializationPromise;
};

// Memoized status bar style with platform optimization
const statusBarStyleCache = new Map();
const MAX_CACHE_SIZE = 10; // Prevent unlimited growth

export const getStatusBarStyle = () => {
  const cacheKey = Platform.OS;
  
  if (statusBarStyleCache.has(cacheKey)) {
    return statusBarStyleCache.get(cacheKey);
  }
  
  // 🔧 Prevent memory leak: Clear cache if it gets too large
  if (statusBarStyleCache.size >= MAX_CACHE_SIZE) {
    logger.warn('🧹 Clearing statusBarStyleCache to prevent memory leak');
    statusBarStyleCache.clear();
  }
  
  const style = Platform.OS === 'ios' ? 'dark-content' : 'default';
  statusBarStyleCache.set(cacheKey, style);
  
  return style;
};

// Optimized helper functions with memoization
const userCache = new WeakMap();

export const pickUser = (userInput) => {
  if (!userInput) return null;
  
  // Check cache first
  if (userCache.has(userInput)) {
    return userCache.get(userInput);
  }
  
  // Process user data
  const result = userInput?.user ? userInput.user : userInput;
  
  // Cache the result
  if (userInput && typeof userInput === 'object') {
    userCache.set(userInput, result);
  }
  
  return result;
};

// Memoized storage key generator
const storageKeyCache = new Map();
const MAX_STORAGE_CACHE_SIZE = 100; // Reasonable limit for user IDs

export const getMatchesKey = (userId) => {
  const cacheKey = userId || 'anon';
  
  if (storageKeyCache.has(cacheKey)) {
    return storageKeyCache.get(cacheKey);
  }
  
  // 🔧 Prevent memory leak: Clear cache if it gets too large
  if (storageKeyCache.size >= MAX_STORAGE_CACHE_SIZE) {
    logger.warn('🧹 Clearing storageKeyCache to prevent memory leak');
    storageKeyCache.clear();
  }
  
  const key = `savedColorMatches:${cacheKey}`;
  storageKeyCache.set(cacheKey, key);
  
  return key;
};

// 🔧 Periodic cache cleanup to prevent memory leaks
const setupCacheCleanup = () => {
  // Only set up cleanup in long-running environments
  if (typeof setInterval !== 'undefined') {
    const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
    
    setInterval(() => {
      const statusCacheSize = statusBarStyleCache.size;
      const storageCacheSize = storageKeyCache.size;
      
      // Clear caches if they're getting large
      if (statusCacheSize > 5) {
        logger.debug('🧹 Periodic cleanup: clearing statusBarStyleCache');
        statusBarStyleCache.clear();
      }
      
      if (storageCacheSize > 50) {
        logger.debug('🧹 Periodic cleanup: clearing storageKeyCache');
        storageKeyCache.clear();
      }
      
      if (IS_DEV && (statusCacheSize > 0 || storageCacheSize > 0)) {
        logger.debug(`📊 Cache sizes - StatusBar: ${statusCacheSize}, Storage: ${storageCacheSize}`);
      }
    }, CLEANUP_INTERVAL);
  }
};

// Initialize cleanup on module load
setupCacheCleanup();

// Export cache cleanup utilities for manual cleanup if needed
export const clearAllCaches = () => {
  statusBarStyleCache.clear();
  storageKeyCache.clear();
  logger.info('🧹 All caches cleared manually');
};

// Performance monitoring utilities (development only)
export const performanceUtils = IS_DEV ? {
  startTimer: (label) => {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      if (duration > APP_CONFIG.performance.LOG_THRESHOLD) {
        logger.debug(`⏱️ ${label}: ${duration}ms`);
      }
      return duration;
    };
  },
  
  measureAsync: async (label, asyncFn) => {
    const endTimer = performanceUtils.startTimer(label);
    try {
      const result = await asyncFn();
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      throw error;
    }
  }
} : {
  startTimer: () => () => 0,
  measureAsync: async (label, asyncFn) => asyncFn()
};

// Memory management utilities
export const memoryUtils = {
  clearCaches: () => {
    statusBarStyleCache.clear();
    storageKeyCache.clear();
    // userCache is WeakMap, so it clears automatically
    
    if (IS_DEV) {
      logger.debug('🧹 Configuration caches cleared');
    }
  },
  
  getCacheStats: () => ({
    statusBarCache: statusBarStyleCache.size,
    storageKeyCache: storageKeyCache.size,
    userCache: 'WeakMap (auto-managed)',
  })
};

// Cleanup function for app shutdown
export const cleanupAppConfig = () => {
  memoryUtils.clearCaches();
  isInitialized = false;
  initializationPromise = null;
  
  if (IS_DEV) {
    logger.debug('🧹 App configuration cleaned up');
  }
};

// Export environment flags for other modules
export const ENV = {
  IS_DEV,
  IS_PROD,
  PLATFORM: Platform.OS,
  VERSION: Platform.Version,
};

// Default export for convenience
export default {
  APP_CONFIG,
  initializeAppConfig,
  getStatusBarStyle,
  pickUser,
  getMatchesKey,
  performanceUtils,
  memoryUtils,
  cleanupAppConfig,
  ENV,
};
