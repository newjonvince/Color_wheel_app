// config/appconfig.js - Ultra-optimized app configuration with caching and validation
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';

// ✅ CIRCULAR DEPENDENCY FIX: Simple console wrapper instead of AppLogger
// ✅ CRASH FIX: Use typeof check to prevent ReferenceError in production
const log = {
  debug: (...args) => (typeof __DEV__ !== 'undefined' && __DEV__) && console.log('[CONFIG]', ...args),
  info: (...args) => console.log('[CONFIG]', ...args),
  warn: (...args) => console.warn('[CONFIG]', ...args),
  error: (...args) => console.error('[CONFIG]', ...args),
};

// Import navigation function at module level to prevent circular dependency
let getStateFromPathDefault = null;
try {
  const navigationModule = require('@react-navigation/native');
  getStateFromPathDefault = navigationModule.getStateFromPath;
  } catch (error) {
    try {
      log.warn('Navigation module not available during config load:', error.message);
    } catch (logError) {
      console.warn('Navigation module not available during config load (fallback):', error?.message || error);
    }
  // Will be handled gracefully in the getStateFromPath function
}

// Production-ready environment configuration
const getSafeExpoExtra = () => {
  try {
    const expoConfig = Constants?.expoConfig;
    if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
      return expoConfig.extra;
    }
    console.warn('⚠️ config/appconfig: expoConfig missing or malformed, using empty extra config');
  } catch (error) {
    console.warn('⚠️ config/appconfig: Unable to read expoConfig safely, using defaults', error);
  }
  return {};
};

const extra = getSafeExpoExtra();
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

// Cache helpers
const trimCacheToSize = (cache, maxSize) => {
  if (!cache || typeof cache.size !== 'number') return 0;
  if (cache.size <= maxSize) return 0;

  let removed = 0;
  const excess = cache.size - maxSize;
  for (const key of cache.keys()) {
    cache.delete(key);
    removed += 1;
    if (removed >= excess) break;
  }
  return removed;
};

// Safe navigation fallback builder to avoid crashes on invalid deep links
const buildFallbackNavigationState = () => ({
  routes: [{ name: 'ColorWheel' }],
});

// Memoized app configuration (created once, reused)
const createAppConfig = (() => {
  let cachedConfig = null;
  
  return () => {
    if (cachedConfig) {
      // ✅ FIXED: Deep clone objects but preserve functions
      return {
        ...cachedConfig,
        linking: {
          ...cachedConfig.linking,
          config: {
            ...cachedConfig.linking.config,
            screens: { ...cachedConfig.linking.config.screens }
          },
          // ✅ CRITICAL: Preserve getStateFromPath function - don't clone it!
          getStateFromPath: cachedConfig.linking.getStateFromPath
        },
        tabNavigation: { 
          ...cachedConfig.tabNavigation,
          screenOptions: { ...cachedConfig.tabNavigation.screenOptions },
          options: { ...cachedConfig.tabNavigation.options }
        },
        tabIcons: { ...cachedConfig.tabIcons },
        initialization: { ...cachedConfig.initialization },
        performance: { ...cachedConfig.performance },
        memory: { ...cachedConfig.memory },
      };
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
        // Safe deep linking with circular dependency prevention
        getStateFromPath: (path, options) => {
          // Guard against invalid or empty paths
          if (typeof path !== 'string' || path.trim().length === 0) {
            log.warn('Invalid deep link path, using safe fallback state');
            return buildFallbackNavigationState();
          }

          try {
            // Use the safely imported function (no circular dependency)
            if (getStateFromPathDefault && typeof getStateFromPathDefault === 'function') {
              const parsedState = getStateFromPathDefault(path, options);
              if (!parsedState || !Array.isArray(parsedState.routes) || parsedState.routes.length === 0) {
                log.warn('Navigation state invalid/empty, falling back to initial route');
                return buildFallbackNavigationState();
              }
              return parsedState;
            }

            // Fallback: Try lazy loading if not available at module load
            log.warn('Attempting lazy load of navigation function');
            const navigationModule = require('@react-navigation/native');
            if (navigationModule?.getStateFromPath) {
              getStateFromPathDefault = navigationModule.getStateFromPath;
              const parsedState = getStateFromPathDefault(path, options);
              if (!parsedState || !Array.isArray(parsedState.routes) || parsedState.routes.length === 0) {
                log.warn('Navigation state invalid/empty after lazy load, falling back to initial route');
                return buildFallbackNavigationState();
              }
              return parsedState;
            }
            
            // Final fallback: use safe initial state when navigation module is missing
            log.warn('Navigation function not available, using fallback');
            return buildFallbackNavigationState();
          } catch (error) {
            log.error('Deep linking error:', error);
            return buildFallbackNavigationState(); // Return to initial route safely
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

      // Enhanced tab icons with Unicode escape sequences to avoid bundle issues
      tabIcons: {
        Community: { 
          focused: '\u{1F310}', // 🌐 Globe with meridians
          unfocused: '\u{1F30D}', // 🌍 Earth globe Europe-Africa
          description: 'Community tab - connects users together'
        },
        ColorWheel: { 
          focused: '\u{1F3A8}', // 🎨 Artist palette
          unfocused: '\u{1F3AD}', // 🎭 Performing arts
          description: 'Color Wheel tab - main color selection tool'
        },
        Profile: { 
          focused: '\u{1F464}', // 👤 Bust in silhouette
          unfocused: '\u{1F465}', // 👥 Busts in silhouette
          description: 'Profile tab - user profile and boards'
        },
        Settings: { 
          focused: '\u{2699}\u{FE0F}', // ⚙️ Gear
          unfocused: '\u{1F527}', // 🔧 Wrench
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
    
    // Freeze object to prevent mutations in development
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      Object.freeze(cachedConfig);
      Object.freeze(cachedConfig.linking);
      Object.freeze(cachedConfig.linking.config);
      Object.freeze(cachedConfig.linking.config.screens);
      // Note: getStateFromPath is a function, don't freeze it
    }
    
    // ✅ FIXED: Return the config directly - it's already created and cached
    // No need to clone on first creation since we're caching the original
    return cachedConfig;
  };
})();

// Configuration validation (development only)
const validateAppConfig = (config) => {
  const requiredScreens = ['Community', 'ColorWheel', 'Profile', 'Settings'];
  const configuredScreens = Object.keys(config.linking.config.screens);
  
  const missingScreens = requiredScreens.filter(screen => !configuredScreens.includes(screen));
  if (missingScreens.length > 0) {
    log.warn('Missing screen configurations:', missingScreens);
  }
  
  const iconScreens = Object.keys(config.tabIcons);
  const missingIcons = requiredScreens.filter(screen => !iconScreens.includes(screen));
  if (missingIcons.length > 0) {
    log.warn('Missing tab icons:', missingIcons);
  }
  
  log.debug('App configuration validated successfully');
};

// Memoized configuration getter
export const APP_CONFIG = createAppConfig();

// Optimized initialization with error handling and performance monitoring
let isInitialized = false;
let initializationPromise = null;

export const initializeAppConfig = () => {
  // Return immediately if already initialized
  if (isInitialized) {
    return Promise.resolve({ ok: true, alreadyInitialized: true });
  }

  // ✅ RACE CONDITION FIX: Synchronous lock to prevent duplicate initialization
  if (initializationPromise) {
    return initializationPromise;
  }

  const startTime = Date.now();

  // ✅ RACE CONDITION FIX: Create and assign promise synchronously BEFORE any async work
  initializationPromise = (async () => {
    try {
      // Production JS fatal handler with enhanced error reporting
      if (IS_PROD && global?.ErrorUtils?.setGlobalHandler) {
        const originalHandler = global.ErrorUtils.getGlobalHandler?.();
        
        global.ErrorUtils.setGlobalHandler((error, isFatal) => {
          const errorInfo = {
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            isFatal,
            timestamp: new Date().toISOString(),
            platform: Platform.OS,
            version: Platform.Version,
          };
          
          console.error('JS Fatal Error:', JSON.stringify(errorInfo, null, 2));
          originalHandler?.(error, isFatal);
        });
      }

        if (IS_PROD) {
          log.debug('Production logging configured');
        }
        
        if (IS_DEV) {
          if (APP_CONFIG.performance.ENABLED) {
            log.debug('Performance monitoring enabled');
          }
          
          log.debug('App configuration initialized:', {
            screens: Object.keys(APP_CONFIG.linking.config.screens).length,
            icons: Object.keys(APP_CONFIG.tabIcons).length,
            performance: APP_CONFIG.performance.ENABLED,
          });
        }
      
      isInitialized = true;
      
      const initTime = Date.now() - startTime;
      if (IS_DEV && initTime > 10) {
        log.debug(`App config initialization took ${initTime}ms`);
      }
      
      return { ok: true };
      
    } catch (error) {
      isInitialized = false;
      console.error('App configuration initialization failed:', error);
      
      const configError = new Error(`App configuration initialization failed: ${error.message}`);
      configError.cause = error;
      configError.category = 'ConfigError';
      
      log.error('Critical config error - cannot continue without valid configuration');
      
      throw configError;
    } finally {
      initializationPromise = null;
    }
  })();
  
  return initializationPromise;
};

// Memoized status bar style with platform optimization
const statusBarStyleCache = new Map();
const MAX_STATUS_CACHE_SIZE = 10; // Prevent unlimited growth

export const getStatusBarStyle = () => {
  const cacheKey = Platform.OS;
  
  if (statusBarStyleCache.has(cacheKey)) {
    return statusBarStyleCache.get(cacheKey);
  }
  
  // Prevent memory leak: trim oldest entries instead of clearing all
  if (statusBarStyleCache.size >= MAX_STATUS_CACHE_SIZE) {
    const removed = trimCacheToSize(statusBarStyleCache, MAX_STATUS_CACHE_SIZE - 1);
      if (removed > 0 && IS_DEV) {
        log.debug(`statusBarStyleCache trimmed by ${removed} to stay within limit`);
      }
  }
  
  const style = Platform.OS === 'ios' ? 'dark-content' : 'default';
  statusBarStyleCache.set(cacheKey, style);
  
  return style;
};

// Optimized helper functions with memoization
const userCache = new WeakMap();

export const pickUser = (userInput) => {
  if (!userInput) return null;
  
  if (userCache.has(userInput)) {
    return userCache.get(userInput);
  }
  
  const result = userInput?.user ? userInput.user : userInput;
  
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
  
  // Prevent memory leak: trim oldest entries instead of clearing all
  if (storageKeyCache.size >= MAX_STORAGE_CACHE_SIZE) {
    const removed = trimCacheToSize(storageKeyCache, MAX_STORAGE_CACHE_SIZE - 1);
      if (removed > 0 && IS_DEV) {
        log.debug(`storageKeyCache trimmed by ${removed} to stay within limit`);
      }
  }
  
  const key = `savedColorMatches:${cacheKey}`;
  storageKeyCache.set(cacheKey, key);
  
  return key;
};

// ✅ MEMORY LEAK FIX: Safer interval management to prevent orphaned intervals
let cacheCleanupInterval = null;

const setupCacheCleanup = () => {
  // Clear any existing interval first to prevent accumulation
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval);
    cacheCleanupInterval = null;
  }

  if (typeof setInterval !== 'undefined') {
    const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
    
    cacheCleanupInterval = setInterval(() => {
      const statusCacheSize = statusBarStyleCache.size;
      const storageCacheSize = storageKeyCache.size;
      
      const removedStatus = statusCacheSize > MAX_STATUS_CACHE_SIZE
        ? trimCacheToSize(statusBarStyleCache, MAX_STATUS_CACHE_SIZE)
        : 0;
      const removedStorage = storageCacheSize > MAX_STORAGE_CACHE_SIZE
        ? trimCacheToSize(storageKeyCache, MAX_STORAGE_CACHE_SIZE)
        : 0;
      
      if (IS_DEV && (removedStatus > 0 || removedStorage > 0)) {
        log.debug(`Cache cleanup trimmed - StatusBar: ${removedStatus}, Storage: ${removedStorage}`);
      }
      
      if (IS_DEV && (statusBarStyleCache.size > 0 || storageKeyCache.size > 0)) {
        log.debug(`Cache sizes - StatusBar: ${statusBarStyleCache.size}, Storage: ${storageKeyCache.size}`);
      }
    }, CLEANUP_INTERVAL);
  }
};

// ✅ SAFE CLEANUP: Properly exposed cleanup function
export const stopCacheCleanup = () => {
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval);
    cacheCleanupInterval = null;
    if (IS_DEV) {
      log.debug('Cache cleanup interval stopped');
    }
  }
};

// Initialize cleanup on module load
setupCacheCleanup();

// ✅ APP STATE MANAGEMENT: Handle background/foreground transitions
let appStateSubscription = null;

const handleAppStateChange = (nextAppState) => {
  if (nextAppState === 'background') {
    // Stop cleanup when app goes to background to save resources
    stopCacheCleanup();
    if (IS_DEV) {
      log.debug('App backgrounded - cache cleanup stopped');
    }
  } else if (nextAppState === 'active') {
    // Restart cleanup when app becomes active
    setupCacheCleanup();
    if (IS_DEV) {
      log.debug('App foregrounded - cache cleanup restarted');
    }
  }
};

// Set up AppState listener
if (typeof AppState !== 'undefined' && AppState.addEventListener) {
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
}

// Export function to clean up AppState listener
export const cleanupAppStateListener = () => {
  if (appStateSubscription && typeof appStateSubscription.remove === 'function') {
    appStateSubscription.remove();
    appStateSubscription = null;
    if (IS_DEV) {
      log.debug('AppState listener removed');
    }
  }
};

// Export cache cleanup utilities for manual cleanup if needed
export const clearAllCaches = () => {
  statusBarStyleCache.clear();
  storageKeyCache.clear();
  log.info('All caches cleared manually');
};

// ✅ DEPRECATED: Use stopCacheCleanup() directly instead
export const stopCacheCleanupInterval = stopCacheCleanup;

// Performance monitoring utilities (development only)
export const performanceUtils = IS_DEV ? {
  startTimer: (label) => {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      if (duration > APP_CONFIG.performance.LOG_THRESHOLD) {
        log.debug(`${label}: ${duration}ms`);
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
      log.debug('Configuration caches cleared');
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
  stopCacheCleanup(); // Stop interval
  cleanupAppStateListener(); // Remove AppState listener
  isInitialized = false;
  initializationPromise = null;
  
  if (IS_DEV) {
    log.debug('App configuration cleaned up');
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
