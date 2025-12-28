// App.js - Simplified Fashion Color Wheel App
import 'react-native-gesture-handler';

// Configure LogBox FIRST - before any other imports or code
import { LogBox } from 'react-native';

let _expoConstants = undefined;
const getExpoConstants = () => {
  if (_expoConstants !== undefined) return _expoConstants;
  try {
    _expoConstants = require('expo-constants')?.default ?? null;
  } catch (_error) {
    _expoConstants = null;
  }
  return _expoConstants;
};

const getExpoExtra = () => {
  const Constants = getExpoConstants();
  return Constants?.expoConfig?.extra || {};
};

// Configure LogBox immediately at app entry point
const extra = getExpoExtra();
const IS_PROD = extra.EXPO_PUBLIC_NODE_ENV === 'production';

if (IS_PROD) {
  // Production should have minimal LogBox ignores
  LogBox.ignoreLogs([
    'Setting a timer', // Known RN issue
    'Remote debugger', // Common development warning
  ]);
} else {
  // Development - ignore common warnings that don't affect functionality
  LogBox.ignoreLogs([
    'Setting a timer',
    'Remote debugger',
    'Require cycle', // Common in development
    'VirtualizedLists should never be nested', // Known issue with certain UI patterns
  ]);
}

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Animated, Platform } from 'react-native';

// Direct imports (no lazy loading to avoid complexity)
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// PRODUCTION SAFETY: Gate console.log statements for production
// CRASH FIX: Use typeof check to prevent ReferenceError in production
const devLog = (...args) => (typeof __DEV__ !== 'undefined' && __DEV__) && console.log(...args);
const devWarn = (...args) => (typeof __DEV__ !== 'undefined' && __DEV__) && console.warn(...args);
const devError = (...args) => (typeof __DEV__ !== 'undefined' && __DEV__) && console.error(...args);

// LAZY LOADING: Avoid circular dependency with config/appconfig.js
let appConfig = null;
let statusBarStyleFn = null;

const getAppConfig = () => {
  if (appConfig) return appConfig;
  try {
    const configModule = require('./src/config/appconfig');
    appConfig = configModule.APP_CONFIG || {};
    statusBarStyleFn = configModule.getStatusBarStyle || (() => 'auto');
  } catch (error) {
    devWarn('Failed to load app config:', error.message);
    appConfig = { linking: undefined };
    statusBarStyleFn = () => 'auto';
  }
  return appConfig;
};

const getStatusBarStyle = () => {
  if (!statusBarStyleFn) {
    getAppConfig(); // Initialize if not already done
  }
  return statusBarStyleFn ? statusBarStyleFn() : 'auto';
};

// Safe import of AppInitializer with fallback
let appInitializer = null;
try {
  appInitializer = require('./src/utils/AppInitializer').default;
} catch (error) {
  devError('Failed to import AppInitializer:', error.message);
  // Create fallback initializer
  appInitializer = {
    initialize: async () => {
      devWarn('Using fallback AppInitializer');
      return { success: true, message: 'Fallback initialization' };
    },
    reset: () => {
      devWarn('AppInitializer reset called on fallback');
    },
    setAuthInitializer: () => {
      devWarn('AppInitializer setAuthInitializer called on fallback');
    }
  };
}

// Screen imports - let error boundary catch failures instead of faking screens
import AuthenticatedApp from './src/components/AuthenticatedApp';
import UnauthenticatedApp from './src/components/UnauthenticatedApp';
import UnifiedErrorBoundary from './src/components/UnifiedErrorBoundary';
import { AuthProvider, useAuthState, useAuthDispatch } from './src/contexts/AuthContext';
import { validateEnv } from './src/config/env';
import { initializeCrashReporting, reportError, setUserContext, addBreadcrumb } from './src/utils/crashReporting';

// FIX: Lazy load AppLogger to avoid circular dependency
// App.js → config/appconfig.js → AppLogger.js → App.js (CIRCULAR!)
let logger = null;
const getLogger = () => {
  if (logger) return logger;
  try {
    const mod = require('./src/utils/AppLogger');
    logger = mod?.logger || mod?.default || console;
  } catch (error) {
    devWarn('App.js: AppLogger load failed, using console', error?.message || error);
    logger = console;
  }
  return logger;
};

// Create stable default functions OUTSIDE component
const DEFAULT_AUTH_HANDLERS = {
  initializeAuth: async () => {
    getLogger().warn('Auth not initialized');
    return Promise.resolve();
  },
  handleLoginSuccess: () => getLogger().warn('handleLoginSuccess: Auth not initialized'),
  handleLogout: () => getLogger().warn('handleLogout: Auth not initialized'),
};

// Simplified App component with split auth/main flows
function FashionColorWheelApp() {
  devLog('FashionColorWheelApp: Component rendering started');
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [navigationError, setNavigationError] = useState(null);
  
  // Progressive loading states for better UX
  const [loadingState, setLoadingState] = useState({
    stage: 'initializing', // 'initializing' | 'storage' | 'auth' | 'ready'
    progress: 0, // 0-100
    message: 'Starting app...'
  });
  
  // ANIMATION FIX: Animated value for smooth progress bar
  const progressAnimatedValue = useRef(new Animated.Value(0)).current;
  
  // Initialize animated value with current progress on mount
  useEffect(() => {
    progressAnimatedValue.setValue(loadingState.progress);
    
    // MEMORY LEAK FIX: Stop animations on unmount to prevent memory leaks
    return () => {
      progressAnimatedValue.stopAnimation();
    };
  }, []); // Only run once on mount
  
  // RACE CONDITION FIX: Single atomic state management
  const initializationRef = useRef({
    state: 'pending', // 'pending' | 'initializing' | 'success' | 'error'
    timestamp: Date.now(),
    error: null
  });
  const restartTimersRef = useRef({ restart: null, flag: null }); // Track restart timers
  const isRestartingRef = useRef(false); // Track restart state
  
  // Atomic state transition helper (base implementation)
  const setInitializationState = useCallback((newState, error = null) => {
    const validTransitions = {
      'pending': ['initializing', 'error'],
      'initializing': ['success', 'error'],
      'success': ['pending'], // Only for restart
      'error': ['pending']    // Only for restart
    };
    
    const currentState = initializationRef.current.state;
    if (!validTransitions[currentState]?.includes(newState)) {
      getLogger().warn(`Invalid state transition: ${currentState} -> ${newState}`);
      return false;
    }
    
    initializationRef.current = {
      state: newState,
      timestamp: Date.now(),
      error
    };
    getLogger().debug(`State transition: ${currentState} -> ${newState}`);
    return true;
  }, []);
  
  // RACE CONDITION FIX: Define refs early for use in callbacks
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true); // Track component mount state
  const [isRestarting, setIsRestarting] = useState(false); // Use state instead of ref for UI updates
  
  // SPLIT CONTEXT: Use separate hooks for state and dispatch to prevent unnecessary re-renders
  devLog('FashionColorWheelApp: Calling useAuthState and useAuthDispatch hooks');
  const { user, loading: authLoading, isInitialized, error: authError } = useAuthState();
  const { initializeAuth, handleLoginSuccess, handleLogout } = useAuthDispatch();
  devLog('FashionColorWheelApp: Auth state:', { user: !!user, authLoading, isInitialized });

  // Additional validation: Ensure auth functions are actually functions
  const safeInitializeAuth = typeof initializeAuth === 'function' 
    ? initializeAuth 
    : DEFAULT_AUTH_HANDLERS.initializeAuth;
  
  const safeHandleLoginSuccess = typeof handleLoginSuccess === 'function' 
    ? handleLoginSuccess 
    : DEFAULT_AUTH_HANDLERS.handleLoginSuccess;
    
  const safeHandleLogout = typeof handleLogout === 'function' 
    ? handleLogout 
    : DEFAULT_AUTH_HANDLERS.handleLogout;

  // Track user context for crash reporting
  useEffect(() => {
    if (user) {
      setUserContext(user);
      addBreadcrumb('User logged in', 'auth', 'info', { userId: user.id });
    } else {
      setUserContext(null);
      addBreadcrumb('User logged out', 'auth', 'info');
    }
  }, [user]);

  // PERFORMANCE FIX: Safe setLoadingState to prevent unnecessary re-renders
  const setLoadingStateSafe = useCallback((newState) => {
    setLoadingState(prev => {
      if (prev.stage === newState.stage && 
          prev.progress === newState.progress && 
          prev.message === newState.message) {
        return prev; // No change, no re-render
      }
      
      // ANIMATION FIX: Animate progress bar width smoothly
      if (prev.progress !== newState.progress) {
        Animated.timing(progressAnimatedValue, {
          toValue: newState.progress,
          duration: 300, // Smooth 300ms animation
          useNativeDriver: false, // Width animations require layout driver
        }).start();
      }
      
      return newState;
    });
  }, [progressAnimatedValue]);

  // SAFE WRAPPER: Mount-checked version of setInitializationState
  const safeSetInitializationState = useCallback((newState, error = null) => {
    if (!isMountedRef.current) return false;
    return setInitializationState(newState, error);
  }, [setInitializationState]);

  // NON-BLOCKING INITIALIZATION: Start initialization in background, show UI immediately
  // Note: Empty deps array is intentional - this effect should only run once on mount
  // All functions used are either stable (useCallback) or accessed via refs to avoid stale closures
  useEffect(() => {
    // GUARD: Check if already initializing/initialized to prevent multiple runs
    if (initializationRef.current.state !== 'pending') {
      getLogger().debug('Skipping initialization - already attempted');
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    let finalizationTimerId = null; // Track timer for cleanup

    // BACKGROUND INITIALIZATION: Initialize features without blocking UI
    const initializeInBackground = async () => {
      try {
        // ABORT CHECK: Early exit if already aborted
        if (controller.signal.aborted || !isMounted) {
          getLogger().debug('Initialization aborted before start');
          return;
        }

        // FIX: Atomic check-and-set with proper error handling
        const canProceed = safeSetInitializationState('initializing');
        if (!canProceed) {
          const currentState = initializationRef.current.state;
          getLogger().error(`Cannot initialize from state: ${currentState}`);
          
          // FIX: Set error state instead of silent return
          if (isMounted) {
            const blockingError = new Error(`Initialization blocked - app in ${currentState} state`);
            safeSetInitializationState('error', blockingError);
            setInitError(blockingError);
            setIsReady(false);
          }
          return;
        }
        
        // FIXED: Call environment validation first
        getLogger().debug('Validating environment configuration...');
        const envValidation = validateEnv();
        if (!envValidation.isValid) {
          getLogger().warn('Environment validation warnings:', envValidation.warnings);
          if (envValidation.errors.length > 0) {
            throw new Error(`Environment validation failed: ${envValidation.errors.join(', ')}`);
          }
        } else {
          getLogger().debug('Environment validation passed');
        }
        
        // Initialize crash reporting early
        getLogger().debug('Initializing crash reporting...');
        await initializeCrashReporting();
        addBreadcrumb('App initialization started', 'app', 'info');
        
        // ABORT CHECK: After crash reporting setup
        if (controller.signal.aborted || !isMounted) {
          getLogger().debug('Initialization aborted after crash reporting setup');
          return;
        }
        
        // FIX: Explicit auth initialization with proper error handling
        getLogger().debug('Initializing authentication...');
        setLoadingStateSafe({ stage: 'auth', progress: 15, message: 'Setting up authentication...' });
        
        try {
          await safeInitializeAuth();
          getLogger().info('Auth initialization completed successfully');
          
          // ABORT CHECK: After auth initialization
          if (controller.signal.aborted || !isMounted) {
            getLogger().debug('Initialization aborted after auth setup');
            return;
          }
        } catch (error) {
          getLogger().error('Auth initialization failed:', error);
          
          if (isMounted) {
            const authErrorMsg = error?.message || 'Unknown authentication error';
            const authError = new Error(`Authentication failed: ${authErrorMsg}`);
            authError.cause = error;
            authError.category = 'AuthError';
            
            safeSetInitializationState('error', authError);
            setInitError(authError);
            setIsReady(false);
            
            addBreadcrumb('Auth initialization failed', 'auth', 'error', {
              originalError: authErrorMsg,
              errorType: error?.name || 'Error'
            });
            
            throw authError; // authError is guaranteed to exist now
          }
          
          throw error; // Fallback if not mounted
        }
        
        // CRITICAL FIX: Set auth initializer BEFORE calling initialize() to prevent race condition
        devLog('Setting auth initializer in AppInitializer...');
        appInitializer.setAuthInitializer(safeInitializeAuth);
        
        // Use centralized initialization with progressive loading
        devLog('Starting AppInitializer.initialize...');
        
        // PERFORMANCE FIX: Async environment validation to avoid blocking JS thread
        const runEnvironmentValidation = async () => {
          try {
            devLog('Running async environment validation...');
            
            // Use setTimeout to yield to event loop and prevent blocking
            await new Promise(resolve => setTimeout(resolve, 0));
            
            const basicChecks = {
              hasConstants: !!getExpoConstants(),
              hasAsyncStorage: typeof AsyncStorage !== 'undefined',
              hasNetInfo: typeof NetInfo !== 'undefined',
              platform: Platform.OS,
              memory: typeof performance !== 'undefined' && performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
              } : 'unavailable'
            };
            
            // Yield again after computation
            await new Promise(resolve => setTimeout(resolve, 0));
            
            devLog('Environment validation completed:', basicChecks);
            return basicChecks;
          } catch (envError) {
            devWarn('Environment validation failed:', envError.message);
            return null;
          }
        };
        
        // Run validation asynchronously without blocking
        runEnvironmentValidation().catch(err => {
          devWarn('Environment validation error:', err);
        });
        
        // CORE READY: Treat appInitializer.initialize() as the awaited core-ready gate
        await appInitializer.initialize({
          signal: controller?.signal,
          onProgress: (progress) => {
            if (isMounted) {
              getLogger().info(`Background init: ${progress.step} (${Math.round(progress.progress * 100)}%)`);
              
              // BACKGROUND PROGRESS: Update loading state for background initialization
              const stageMap = {
                'env': { stage: 'background', progress: 20, message: 'Environment ready' },
                'config': { stage: 'background', progress: 40, message: 'Configuration loaded' },
                'storage': { stage: 'background', progress: 60, message: 'Storage connected' },
                'api': { stage: 'background', progress: 80, message: 'Services connected' },
                'auth': { stage: 'background', progress: 95, message: 'Authentication ready' }
              };
              
              const loadingUpdate = stageMap[progress.step] || {
                stage: 'background',
                progress: Math.round(progress.progress * 100),
                message: `${progress.step} ready`
              };
              
              setLoadingStateSafe(loadingUpdate);
            }
          }
        });
        
        getLogger().info('Centralized initialization completed');
        
        // ABORT CHECK: After centralized initialization
        if (controller.signal.aborted || !isMounted) {
          getLogger().debug('Initialization aborted after centralized init');
          return;
        }
        
        // NOTE: Success/isReady state transition is handled by the sequenced initializer
        
      } catch (error) {
        if (!isMounted || controller?.signal?.aborted) return;
        
        console.error('CRITICAL: Centralized initialization failed:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          cause: error.cause
        });
        getLogger().error('Centralized initialization failed:', error);
        
        // SECURITY FIX: Always show error screen for failed initialization
        // Never bypass critical initialization failures as this could lead to:
        // - Storage corruption/data loss
        // - Wrong user data being shown
        // - API calls with invalid tokens
        // - Security vulnerabilities
        if (isMounted) {
          setInitializationState('error', error);
          setInitError(error);
          setIsReady(false);
        }
      } finally {
        // Wrap finally block in try-catch to prevent any cleanup errors
        try {
          // Note: Don't check initError state here as it might not be updated yet
          // The error handling is done in the catch block above
          if (isMounted && !controller?.signal?.aborted) {
            getLogger().debug('Initialization cleanup completed');
          }
        } catch (finallyError) {
          getLogger().error('Error in finally block:', finallyError);
          // Don't let cleanup errors crash the app
        }
      }
    };

    // IMPROVEMENT: Initialization timeout to prevent hanging forever
    const INIT_TIMEOUT_MS = 30000; // 30 seconds
    
    const initWithTimeout = async () => {
      let timeoutId;
      let settled = false;

      const initPromise = initializeInBackground().finally(() => {
        settled = true;
      });

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          // CRASH FIX: Abort the inner promise when timeout fires
          // Without this, initializeInBackground() continues running in background
          controller.abort();
          reject(new Error(`Initialization timed out after ${INIT_TIMEOUT_MS / 1000} seconds. Please check your network connection and try again.`));
        }, INIT_TIMEOUT_MS);
      });

      try {
        return await Promise.race([initPromise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };
    
    // SEQUENCED INITIALIZATION: Wait for background init before showing UI as ready
    const initializeSequentially = async () => {
      try {
        // Start background initialization with timeout protection
        await initWithTimeout();

        // CORE READY: Only transition to success/isReady after core initialization has completed
        if (isMounted && !controller?.signal?.aborted && initializationRef.current.state === 'initializing') {
          const canComplete = setInitializationState('success');
          if (canComplete) {
            setIsReady(true);
            setLoadingStateSafe({
              stage: 'ready',
              progress: 100,
              message: 'All features ready!'
            });
            getLogger().info('App fully initialized and ready');
          } else {
            const currentState = initializationRef.current.state;
            getLogger().error(`Cannot complete initialization from state: ${currentState}`);

            if (isMounted) {
              const completionError = new Error(`Initialization completion blocked - app in ${currentState} state`);
              setInitializationState('error', completionError);
              setInitError(completionError);
              setIsReady(false);
            }
          }
        }
      } catch (error) {
        // Don't override successful initialization
        if (!isMounted || controller?.signal?.aborted || initializationRef.current.state === 'success') {
          return;
        }
        
        // Atomic error state transition
        if (setInitializationState('error', error)) {
          getLogger().error('Initialization error:', error);
          
          // Set error state to show user-friendly error screen
          setInitError(error);
          
          // Keep app in loading state with error message
          if (isMounted) {
            setIsReady(false);
            setLoadingStateSafe({
              stage: 'error',
              progress: 0,
              message: 'Initialization failed'
            });
          }
        }
      }
    };
    
    // SHOW LOADING UI: Show loading state immediately, then initialize
    if (isMounted) {
      setLoadingStateSafe({ 
        stage: 'initializing', 
        progress: 10, 
        message: 'Starting up...' 
      });
    }
    
    // Start initialization sequence
    setTimeout(initializeSequentially, 100);
    
    // COMPREHENSIVE CLEANUP: All timers and resources in one place
    return () => {
      isMounted = false;
      controller.abort();
      
      // Mark component as unmounted to prevent stale timer execution
      isMountedRef.current = false;
      
      // Cancel pending finalization timers/animation frames
      if (finalizationTimerId !== null) {
        if (typeof cancelAnimationFrame !== 'undefined') {
          cancelAnimationFrame(finalizationTimerId);
        } else {
          clearTimeout(finalizationTimerId);
        }
        finalizationTimerId = null;
      }
      
      // Clear any pending restart timers
      if (restartTimersRef.current.restart) {
        clearTimeout(restartTimersRef.current.restart);
        restartTimersRef.current.restart = null;
      }
      if (restartTimersRef.current.flag) {
        clearTimeout(restartTimersRef.current.flag);
        restartTimersRef.current.flag = null;
      }
    };
  }, []); // Empty deps intentional - runs once on mount, uses refs for stable access

  // Note: Auth state validation already handled above with early return
  // No need for duplicate isValidAuthState check here

  // Note: Refs moved to top of component for proper order
  
  // NAVIGATION ERROR RECOVERY: Handle navigation failures with recovery options
  const handleNavigationError = useCallback((error) => {
    getLogger().error('Navigation error:', error);
    
    // Create detailed navigation error with context
    const navError = new Error(`Navigation failed: ${error.message}`);
    navError.cause = error;
    navError.category = 'NavigationError';
    navError.timestamp = new Date().toISOString();
    
    // Add breadcrumb for debugging
    addBreadcrumb('Navigation error occurred', 'navigation', 'error', {
      errorMessage: error.message,
      errorType: error.name,
      stack: error.stack
    });
    
    // Report to crash reporting
    reportError(navError, {
      category: 'NavigationError',
      context: 'NavigationContainer onError',
      timestamp: navError.timestamp
    });
    
    // Set navigation error state for UI recovery
    setNavigationError(navError);
    
    getLogger().warn('Navigation error detected - recovery options available');
  }, []);

  // NAVIGATION RECOVERY: Clear navigation error and attempt recovery
  const handleNavigationRecovery = useCallback(() => {
    getLogger().info('Attempting navigation recovery...');
    
    // Clear navigation error state
    setNavigationError(null);
    
    // Add breadcrumb for recovery attempt
    addBreadcrumb('Navigation recovery attempted', 'navigation', 'info');
    
    // Force a navigation reset by restarting the app if needed
    // The NavigationContainer will reinitialize with clean state
  }, []);

  // IMPROVEMENT: Simplified priority-based restart methods
  const RESTART_METHODS = useMemo(() => [
    { 
      name: 'expo-updates', 
      available: () => !!global.Updates?.reloadAsync,
      execute: () => global.Updates.reloadAsync()
    },
    { 
      name: 'dev-settings', 
      available: () => !!global.DevSettings?.reload,
      execute: () => { global.DevSettings.reload(); return Promise.resolve(); }
    },
    { 
      name: 'web-reload', 
      available: () => typeof window !== 'undefined' && !!window.location?.reload,
      execute: () => { window.location.reload(); return Promise.resolve(); }
    },
  ], []);

  // IMPROVEMENT: State reset as fallback when no platform restart available
  const performStateReset = useCallback(() => {
    getLogger().warn('No platform restart available, performing state reset...');
    
    setInitializationState('pending');
    progressAnimatedValue.setValue(0);
    setInitError(null);
    setIsReady(false);
    setLoadingStateSafe({ stage: 'initializing', progress: 0, message: 'Restarting...' });
    
    if (appInitializer?.reset) appInitializer.reset();
    
    restartTimersRef.current.restart = setTimeout(() => {
      restartTimersRef.current.restart = null;
      if (appInitializer?.initialize && initializationRef.current.state === 'pending') {
        appInitializer.initialize().catch((error) => {
          getLogger().error('Restart initialization failed:', error);
          setInitializationState('error', error);
          setInitError(error);
        });
      }
    }, 100);
  }, [setInitializationState, setLoadingStateSafe, progressAnimatedValue]);

  const handleRestart = useCallback(async () => {
    // Debounce protection
    const now = Date.now();
    const RESTART_DEBOUNCE_MS = 3000;
    
    if (isProcessingRef.current) {
      getLogger().warn('Restart already in progress');
      return;
    }
    
    if (restartTimersRef.current.lastAttempt && 
        (now - restartTimersRef.current.lastAttempt) < RESTART_DEBOUNCE_MS) {
      getLogger().warn('Restart attempted too quickly');
      return;
    }
    restartTimersRef.current.lastAttempt = now;
    isProcessingRef.current = true;
    setIsRestarting(true);
    getLogger().info('User requested app restart');
    
    try {
      // SIMPLIFIED: Try each restart method in priority order
      for (const method of RESTART_METHODS) {
        if (method.available()) {
          try {
            getLogger().info(`Attempting restart via ${method.name}...`);
            await method.execute();
            return; // Success - method will reload the app
          } catch (error) {
            getLogger().warn(`${method.name} restart failed:`, error.message);
          }
        }
      }
      
      // Fallback: State reset if no platform restart worked
      performStateReset();
      
    } catch (error) {
      getLogger().error('Restart failed:', error);
      setInitError(new Error(`Restart failed: ${error.message}`));
    } finally {
      // Reset processing flag after delay
      if (restartTimersRef.current.flag) {
        clearTimeout(restartTimersRef.current.flag);
      }
      restartTimersRef.current.flag = setTimeout(() => {
        if (isMountedRef.current) {
          restartTimersRef.current.flag = null;
          isProcessingRef.current = false;
          setIsRestarting(false);
        }
      }, 2000);
    }
  }, [RESTART_METHODS, performStateReset]); // Simplified dependencies

  // RULES OF HOOKS FIX: Move nested useMemo to top level
  const loadingCalculation = useMemo(() => {
    // Capture all values atomically to prevent races
    const currentIsReady = isReady;
    const currentAuthLoading = authLoading;
    const currentIsInitialized = isInitialized;
    
    const isAppLoading = !currentIsReady;
    const isAuthSystemLoading = currentIsReady && (currentAuthLoading || !currentIsInitialized);
    
    return {
      shouldShowLoading: isAppLoading || isAuthSystemLoading,
      isAppLoading,
      isAuthSystemLoading
    };
  }, [isReady, authLoading, isInitialized]);

  // PERFORMANCE FIX: Memoize render content to prevent recreation on every render
  const renderContent = useMemo(() => {
    // NAVIGATION ERROR SCREEN: Show navigation error recovery options
    if (navigationError) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={styles.errorText}>Navigation Error</Text>
          <Text style={styles.errorSubtext}>
            The app's navigation system encountered an error. This could be due to:
          </Text>
          <View style={styles.errorDetailsList}>
            <Text style={styles.errorDetail}>• Invalid deep link or URL</Text>
            <Text style={styles.errorDetail}>• Missing or corrupted screen</Text>
            <Text style={styles.errorDetail}>• Navigation state corruption</Text>
            <Text style={styles.errorDetail}>• Screen component crash</Text>
          </View>
          <Text style={styles.errorSubtext}>
            Error: {navigationError.message}
          </Text>
          
          <TouchableOpacity
            style={styles.restartButton}
            onPress={handleNavigationRecovery}
          >
            <Text style={styles.restartButtonText}>Reset Navigation</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.restartButton, { backgroundColor: '#e74c3c', marginTop: 10 }]}
            onPress={handleRestart}
            disabled={isRestarting}
          >
            <Text style={styles.restartButtonText}>
              {isRestarting ? 'Restarting...' : 'Restart App'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    // Show error screen if initialization failed
    if (initError) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={styles.errorText}>Initialization Failed</Text>
          <Text style={styles.errorSubtext}>
            Critical app components failed to initialize properly. This could be due to:
          </Text>
          <View style={styles.errorDetailsList}>
            <Text style={styles.errorDetail}>• Network connectivity issues</Text>
            <Text style={styles.errorDetail}>• Storage system problems</Text>
            <Text style={styles.errorDetail}>• Authentication service unavailable</Text>
            <Text style={styles.errorDetail}>• Device storage full</Text>
          </View>
          <Text style={styles.errorSubtext}>
            For your security and data integrity, the app cannot continue without proper initialization.
          </Text>
          <TouchableOpacity
            style={styles.restartButton}
            onPress={handleRestart}
            disabled={isRestarting}
          >
            <Text style={styles.restartButtonText}>
              {isRestarting ? 'Restarting...' : 'Try Again'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.restartButton, { backgroundColor: '#3498db', marginTop: 10 }]}
            onPress={async () => {
              try {
                devLog('Running basic system check...');
                
                // FIXED: Replaced require() with basic system validation
                const systemCheck = {
                  timestamp: new Date().toISOString(),
                  memoryUsage: typeof performance !== 'undefined' ? performance.memory : 'unavailable',
                  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unavailable',
                  platform: typeof Platform !== 'undefined' ? Platform.OS : 'unknown',
                  constants: getExpoConstants() ? 'available' : 'missing'
                };
                
                const hasIssues = systemCheck.constants === 'missing';
                
                Alert.alert(
                  'System Check Results',
                  hasIssues 
                    ? 'Some system components may be unavailable. Try restarting the app.'
                    : 'Basic system check passed. If issues persist, try restarting the app.',
                  [{ text: 'OK' }]
                );
              } catch (error) {
                Alert.alert('System Check Error', `Could not run system check: ${error.message}`);
              }
            }}
          >
            <Text style={styles.restartButtonText}>Run Diagnostics</Text>
          </TouchableOpacity>
          {/* CRASH FIX #3: REMOVED dangerous 'Continue Offline' bypass
             * This button previously allowed bypassing ALL initialization including:
             * - Authentication validation
             * - Storage integrity checks  
             * - Security token validation
             * - API credential verification
             * 
             * This could lead to:
             * - Viewing wrong user's data (token corruption)
             * - API calls with invalid credentials
             * - Storage state corruption
             * - Security vulnerabilities
             * 
             * If offline mode is truly needed, implement a proper read-only
             * cached data mode with explicit user data isolation.
             */}
        </SafeAreaView>
      );
    }
    
    // Use top-level loadingCalculation (no nested useMemo)
    const shouldShowLoading = loadingCalculation.shouldShowLoading;
    
    if (shouldShowLoading) {
      // FIXED: Consolidated progress calculation to prevent off-by-one errors
      const getLoadingProgress = () => {
        if (!isReady) {
          return {
            progress: loadingState.progress,
            message: loadingState.message,
            stage: loadingState.stage,
          };
        }
        
        if (authLoading) {
          return {
            progress: 85,
            message: 'Signing you in...',
            stage: 'auth',
          };
        }
        
        if (!isInitialized) {
          return {
            progress: 95,
            message: 'Finalizing setup...',
            stage: 'finalizing',
          };
        }
        
        return {
          progress: 100,
          message: 'Ready!',
          stage: 'ready',
        };
      };

      // Use it once to prevent inconsistencies
      const loadingInfo = getLoadingProgress();

      return (
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Fashion Color Wheel</Text>
          
          {/* Progressive loading progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  {
                    width: progressAnimatedValue.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp'
                    })
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {loadingInfo.message} ({loadingInfo.progress}%)
            </Text>
            <Text style={styles.stageText}>
              Stage: {loadingInfo.stage}
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    // Now we KNOW both app and auth are initialized
    // Split auth flow - prevents unnecessary re-renders
    
    // CRASH FIX #4: Validate user object has required properties before passing to AuthenticatedApp
    // This prevents crashes if user object is malformed (e.g., {} or missing id)
    const isValidUser = user && typeof user === 'object' && user.id;
    
    if (!isValidUser) {
      // User is null, undefined, or missing required properties - show login
      if (user && !user.id) {
        // User object exists but is malformed - log warning for debugging
        getLogger().warn('User object missing required properties:', { 
          hasUser: !!user, 
          hasId: !!user?.id,
          userKeys: user ? Object.keys(user) : []
        });
      }
      return <UnauthenticatedApp handleLoginSuccess={safeHandleLoginSuccess} />;
    }

    // Main authenticated app - user is validated
    return <AuthenticatedApp user={user} handleLogout={safeHandleLogout} />;
  }, [
    initError,
    navigationError,    // NEW: Navigation error state
    loadingState,
    user,
    handleRestart,
    handleNavigationRecovery, // NEW: Navigation recovery handler
    safeHandleLoginSuccess,
    safeHandleLogout,
    // MISSING DEPENDENCIES FIXED:
    isRestarting,       // Used in error screen restart button
    loadingCalculation, // Used for shouldShowLoading
    // REMOVED: styles - created via StyleSheet.create() outside component, always stable
  ]);


  // Top-level wrapper with comprehensive error boundaries
  devLog('FashionColorWheelApp: Rendering final UI, isReady:', isReady, 'user:', !!user, 'initError:', !!initError);
  return (
    // Single comprehensive error boundary
    <UnifiedErrorBoundary 
      onError={(error, errorInfo, category) => {
        // Categorize and handle based on error type
        getLogger().error(`${category} Error:`, error);
        
        // ADDED: Report to crash reporting
        reportError(error, {
          category,
          componentStack: errorInfo?.componentStack,
          errorBoundary: 'UnifiedErrorBoundary',
          timestamp: new Date().toISOString(),
        });
        
        addBreadcrumb(`Error boundary caught ${category} error`, 'error', 'error', {
          errorMessage: error.message,
          category,
        });
        
        // Set error state to show UI instead of just logging
        setInitError(new Error(`${category}: ${error.message}`));
        
        if (category === 'StorageError') {
          getLogger().warn('Storage error detected, may need to clear cache');
        } else if (category === 'NavigationError') {
          getLogger().warn('Navigation error detected, triggering navigation recovery');
          // Set navigation error state to show recovery UI
          setNavigationError(error);
        } else if (category === 'ConfigError') {
          getLogger().error('Configuration error detected - critical failure');
          // Config errors are critical - force initialization error state
          setInitError(new Error(`Configuration Error: ${error.message}`));
        } else {
          getLogger().error('Generic error, full crash recovery needed');
        }
      }}
      onRestart={() => {
        // Custom restart logic if needed
        getLogger().info('App restart requested by error boundary');
        // Could use Updates.reloadAsync() here
      }}
    >
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.fullScreen}>
          <StatusBar style={getStatusBarStyle()} />
          <NavigationContainer 
            linking={getAppConfig().linking}
            fallback={
              <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e74c3c" />
                <Text style={styles.loadingText}>Loading navigation...</Text>
              </SafeAreaView>
            }
            onError={handleNavigationError}
            // Conditionally add prop only in debug mode
            {...((typeof __DEV__ !== 'undefined' && __DEV__) ? { onStateChange: (state) => getLogger().debug('Nav state:', state) } : {})}
          >
            {renderContent}
          </NavigationContainer>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </UnifiedErrorBoundary>
  );
}

// Consolidated styles
const styles = StyleSheet.create({
  // Base styles
  fullScreen: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  
  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  
  // Progressive loading styles
  progressContainer: {
    width: '80%',
    alignItems: 'center',
    marginTop: 20,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e74c3c',
    borderRadius: 4,
    // Note: React Native doesn't support CSS transitions
    // Use Animated API for animations if needed
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  stageText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  
  // Error styles
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#c0392b', // 4.64:1 contrast - PASSES WCAG AA
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#555', // Improved contrast from #666 to #555 for better readability
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  errorDetailsList: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
    marginBottom: 8,
    paddingLeft: 10,
  },
  restartButton: {
    backgroundColor: '#c0392b', // Match error text color for consistency
    paddingHorizontal: 30,
    paddingVertical: 16, // 48px+ total height - PASSES WCAG AA touch target
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minHeight: 48, // Ensure minimum 48px touch target
  },
  restartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // Auth styles
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  switchAuth: {
    fontSize: 16,
    color: '#e74c3c',
    marginTop: 20,
  },
});


// CONTEXT WRAPPER: Wrap the main app with AuthProvider for split context pattern
function App() {
  return (
    <AuthProvider>
      <FashionColorWheelApp />
    </AuthProvider>
  );
}

// Main app export with AuthProvider wrapper
export default App;
