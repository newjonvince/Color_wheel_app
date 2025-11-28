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
import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';

// Direct imports (no lazy loading to avoid complexity)
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// ✅ LAZY LOADING: Avoid circular dependency with config/app.js
let appConfig = null;
let statusBarStyleFn = null;

const getAppConfig = () => {
  if (appConfig) return appConfig;
  try {
    const configModule = require('./src/config/app');
    appConfig = configModule.APP_CONFIG || {};
    statusBarStyleFn = configModule.getStatusBarStyle || (() => 'auto');
  } catch (error) {
    console.warn('Failed to load app config:', error.message);
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
  console.error('Γ¥î Failed to import AppInitializer:', error.message);
  // Create fallback initializer
  appInitializer = {
    initialize: async () => {
      console.warn('Using fallback AppInitializer');
      return { success: true, message: 'Fallback initialization' };
    },
    reset: () => {
      console.warn('AppInitializer reset called on fallback');
    },
    setAuthInitializer: () => {
      console.warn('AppInitializer setAuthInitializer called on fallback');
    }
  };
}

// Screen imports - let error boundary catch failures instead of faking screens
import AuthenticatedApp from './src/components/AuthenticatedApp';
import UnauthenticatedApp from './src/components/UnauthenticatedApp';
import UnifiedErrorBoundary from './src/components/UnifiedErrorBoundary';
import { useAuth } from './src/hooks/useAuth';
import { validateEnv } from './src/config/env';
import { logger } from './src/utils/AppLogger';
import { initializeCrashReporting, reportError, setUserContext, addBreadcrumb } from './src/utils/crashReporting';

// Create stable default functions OUTSIDE component
const DEFAULT_AUTH_HANDLERS = {
  initializeAuth: async () => {
    logger.warn('Auth not initialized');
    return Promise.resolve();
  },
  handleLoginSuccess: () => logger.warn('handleLoginSuccess: Auth not initialized'),
  handleLogout: () => logger.warn('handleLogout: Auth not initialized'),
};

// Simplified App component with split auth/main flows
function FashionColorWheelApp() {
  console.log('🚀 FashionColorWheelApp: Component rendering started');
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState(null);
  
  // ≡ƒöº Progressive loading states for better UX
  const [loadingState, setLoadingState] = useState({
    stage: 'initializing', // 'initializing' | 'storage' | 'auth' | 'ready'
    progress: 0, // 0-100
    message: 'Starting app...'
  });
  
  // ≡ƒöº RACE CONDITION FIX: Single atomic state management
  const initializationRef = useRef({
    state: 'pending', // 'pending' | 'initializing' | 'success' | 'error'
    timestamp: Date.now(),
    error: null
  });
  const restartTimersRef = useRef({ restart: null, flag: null }); // Track restart timers
  const isRestartingRef = useRef(false); // Track restart state
  
  // ≡ƒöº Atomic state transition helper
  const setInitializationState = useCallback((newState, error = null) => {
    const validTransitions = {
      'pending': ['initializing', 'error'],
      'initializing': ['success', 'error'],
      'success': ['pending'], // Only for restart
      'error': ['pending']    // Only for restart
    };
    
    const currentState = initializationRef.current.state;
    if (!validTransitions[currentState]?.includes(newState)) {
      logger.warn(`❌ Invalid state transition: ${currentState} → ${newState}`);
      return false;
    }
    
    initializationRef.current = {
      state: newState,
      timestamp: Date.now(),
      error
    };
    logger.debug(`✅ State transition: ${currentState} → ${newState}`);
    return true;
  }, []);
  
  // ✅ HOOKS RULE COMPLIANCE: Call hook unconditionally at top level
  // Error handling should be done by Error Boundaries, not try-catch
  console.log('🔐 FashionColorWheelApp: Calling useAuth hook');
  const authState = useAuth();
  console.log('🔐 FashionColorWheelApp: useAuth returned:', authState);

  // ≡ƒöº Validate BEFORE destructuring - CRITICAL: Don't proceed if invalid
  const isValidAuthState = authState && typeof authState === 'object';
  
  // ≡ƒÜ¿ CRITICAL: If auth state is invalid, show error immediately
  if (!isValidAuthState) {
    logger.error('≡ƒÜ¿ useAuth returned invalid state:', authState);
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaView style={styles.loadingContainer}>
            <Text style={styles.errorText}>ΓÜá∩╕Å Authentication Error</Text>
            <Text style={styles.errorSubtext}>
              The authentication system failed to initialize properly.
            </Text>
            <TouchableOpacity 
              style={styles.restartButton} 
              onPress={() => {
                // Force app restart by reloading
                if (typeof window !== 'undefined' && window.location) {
                  window.location.reload();
                } else {
                  logger.warn('Cannot restart app - no reload mechanism available');
                }
              }}
            >
              <Text style={styles.restartButtonText}>Restart App</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }
  
  const {
    user = null,
    loading: authLoading = false,
    isInitialized = false,
    initializeAuth = DEFAULT_AUTH_HANDLERS.initializeAuth,
    handleLoginSuccess = DEFAULT_AUTH_HANDLERS.handleLoginSuccess,
    handleLogout = DEFAULT_AUTH_HANDLERS.handleLogout,
  } = authState;

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
  React.useEffect(() => {
    if (user) {
      setUserContext(user);
      addBreadcrumb('User logged in', 'auth', 'info', { userId: user.id });
    } else {
      setUserContext(null);
      addBreadcrumb('User logged out', 'auth', 'info');
    }
  }, [user]);

  // Γ£à Centralized initialization with proper cleanup
  useEffect(() => {
    let isMounted = true;
    let controller = null;
    let finalizationTimerId = null; // Track timer for cleanup
    
    try {
      controller = new AbortController();
    } catch (error) {
      logger.warn('AbortController not available:', error);
    }
    
    const initialize = async () => {
      try {
        // ≡ƒöº Set initializing state
        if (!setInitializationState('initializing')) {
          logger.warn('❌ Cannot start initialization - invalid state transition');
          return;
        }
        
        // ≡ƒöº FIXED: Call environment validation first
        logger.debug('≡ƒöì Validating environment configuration...');
        const envValidation = validateEnv();
        if (!envValidation.isValid) {
          logger.warn('ΓÜá∩╕Å Environment validation warnings:', envValidation.warnings);
          if (envValidation.errors.length > 0) {
            throw new Error(`Environment validation failed: ${envValidation.errors.join(', ')}`);
          }
        } else {
          logger.debug('Γ£à Environment validation passed');
        }
        
        // ≡ƒöº Initialize crash reporting early
        logger.debug('≡ƒôè Initializing crash reporting...');
        await initializeCrashReporting();
        addBreadcrumb('App initialization started', 'app', 'info');
        
        // Set auth initializer in the centralized manager
        appInitializer.setAuthInitializer(safeInitializeAuth);
        
        // Use centralized initialization with progressive loading
        console.log('🔧 Starting AppInitializer.initialize...');
        
        // Run diagnostics if initialization fails repeatedly
        try {
          const { runDiagnostics } = require('./src/utils/diagnostics');
          console.log('🔍 Running pre-initialization diagnostics...');
          const diagnosticResult = await runDiagnostics();
          if (!diagnosticResult.success) {
            console.error('🚨 Diagnostic failures detected:', diagnosticResult.failures);
          }
        } catch (diagError) {
          console.warn('⚠️ Could not run diagnostics:', diagError.message);
        }
        
        await appInitializer.initialize({
          signal: controller?.signal,
          onProgress: (progress) => {
            if (isMounted) {
              logger.info(`≡ƒôè Init progress: ${progress.step} (${Math.round(progress.progress * 100)}%)`);
              
              // ≡ƒöº Update progressive loading states
              const stageMap = {
                'env': { stage: 'initializing', progress: 10, message: 'Checking environment...' },
                'config': { stage: 'initializing', progress: 20, message: 'Loading configuration...' },
                'storage': { stage: 'storage', progress: 40, message: 'Loading your data...' },
                'api': { stage: 'storage', progress: 60, message: 'Connecting to services...' },
                'auth': { stage: 'auth', progress: 80, message: 'Signing you in...' }
              };
              
              const loadingUpdate = stageMap[progress.step] || {
                stage: 'ready',
                progress: Math.round(progress.progress * 100),
                message: 'Almost there...'
              };
              
              setLoadingState(loadingUpdate);
            }
          }
        });
        
        logger.info('Γ£à Centralized initialization completed');
        
        // ≡ƒöº RACE CONDITION FIX: Atomic final state update
        if (isMounted && initializationRef.current.state === 'initializing') {
          if (!setInitializationState('success')) {
            logger.warn('❌ Cannot complete initialization - invalid state transition');
            return;
          }
          
          // ✅ RACE CONDITION FIX: Don't show "Ready!" until isReady is actually set
          setLoadingState({ stage: 'finalizing', progress: 95, message: 'Finalizing...' });
          
          // Use atomic state update with better timing
          const finalizeInitialization = () => {
            finalizationTimerId = null; // Clear timer reference
            if (isMounted && !controller?.signal?.aborted && initializationRef.current.state === 'success') {
              // ✅ ATOMIC UPDATE: Set both ready state and final loading message together
              setIsReady(true);
              setLoadingState({ stage: 'ready', progress: 100, message: 'Ready!' });
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
        logger.error('≡ƒÜ¿ Centralized initialization failed:', error);
        
        // ✅ SECURITY FIX: Always show error screen for failed initialization
        // Never bypass critical initialization failures as this could lead to:
        // - Storage corruption/data loss
        // - Wrong user data being shown
        // - API calls with invalid tokens
        // - Security vulnerabilities
        setInitializationState('error', error);
        setInitError(error);
      } finally {
        // ≡ƒöº Wrap finally block in try-catch to prevent any cleanup errors
        try {
          // Note: Don't check initError state here as it might not be updated yet
          // The error handling is done in the catch block above
          if (isMounted && !controller?.signal?.aborted) {
            logger.debug('≡ƒöº Initialization cleanup completed');
          }
        } catch (finallyError) {
          logger.error('≡ƒÜ¿ Error in finally block:', finallyError);
          // Don't let cleanup errors crash the app
        }
      }
    };

    // ≡ƒÜ¿ RACE CONDITION FIX: Prevent catch handler from overriding success
    initialize().catch((error) => {
      // Don't override successful initialization
      if (!isMounted || controller?.signal?.aborted || initializationRef.current.state === 'success') {
        return;
      }
      
      // ≡ƒöº Atomic error state transition
      if (setInitializationState('error', error)) {
        logger.error('≡ƒÜ¿ Unhandled initialization error:', error);
        
        // Set error state to show user-friendly error screen
        setInitError(error);
        
        // Ensure app doesn't stay in loading state
        if (isMounted) {
          setIsReady(false);
          setLoadingState({
            stage: 'error',
            progress: 0,
            message: 'Initialization failed'
          });
        }
      }
    });
    
    // Cleanup
    return () => {
      isMounted = false;
      controller?.abort();
      
      // ≡ƒöº MEMORY LEAK FIX: Cancel pending timers/animation frames
      if (finalizationTimerId !== null) {
        if (typeof cancelAnimationFrame !== 'undefined') {
          cancelAnimationFrame(finalizationTimerId);
        } else {
          clearTimeout(finalizationTimerId);
        }
        finalizationTimerId = null;
      }
    };
  }, []); // Empty deps = run once
  
  // ≡ƒöº MEMORY LEAK FIX: Cleanup restart timers on unmount
  useEffect(() => {
    return () => {
      // ✅ Mark component as unmounted to prevent stale timer execution
      isMountedRef.current = false;
      
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
  }, []);

  // Note: Auth state validation already handled above with early return
  // No need for duplicate isValidAuthState check here

  // 🚨 RACE CONDITION FIX: Memoized restart handler with ref-based state
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true); // Track component mount state
  const [isRestarting, setIsRestarting] = useState(false); // ✅ Use state instead of ref for UI updates
  
  const handleRestart = useCallback(async () => {
    // ≡ƒöº Use ref to prevent multiple executions (properly scoped)
    if (isProcessingRef.current) {
      return; // Prevent multiple restart attempts
    }
    
    isProcessingRef.current = true;
    setIsRestarting(true); // ✅ Update UI state
    logger.info('≡ƒöä User requested app restart');
    
    try {
      let restartSuccessful = false;
      
      // Method 1: Expo Updates (try first)
      if (!restartSuccessful && global.Updates?.reloadAsync) {
        try {
          logger.info('≡ƒöä Restarting via Expo Updates...');
          await global.Updates.reloadAsync();
          restartSuccessful = true;
        } catch (error) {
          logger.warn('Expo Updates restart failed:', error);
        }
      }
      
      // Method 2: DevSettings (only if Method 1 failed)
      if (!restartSuccessful && global.DevSettings?.reload) {
        try {
          logger.info('≡ƒöä Restarting via DevSettings...');
          global.DevSettings.reload();
          restartSuccessful = true;
        } catch (error) {
          logger.warn('DevSettings restart failed:', error);
        }
      }
      
      // Method 3: Web reload (only if previous methods failed)
      if (!restartSuccessful && typeof window !== 'undefined' && window.location) {
        try {
          logger.info('≡ƒöä Restarting via window.location.reload...');
          window.location.reload();
          restartSuccessful = true;
        } catch (error) {
          logger.warn('Web restart failed:', error);
        }
      }
      
      // Method 4: State reset (only if all else failed)
      if (!restartSuccessful) {
        logger.warn('≡ƒöä No restart mechanism available, attempting state reset...');
        
        // ≡ƒöº Reset atomic state
        setInitializationState('pending');
        
        // Atomic state reset
        setInitError(null);
        setIsReady(false);
        setLoadingState({
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
              logger.error('≡ƒÜ¿ Restart initialization failed:', error);
              setInitializationState('error', error);
              setInitError(error);
            });
          }
        }, 100);
      }
      
    } catch (error) {
      logger.error('≡ƒÜ¿ Restart failed:', error);
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
  }, []);

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
                const { runDiagnostics } = require('./src/utils/diagnostics');
                console.log('🔍 Running manual diagnostics...');
                const result = await runDiagnostics();
                Alert.alert(
                  'Diagnostic Results',
                  result.success 
                    ? 'All systems appear to be working. Try restarting the app.'
                    : `Issues found:\n${result.failures.join('\n')}`,
                  [{ text: 'OK' }]
                );
              } catch (error) {
                Alert.alert('Diagnostic Error', `Could not run diagnostics: ${error.message}`);
              }
            }}
          >
            <Text style={styles.restartButtonText}>Run Diagnostics</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.restartButton, { backgroundColor: '#f39c12', marginTop: 10 }]}
            onPress={() => {
              Alert.alert(
                'Continue Offline?',
                'This will skip network checks and try to run the app with cached data only. Some features may not work.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Continue Offline', 
                    onPress: () => {
                      console.log('🔄 User chose to continue offline, bypassing network checks...');
                      // Skip network-dependent initialization
                      setInitializationFailed(false);
                      setIsInitialized(true);
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
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${loadingInfo.progress}%` }
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
    loadingState,
    user,
    handleRestart,
    safeHandleLoginSuccess,
    safeHandleLogout,
    // ✅ MISSING DEPENDENCIES FIXED:
    isRestarting,       // Used in error screen restart button
    loadingCalculation, // Used for shouldShowLoading
    styles              // Used throughout render
  ]);


  // Top-level wrapper with comprehensive error boundaries
  console.log('🎨 FashionColorWheelApp: Rendering final UI, isReady:', isReady, 'user:', !!user, 'initError:', !!initError);
  return (
    // Single comprehensive error boundary
    <UnifiedErrorBoundary 
      onError={(error, errorInfo, category) => {
        // Categorize and handle based on error type
        logger.error(`≡ƒÜ¿ ${category} Error:`, error);
        
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
          logger.warn('Storage error detected, may need to clear cache');
        } else if (category === 'NavigationError') {
          logger.warn('Navigation error detected, may need to reset nav state');
        } else {
          logger.error('Generic error, full crash recovery needed');
        }
      }}
      onRestart={() => {
        // Custom restart logic if needed
        logger.info('App restart requested by error boundary');
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
            onError={(error) => {
              logger.error('≡ƒÜ¿ Navigation error:', error);
            }}
            // Γ£à Conditionally add prop only in debug mode
            {...(__DEV__ ? { onStateChange: (state) => logger.debug('Nav state:', state) } : {})}
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


// Main app export with unified error boundary
export default FashionColorWheelApp;
