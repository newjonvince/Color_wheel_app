// config/app.js - Ultra-optimized app configuration with caching and validation
import { Platform, LogBox } from 'react-native';

// Environment-specific configuration
const IS_DEV = __DEV__;
const IS_PROD = !__DEV__;

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
    if (cachedConfig) return cachedConfig;
    
    cachedConfig = {
      // Deep linking configuration with validation
      linking: {
        prefixes: ['colorwheel://'],
        config: { 
          screens: { 
            Community: 'community', 
            ColorWheel: 'wheel', 
            Profile: 'profile', 
            Settings: 'settings' 
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
    
    return cachedConfig;
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
  
  console.log('✅ App configuration validated successfully');
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
  
  initializationPromise = new Promise((resolve) => {
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

      // Optimized log suppression for production
      if (IS_PROD) {
        LogBox.ignoreAllLogs(true);
        
        // Override console methods in production for performance
        const noop = () => {};
        console.log = noop;
        console.info = noop;
        console.warn = noop;
        // Keep console.error for critical issues
      }
      
      // Development-specific optimizations
      if (IS_DEV) {
        // Enable performance monitoring
        if (APP_CONFIG.performance.ENABLED) {
          console.log('🚀 Performance monitoring enabled');
        }
        
        // Log configuration summary
        console.log('📱 App configuration initialized:', {
          screens: Object.keys(APP_CONFIG.linking.config.screens).length,
          icons: Object.keys(APP_CONFIG.tabIcons).length,
          performance: APP_CONFIG.performance.ENABLED,
        });
      }
      
      isInitialized = true;
      
      const initTime = Date.now() - startTime;
      if (IS_DEV && initTime > 10) {
        console.log(`⏱️ App config initialization took ${initTime}ms`);
      }
      
      resolve();
      
    } catch (error) {
      console.error('❌ App configuration initialization failed:', error);
      // Don't throw - allow app to continue with default behavior
      resolve();
    }
  });
  
  return initializationPromise;
};

// Memoized status bar style with platform optimization
const statusBarStyleCache = new Map();

export const getStatusBarStyle = () => {
  const cacheKey = Platform.OS;
  
  if (statusBarStyleCache.has(cacheKey)) {
    return statusBarStyleCache.get(cacheKey);
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

export const getMatchesKey = (userId) => {
  const cacheKey = userId || 'anon';
  
  if (storageKeyCache.has(cacheKey)) {
    return storageKeyCache.get(cacheKey);
  }
  
  const key = `savedColorMatches:${cacheKey}`;
  storageKeyCache.set(cacheKey, key);
  
  return key;
};

// Performance monitoring utilities (development only)
export const performanceUtils = IS_DEV ? {
  startTimer: (label) => {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      if (duration > APP_CONFIG.performance.LOG_THRESHOLD) {
        console.log(`⏱️ ${label}: ${duration}ms`);
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
      console.log('🧹 Configuration caches cleared');
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
    console.log('🧹 App configuration cleaned up');
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
