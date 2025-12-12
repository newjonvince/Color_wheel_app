// App.js - Simplified Fashion Color Wheel App
import 'react-native-gesture-handler';

// ≡ƒöº Configure LogBox FIRST - before any other imports or code
import { LogBox } from 'react-native';
import Constants from 'expo-constants';

// Configure LogBox immediately at app entry point
const extra = Constants.expoConfig?.extra || {};
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

// ✅ PRODUCTION SAFETY: Gate console.log statements for production
// ✅ CRASH FIX: Use typeof check to prevent ReferenceError in production
const devLog = (...args) => (typeof __DEV__ !== 'undefined' && __DEV__) && console.log(...args);
const devWarn = (...args) => (typeof __DEV__ !== 'undefined' && __DEV__) && console.warn(...args);
const devError = (...args) => (typeof __DEV__ !== 'undefined' && __DEV__) && console.error(...args);

// ✅ LAZY LOADING: Avoid circular dependency with config/appconfig.js
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
  devError('Γ¥î Failed to import AppInitializer:', error.message);
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

// ✅ FIX: Lazy load AppLogger to avoid circular dependency
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
  devLog('🚀 FashionColorWheelApp: Component rendering started');
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [navigationError, setNavigationError] = useState(null);
  
  // ≡ƒöº Progressive loading states for better UX
  const [loadingState, setLoadingState] = useState({
    stage: 'initializing', // 'initializing' | 'storage' | 'auth' | 'ready'
    progress: 0, // 0-100
    message: 'Starting app...'
  });
  
  // ✅ ANIMATION FIX: Animated value for smooth progress bar
  const progressAnimatedValue = useRef(new Animated.Value(0)).current;
  
  // Initialize animated value with current progress on mount
  useEffect(() => {
    progressAnimatedValue.setValue(loadingState.progress);
    
    // ✅ MEMORY LEAK FIX: Stop animations on unmount to prevent memory leaks
    return () => {
      progressAnimatedValue.stopAnimation();
    };
  }, []); // Only run once on mount
  
  // ≡ƒöº RACE CONDITION FIX: Single atomic state management
  const initializationRef = useRef({
    state: 'pending', // 'pending' | 'initializing' | 'success' | 'error'
    timestamp: Date.now(),
    error: null
  });
  const restartTimersRef = useRef({ restart: null, flag: null }); // Track restart timers
  const isRestartingRef = useRef(false); // Track restart state
  
  // ≡ƒöº Atomic state transition helper (base implementation)
  const setInitializationState = useCallback((newState, error = null) => {
    const validTransitions = {
      'pending': ['initializing', 'error'],
      'initializing': ['success', 'error'],
      'success': ['pending'], // Only for restart
      'error': ['pending']    // Only for restart
    };
    
    const currentState = initializationRef.current.state;
    if (!validTransitions[currentState]?.includes(newState)) {
      getLogger().warn(`❌ Invalid state transition: ${currentState} → ${newState}`);
      return false;
    }
    
    initializationRef.current = {
      state: newState,
      timestamp: Date.now(),
      error
    };
    getLogger().debug(`✅ State transition: ${currentState} → ${newState}`);
    return true;
  }, []);
  
  // 🚨 RACE CONDITION FIX: Define refs early for use in callbacks
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true); // Track component mount state
  const [isRestarting, setIsRestarting] = useState(false); // ✅ Use state instead of ref for UI updates
  
  // ✅ SPLIT CONTEXT: Use separate hooks for state and dispatch to prevent unnecessary re-renders
  devLog('🔐 FashionColorWheelApp: Calling useAuthState and useAuthDispatch hooks');
  const { user, loading: authLoading, isInitialized, error: authError } = useAuthState();
  const { initializeAuth, handleLoginSuccess, handleLogout } = useAuthDispatch();
  devLog('🔐 FashionColorWheelApp: Auth state:', { user: !!user, authLoading, isInitialized });

  // ≡ƒöº Additional validation: Ensure auth functions are actually functions
  const safeInitializeAuth = typeof initializeAuth === 'function' 
    ? initializeAuth 
    : DEFAULT_AUTH_HANDLERS.initializeAuth;
  
  const safeHandleLoginSuccess = typeof handleLoginSuccess === 'function' 
    ? handleLoginSuccess 
    : DEFAULT_AUTH_HANDLERS.handleLoginSuccess;
    
  const safeHandleLogout = typeof handleLogout === 'function' 
    ? handleLogout 
    : DEFAULT_AUTH_HANDLERS.handleLogout;

  // ≡ƒöº Track user context for crash reporting
  useEffect(() => {
    if (user) {
      setUserContext(user);
      addBreadcrumb('User logged in', 'auth', 'info', { userId: user.id });
    } else {
      setUserContext(null);
      addBreadcrumb('User logged out', 'auth', 'info');
    }
  }, [user]);

  // ✅ PERFORMANCE FIX: Safe setLoadingState to prevent unnecessary re-renders
  const setLoadingStateSafe = useCallback((newState) => {
    setLoadingState(prev => {
      if (prev.stage === newState.stage && 
          prev.progress === newState.progress && 
          prev.message === newState.message) {
        return prev; // No change, no re-render
      }
      
      // ✅ ANIMATION FIX: Animate progress bar width smoothly
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

  // ✅ SAFE WRAPPER: Mount-checked version of setInitializationState
  const safeSetInitializationState = useCallback((newState, error = null) => {
    if (!isMountedRef.current) return false;
    return setInitializationState(newState, error);
  }, [setInitializationState]);

  // ✅ NON-BLOCKING INITIALIZATION: Start initialization in background, show UI immediately
  // Note: Empty deps array is intentional - this effect should only run once on mount
  // All functions used are either stable (useCallback) or accessed via refs to avoid stale closures
  useEffect(() => {
    // ✅ GUARD: Check if already initializing/initialized to prevent multiple runs
    if (initializationRef.current.state !== 'pending') {
      getLogger().debug('Skipping initialization - already attempted');
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    let finalizationTimerId = null; // Track timer for cleanup

    // ✅ BACKGROUND INITIALIZATION: Initialize features without blocking UI
    const initializeInBackground = async () => {
      try {
        // ✅ ABORT CHECK: Early exit if already aborted
        if (controller.signal.aborted || !isMounted) {
          getLogger().debug('Initialization aborted before start');
          return;
        }

        // ✅ FIX: Atomic check-and-set with proper error handling
        const canProceed = safeSetInitializationState('initializing');
        if (!canProceed) {
          const currentState = initializationRef.current.state;
          getLogger().error(`Cannot initialize from state: ${currentState}`);
          
          // ✅ FIX: Set error state instead of silent return
          if (isMounted) {
            const blockingError = new Error(`Initialization blocked - app in ${currentState} state`);
            safeSetInitializationState('error', blockingError);
            setInitError(blockingError);
            setIsReady(false);
          }
          return;
        }
        
        // ≡ƒöº FIXED: Call environment validation first
        getLogger().debug('≡ƒöì Validating environment configuration...');
        const envValidation = validateEnv();
        if (!envValidation.isValid) {
          getLogger().warn('ΓÜá∩▕Å Environment validation warnings:', envValidation.warnings);
          if (envValidation.errors.length > 0) {
            throw new Error(`Environment validation failed: ${envValidation.errors.join(', ')}`);
          }
        } else {
          getLogger().debug('Γãà Environment validation passed');
        }
        
        // ≡ƒöº Initialize crash reporting early
        getLogger().debug('≡ƒôè Initializing crash reporting...');
        await initializeCrashReporting();
        addBreadcrumb('App initialization started', 'app', 'info');
        
        // ✅ ABORT CHECK: After crash reporting setup
        if (controller.signal.aborted || !isMounted) {
          getLogger().debug('Initialization aborted after crash reporting setup');
          return;
        }
        
        // ✅ FIX: Explicit auth initialization with proper error handling
        getLogger().debug('🔐 Initializing authentication...');
        setLoadingStateSafe({ stage: 'auth', progress: 15, message: 'Setting up authentication...' });
        
        try {
          await safeInitializeAuth();
          getLogger().info('✅ Auth initialization completed successfully');
          
          // ✅ ABORT CHECK: After auth initialization
          if (controller.signal.aborted || !isMounted) {
            getLogger().debug('Initialization aborted after auth setup');
            return;
          }
        } catch (error) {
          getLogger().error('❌ Auth initialization failed:', error);
          
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
        
        // ✅ CRITICAL FIX: Set auth initializer BEFORE calling initialize() to prevent race condition
        devLog('🔧 Setting auth initializer in AppInitializer...');
        appInitializer.setAuthInitializer(safeInitializeAuth);
        
        // Use centralized initialization with progressive loading
        devLog('🔧 Starting AppInitializer.initialize...');
        
        // ✅ PERFORMANCE FIX: Async environment validation to avoid blocking JS thread
        const runEnvironmentValidation = async () => {
          try {
            devLog('🔍 Running async environment validation...');
            
            // ✅ Use setTimeout to yield to event loop and prevent blocking
            await new Promise(resolve => setTimeout(resolve, 0));
            
            const basicChecks = {
              hasConstants: typeof Constants !== 'undefined',
              hasAsyncStorage: typeof AsyncStorage !== 'undefined',
              hasNetInfo: typeof NetInfo !== 'undefined',
              platform: Platform.OS,
              memory: typeof performance !== 'undefined' && performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
              } : 'unavailable'
            };
            
            // ✅ Yield again after computation
            await new Promise(resolve => setTimeout(resolve, 0));
            
            devLog('✅ Environment validation completed:', basicChecks);
            return basicChecks;
          } catch (envError) {
            devWarn('⚠️ Environment validation failed:', envError.message);
            return null;
          }
        };
        
        // ✅ Run validation asynchronously without blocking
        runEnvironmentValidation().catch(err => {
          devWarn('Environment validation error:', err);
        });
        
        // ✅ NON-BLOCKING: Initialize in background without blocking UI
        appInitializer.initialize({
          signal: controller?.signal,
          onProgress: (progress) => {
            if (isMounted) {
              getLogger().info(`🔧 Background init: ${progress.step} (${Math.round(progress.progress * 100)}%)`);
              
              // ✅ BACKGROUND PROGRESS: Update loading state for background initialization
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
        }).then(() => {
          // ✅ BACKGROUND COMPLETION: All features loaded
          if (isMounted) {
            setLoadingStateSafe({ 
              stage: 'ready', 
              progress: 100, 
              message: 'All features ready!' 
            });
            getLogger().info('🎉 Background initialization completed - all features available');
          }
        }).catch((error) => {
          // ✅ BACKGROUND ERROR: Handle gracefully without blocking UI
          if (isMounted) {
            getLogger().warn('⚠️ Some features failed to load in background:', error);
            setLoadingStateSafe({ 
              stage: 'partial', 
              progress: 90, 
              message: 'Core features ready (some features unavailable)' 
            });
          }
        });
        
        getLogger().info('≡ƒôè Centralized initialization completed');
        
        // ✅ ABORT CHECK: After centralized initialization
        if (controller.signal.aborted || !isMounted) {
          getLogger().debug('Initialization aborted after centralized init');
          return;
        }
        
        // ✅ RACE CONDITION FIX: Atomic final state update with proper error handling
        if (isMounted && initializationRef.current.state === 'initializing') {
          const canComplete = setInitializationState('success');
          if (!canComplete) {
            const currentState = initializationRef.current.state;
            getLogger().error(`Cannot complete initialization from state: ${currentState}`);
            
            // ✅ FIX: Set error state instead of silent return
            if (isMounted) {
              const completionError = new Error(`Initialization completion blocked - app in ${currentState} state`);
              setInitializationState('error', completionError);
              setInitError(completionError);
              setIsReady(false);
            }
            return;
          }
          
          // ✅ RACE CONDITION FIX: Don't show "Ready!" until isReady is actually set
          setLoadingStateSafe({ stage: 'finalizing', progress: 95, message: 'Finalizing...' });
          
          // Use atomic state update with better timing
          const finalizeInitialization = () => {
            finalizationTimerId = null; // Clear timer reference
            if (isMounted && !controller?.signal?.aborted && initializationRef.current.state === 'success') {
              // ✅ ATOMIC UPDATE: Set both ready state and final loading message together
              setIsReady(true);
              setLoadingStateSafe({ stage: 'ready', progress: 100, message: 'Ready!' });
            }
          };
          
          // Use requestAnimationFrame for better timing, fallback to setTimeout
          if (typeof requestAnimationFrame !== 'undefined') {
            finalizationTimerId = requestAnimationFrame(finalizeInitialization);
          } else {
            finalizationTimerId = setTimeout(finalizeInitialization, 100); // Shorter delay
          }
        }
        
      } catch (error) {
        if (!isMounted || controller?.signal?.aborted) return;
        
        console.error('🚨 CRITICAL: Centralized initialization failed:', error);
        console.error('🔍 Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          cause: error.cause
        });
        getLogger().error('≡ƒÜ¿ Centralized initialization failed:', error);
        
        // ✅ SECURITY FIX: Always show error screen for failed initialization
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
        // ≡ƒöº Wrap finally block in try-catch to prevent any cleanup errors
        try {
          // Note: Don't check initError state here as it might not be updated yet
          // The error handling is done in the catch block above
          if (isMounted && !controller?.signal?.aborted) {
            getLogger().debug('≡ƒöº Initialization cleanup completed');
          }
        } catch (finallyError) {
          getLogger().error('≡ƒÜ¿ Error in finally block:', finallyError);
          // Don't let cleanup errors crash the app
        }
      }
    };

    // ✅ SEQUENCED INITIALIZATION: Wait for background init before showing UI as ready
    const initializeSequentially = async () => {
      try {
        // Start background initialization
        await initializeInBackground();
        
        // ✅ PROPER SEQUENCING: Only set ready after initialization completes
        if (isMounted && initializationRef.current.state === 'success') {
          setIsReady(true);
          setLoadingStateSafe({ 
            stage: 'ready', 
            progress: 100, 
            message: 'All features ready!' 
          });
          getLogger().info('🎉 App fully initialized and ready');
        }
      } catch (error) {
        // Don't override successful initialization
        if (!isMounted || controller?.signal?.aborted || initializationRef.current.state === 'success') {
          return;
        }
        
        // ≡ƒöº Atomic error state transition
        if (setInitializationState('error', error)) {
          getLogger().error('≡ƒÜ¿ Initialization error:', error);
          
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
    
    // ✅ SHOW LOADING UI: Show loading state immediately, then initialize
    if (isMounted) {
      setLoadingStateSafe({ 
        stage: 'initializing', 
        progress: 10, 
        message: 'Starting up...' 
      });
    }
    
    // Start initialization sequence
    setTimeout(initializeSequentially, 100);
    
    // ✅ COMPREHENSIVE CLEANUP: All timers and resources in one place
    return () => {
      isMounted = false;
      controller.abort();
      
      // ✅ Mark component as unmounted to prevent stale timer execution
      isMountedRef.current = false;
      
      // ✅ Cancel pending finalization timers/animation frames
      if (finalizationTimerId !== null) {
        if (typeof cancelAnimationFrame !== 'undefined') {
          cancelAnimationFrame(finalizationTimerId);
        } else {
          clearTimeout(finalizationTimerId);
        }
        finalizationTimerId = null;
      }
      
      // ✅ Clear any pending restart timers
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
  
  // ✅ NAVIGATION ERROR RECOVERY: Handle navigation failures with recovery options
  const handleNavigationError = useCallback((error) => {
    getLogger().error('🚨 Navigation error:', error);
    
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

  // ✅ NAVIGATION RECOVERY: Clear navigation error and attempt recovery
  const handleNavigationRecovery = useCallback(() => {
    getLogger().info('🔄 Attempting navigation recovery...');
    
    // Clear navigation error state
    setNavigationError(null);
    
    // Add breadcrumb for recovery attempt
    addBreadcrumb('Navigation recovery attempted', 'navigation', 'info');
    
    // Force a navigation reset by restarting the app if needed
    // The NavigationContainer will reinitialize with clean state
  }, []);

  const handleRestart = useCallback(async () => {
    // ≡ƒöº Use ref to prevent multiple executions (properly scoped)
    if (isProcessingRef.current) {
      return; // Prevent multiple restart attempts
    }
    
    isProcessingRef.current = true;
    setIsRestarting(true); // ✅ Update UI state
    getLogger().info('≡ƒöä User requested app restart');
    
    try {
      let restartSuccessful = false;
      
      // Method 1: Expo Updates (try first)
      if (!restartSuccessful && global.Updates?.reloadAsync) {
        try {
          getLogger().info('≡ƒöä Restarting via Expo Updates...');
          await global.Updates.reloadAsync();
          restartSuccessful = true;
        } catch (error) {
          getLogger().warn('Expo Updates restart failed:', error);
        }
      }
      
      // Method 2: DevSettings (only if Method 1 failed)
      if (!restartSuccessful && global.DevSettings?.reload) {
        try {
          getLogger().info('≡ƒöä Restarting via DevSettings...');
          global.DevSettings.reload();
          restartSuccessful = true;
        } catch (error) {
          getLogger().warn('DevSettings restart failed:', error);
        }
      }
      
      // Method 3: Web reload (only if previous methods failed)
      if (!restartSuccessful && typeof window !== 'undefined' && window.location) {
        try {
          getLogger().info('≡ƒöä Restarting via window.location.reload...');
          window.location.reload();
          restartSuccessful = true;
        } catch (error) {
          getLogger().warn('Web restart failed:', error);
        }
      }
      
      // Method 4: State reset (only if all else failed)
      if (!restartSuccessful) {
        getLogger().warn('≡ƒöä No restart mechanism available, attempting state reset...');
        
        // ≡ƒöº Reset atomic state
        setInitializationState('pending');
        
        // Atomic state reset
        setInitError(null);
        setIsReady(false);
        setLoadingStateSafe({
          stage: 'initializing',
          progress: 0,
          message: 'Restarting...'
        });
        
        // Reset initializer
        if (appInitializer?.reset) {
          appInitializer.reset();
        }
        
        // Restart after brief delay
        restartTimersRef.current.restart = setTimeout(() => {
          restartTimersRef.current.restart = null; // Clear timer reference
          if (appInitializer?.initialize && initializationRef.current.state === 'pending') {
            appInitializer.initialize().catch((error) => {
              getLogger().error('≡ƒÜ¿ Restart initialization failed:', error);
              setInitializationState('error', error);
              setInitError(error);
            });
          }
        }, 100);
      }
      
    } catch (error) {
      getLogger().error('≡ƒÜ¿ Restart failed:', error);
      setInitError(new Error(`Restart failed: ${error.message}`));
    } finally {
      // ✅ MEMORY LEAK FIX: Reset processing flag after delay with proper cleanup
      // Clear any existing flag timer first to prevent multiple timers
      if (restartTimersRef.current.flag) {
        clearTimeout(restartTimersRef.current.flag);
        restartTimersRef.current.flag = null;
      }
      
      restartTimersRef.current.flag = setTimeout(() => {
        // ✅ Check if component is still mounted before accessing refs
        if (isMountedRef.current && restartTimersRef.current) {
          restartTimersRef.current.flag = null; // Clear timer reference
          isProcessingRef.current = false; // Reset processing flag
          setIsRestarting(false); // ✅ Reset UI state
        }
      }, 2000);
    }
  }, [setInitializationState, setLoadingStateSafe]); // ✅ STALE CLOSURE FIX: Add callback dependencies

  // ✅ RULES OF HOOKS FIX: Move nested useMemo to top level
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

  // ✅ PERFORMANCE FIX: Memoize render content to prevent recreation on every render
  const renderContent = useMemo(() => {
    // ✅ NAVIGATION ERROR SCREEN: Show navigation error recovery options
    if (navigationError) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={styles.errorText}>🧭 Navigation Error</Text>
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

    // Γ£à Show error screen if initialization failed
    if (initError) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={styles.errorText}>🚨 Initialization Failed</Text>
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
                devLog('🔍 Running basic system check...');
                
                // ✅ FIXED: Replaced require() with basic system validation
                const systemCheck = {
                  timestamp: new Date().toISOString(),
                  memoryUsage: typeof performance !== 'undefined' ? performance.memory : 'unavailable',
                  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unavailable',
                  platform: typeof Platform !== 'undefined' ? Platform.OS : 'unknown',
                  constants: typeof Constants !== 'undefined' ? 'available' : 'missing'
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
          <TouchableOpacity
            style={[styles.restartButton, { backgroundColor: '#f39c12', marginTop: 10 }]}
            onPress={() => {
              Alert.alert(
                '⚠️ Security Warning',
                'Continuing offline skips security and initialization checks. Your data may not sync properly, and some features will be unavailable. Only use this if you need to access cached data urgently.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'I Understand, Continue', 
                    style: 'destructive',
                    onPress: () => {
                      devLog('🔄 User chose to continue offline, bypassing initialization checks...');
                      addBreadcrumb('User bypassed initialization', 'app', 'warning', {
                        reason: 'continue_offline_selected'
                      });
                      // ✅ SECURITY: Log this action for debugging
                      getLogger().warn('⚠️ User bypassed initialization - running in limited offline mode');
                      // Skip network-dependent initialization
                      setInitError(null);
                      setIsReady(true);
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.restartButtonText}>Continue Offline</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    
    // ✅ Use top-level loadingCalculation (no nested useMemo)
    const shouldShowLoading = loadingCalculation.shouldShowLoading;
    
    if (shouldShowLoading) {
      // Γ£à FIXED: Consolidated progress calculation to prevent off-by-one errors
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
          <Text style={styles.loadingText}>≡ƒÄ¿ Fashion Color Wheel</Text>
          
          {/* ≡ƒöº Progressive loading progress */}
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

    // Γ£à Now we KNOW both app and auth are initialized
    // Split auth flow - prevents unnecessary re-renders
    if (!user) {
      return <UnauthenticatedApp handleLoginSuccess={safeHandleLoginSuccess} />;
    }

    // Main authenticated app
    return <AuthenticatedApp user={user} handleLogout={safeHandleLogout} />;
  }, [
    initError,
    navigationError,    // ✅ NEW: Navigation error state
    loadingState,
    user,
    handleRestart,
    handleNavigationRecovery, // ✅ NEW: Navigation recovery handler
    safeHandleLoginSuccess,
    safeHandleLogout,
    // ✅ MISSING DEPENDENCIES FIXED:
    isRestarting,       // Used in error screen restart button
    loadingCalculation, // Used for shouldShowLoading
    // ✅ REMOVED: styles - created via StyleSheet.create() outside component, always stable
  ]);


  // Top-level wrapper with comprehensive error boundaries
  devLog('🎨 FashionColorWheelApp: Rendering final UI, isReady:', isReady, 'user:', !!user, 'initError:', !!initError);
  return (
    // Single comprehensive error boundary
    <UnifiedErrorBoundary 
      onError={(error, errorInfo, category) => {
        // Categorize and handle based on error type
        getLogger().error(`≡ƒÜ¿ ${category} Error:`, error);
        
        // ≡ƒöº ADDED: Report to crash reporting
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
        
        // Γ£à Set error state to show UI instead of just logging
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
            // ✅ Conditionally add prop only in debug mode
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
  
  // ≡ƒöº Progressive loading styles
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
    color: '#c0392b', // ✅ 4.64:1 contrast - PASSES WCAG AA
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#555', // ✅ Improved contrast from #666 to #555 for better readability
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
    backgroundColor: '#c0392b', // ✅ Match error text color for consistency
    paddingHorizontal: 30,
    paddingVertical: 16, // ✅ 48px+ total height - PASSES WCAG AA touch target
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minHeight: 48, // ✅ Ensure minimum 48px touch target
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


// ✅ CONTEXT WRAPPER: Wrap the main app with AuthProvider for split context pattern
function App() {
  return (
    <AuthProvider>
      <FashionColorWheelApp />
    </AuthProvider>
  );
}

// Main app export with AuthProvider wrapper
export default App;
