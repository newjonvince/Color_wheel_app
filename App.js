// App.js - Simplified Fashion Color Wheel App
import 'react-native-gesture-handler';

// 🔧 Configure LogBox FIRST - before any other imports or code
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

// App configuration - initialize once at startup
import { APP_CONFIG, getStatusBarStyle } from './src/config/app';

// Safe import of AppInitializer with fallback
let appInitializer = null;
try {
  appInitializer = require('./src/utils/AppInitializer').default;
} catch (error) {
  console.error('❌ Failed to import AppInitializer:', error.message);
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
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState(null);
  
  // 🔧 Progressive loading states for better UX
  const [loadingState, setLoadingState] = useState({
    stage: 'initializing', // 'initializing' | 'storage' | 'auth' | 'ready'
    progress: 0, // 0-100
    message: 'Starting app...'
  });
  
  // 🚨 RACE CONDITION FIX: Add refs to prevent state update races
  const initializationCompleteRef = useRef(false);
  const initializationStateRef = useRef('pending'); // 'pending' | 'success' | 'error'
  const isRestartingRef = useRef(false);
  
  // 🔧 Wrap hook call in error handling
  let authState;
  try {
    authState = useAuth();
  } catch (error) {
    logger.error('🚨 useAuth hook failed:', error);
    authState = null;
  }

  // 🔧 Validate BEFORE destructuring - CRITICAL: Don't proceed if invalid
  const isValidAuthState = authState && typeof authState === 'object';
  
  // 🚨 CRITICAL: If auth state is invalid, show error immediately
  if (!isValidAuthState) {
    logger.error('🚨 useAuth returned invalid state:', authState);
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaView style={styles.loadingContainer}>
            <Text style={styles.errorText}>⚠️ Authentication Error</Text>
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

  // 🔧 Additional validation: Ensure auth functions are actually functions
  const safeInitializeAuth = typeof initializeAuth === 'function' 
    ? initializeAuth 
    : DEFAULT_AUTH_HANDLERS.initializeAuth;
  
  const safeHandleLoginSuccess = typeof handleLoginSuccess === 'function' 
    ? handleLoginSuccess 
    : DEFAULT_AUTH_HANDLERS.handleLoginSuccess;
    
  const safeHandleLogout = typeof handleLogout === 'function' 
    ? handleLogout 
    : DEFAULT_AUTH_HANDLERS.handleLogout;

  // 🔧 Track user context for crash reporting
  React.useEffect(() => {
    if (user) {
      setUserContext(user);
      addBreadcrumb('User logged in', 'auth', 'info', { userId: user.id });
    } else {
      setUserContext(null);
      addBreadcrumb('User logged out', 'auth', 'info');
    }
  }, [user]);

  // ✅ Centralized initialization with proper cleanup
  useEffect(() => {
    let isMounted = true;
    let controller = null;
    
    try {
      controller = new AbortController();
    } catch (error) {
      logger.warn('AbortController not available:', error);
    }
    
    const initialize = async () => {
      try {
        // 🔧 FIXED: Call environment validation first
        logger.debug('🔍 Validating environment configuration...');
        const envValidation = validateEnv();
        if (!envValidation.isValid) {
          logger.warn('⚠️ Environment validation warnings:', envValidation.warnings);
          if (envValidation.errors.length > 0) {
            throw new Error(`Environment validation failed: ${envValidation.errors.join(', ')}`);
          }
        } else {
          logger.debug('✅ Environment validation passed');
        }
        
        // 🔧 Initialize crash reporting early
        logger.debug('📊 Initializing crash reporting...');
        await initializeCrashReporting();
        addBreadcrumb('App initialization started', 'app', 'info');
        
        // Set auth initializer in the centralized manager
        appInitializer.setAuthInitializer(safeInitializeAuth);
        
        // Use centralized initialization with progressive loading
        await appInitializer.initialize({
          signal: controller?.signal,
          onProgress: (progress) => {
            if (isMounted) {
              logger.info(`📊 Init progress: ${progress.step} (${Math.round(progress.progress * 100)}%)`);
              
              // 🔧 Update progressive loading states
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
        
        logger.info('✅ Centralized initialization completed');
        
        // 🔧 RACE CONDITION FIX: Atomic final state update
        if (isMounted && !initializationCompleteRef.current) {
          initializationCompleteRef.current = true;
          initializationStateRef.current = 'success';
          
          setLoadingState({ stage: 'ready', progress: 100, message: 'Ready!' });
          
          // Use atomic state update with better timing
          const finalizeInitialization = () => {
            if (isMounted && !controller?.signal?.aborted && initializationStateRef.current === 'success') {
              setIsReady(true);
            }
          };
          
          // Use requestAnimationFrame for better timing, fallback to setTimeout
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(finalizeInitialization);
          } else {
            setTimeout(finalizeInitialization, 100); // Shorter delay
          }
        }
        
      } catch (error) {
        if (!isMounted || controller?.signal?.aborted) return;
        
        logger.error('🚨 Centralized initialization failed:', error);
        
        // ✅ Set error state so UI shows error screen
        setInitError(error);
      } finally {
        // 🔧 Wrap finally block in try-catch to prevent any cleanup errors
        try {
          // Note: Don't check initError state here as it might not be updated yet
          // The error handling is done in the catch block above
          if (isMounted && !controller?.signal?.aborted) {
            logger.debug('🔧 Initialization cleanup completed');
          }
        } catch (finallyError) {
          logger.error('🚨 Error in finally block:', finallyError);
          // Don't let cleanup errors crash the app
        }
      }
    };

    // 🚨 RACE CONDITION FIX: Prevent catch handler from overriding success
    initialize().catch((error) => {
      // Don't override successful initialization
      if (!isMounted || controller?.signal?.aborted || initializationStateRef.current === 'success') {
        return;
      }
      
      initializationStateRef.current = 'error';
      logger.error('🚨 Unhandled initialization error:', error);
      
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
    });
    
    // Cleanup
    return () => {
      isMounted = false;
      controller?.abort();
    };
  }, []); // Empty deps = run once
  

  // Show error screen if auth state is broken
  if (!isValidAuthState && isReady) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>⚠️ Authentication Error</Text>
        <Text style={styles.errorSubtext}>
          Please restart the app
        </Text>
      </SafeAreaView>
    );
  }

  // 🚨 RACE CONDITION FIX: Memoized restart handler to prevent multiple executions
  const handleRestart = useCallback(async () => {
    if (isRestartingRef.current) {
      return; // Prevent multiple restart attempts
    }
    
    isRestartingRef.current = true;
    logger.info('🔄 User requested app restart');
    
    try {
      let restartSuccessful = false;
      
      // Method 1: Expo Updates (try first)
      if (!restartSuccessful && global.Updates?.reloadAsync) {
        try {
          logger.info('🔄 Restarting via Expo Updates...');
          await global.Updates.reloadAsync();
          restartSuccessful = true;
        } catch (error) {
          logger.warn('Expo Updates restart failed:', error);
        }
      }
      
      // Method 2: DevSettings (only if Method 1 failed)
      if (!restartSuccessful && global.DevSettings?.reload) {
        try {
          logger.info('🔄 Restarting via DevSettings...');
          global.DevSettings.reload();
          restartSuccessful = true;
        } catch (error) {
          logger.warn('DevSettings restart failed:', error);
        }
      }
      
      // Method 3: Web reload (only if previous methods failed)
      if (!restartSuccessful && typeof window !== 'undefined' && window.location) {
        try {
          logger.info('🔄 Restarting via window.location.reload...');
          window.location.reload();
          restartSuccessful = true;
        } catch (error) {
          logger.warn('Web restart failed:', error);
        }
      }
      
      // Method 4: State reset (only if all else failed)
      if (!restartSuccessful) {
        logger.warn('🔄 No restart mechanism available, attempting state reset...');
        
        // Reset refs first
        initializationCompleteRef.current = false;
        initializationStateRef.current = 'pending';
        
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
        setTimeout(() => {
          if (appInitializer?.initialize && !initializationCompleteRef.current) {
            appInitializer.initialize().catch((error) => {
              logger.error('🚨 Restart initialization failed:', error);
              setInitError(error);
            });
          }
        }, 100);
      }
      
    } catch (error) {
      logger.error('🚨 Restart failed:', error);
      setInitError(new Error(`Restart failed: ${error.message}`));
    } finally {
      // Reset restart flag after delay to prevent rapid clicking
      setTimeout(() => {
        isRestartingRef.current = false;
      }, 2000);
    }
  }, []);

  // ✅ Fixed render content - waits for BOTH app and auth initialization
  const renderContent = () => {
    // ✅ Show error screen if initialization failed
    if (initError) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={styles.errorText}>⚠️ Startup Error</Text>
          <Text style={styles.errorSubtext}>
            The app encountered a problem starting up.
          </Text>
          <TouchableOpacity
            style={styles.restartButton}
            onPress={handleRestart}
            disabled={isRestartingRef.current}
          >
            <Text style={styles.restartButtonText}>
              {isRestartingRef.current ? 'Restarting...' : 'Restart App'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    
    // 🚨 RACE CONDITION FIX: Memoized loading state to prevent races
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
    
    const shouldShowLoading = loadingCalculation.shouldShowLoading;
    
    if (shouldShowLoading) {
      // ✅ FIXED: Consolidated progress calculation to prevent off-by-one errors
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
          <Text style={styles.loadingText}>🎨 Fashion Color Wheel</Text>
          
          {/* 🔧 Progressive loading progress */}
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

    // ✅ Now we KNOW both app and auth are initialized
    // Split auth flow - prevents unnecessary re-renders
    if (!user) {
      return <UnauthenticatedApp handleLoginSuccess={safeHandleLoginSuccess} />;
    }

    // Main authenticated app
    return <AuthenticatedApp user={user} handleLogout={safeHandleLogout} />;
  };


  // Top-level wrapper with comprehensive error boundaries
  return (
    // Single comprehensive error boundary
    <UnifiedErrorBoundary 
      onError={(error, errorInfo, category) => {
        // Categorize and handle based on error type
        logger.error(`🚨 ${category} Error:`, error);
        
        // 🔧 ADDED: Report to crash reporting
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
        
        // ✅ Set error state to show UI instead of just logging
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
            linking={APP_CONFIG.linking}
            fallback={
              <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e74c3c" />
                <Text style={styles.loadingText}>Loading navigation...</Text>
              </SafeAreaView>
            }
            onError={(error) => {
              logger.error('🚨 Navigation error:', error);
            }}
            // ✅ Conditionally add prop only in debug mode
            {...(__DEV__ ? { onStateChange: (state) => logger.debug('Nav state:', state) } : {})}
          >
            {renderContent()}
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
  
  // 🔧 Progressive loading styles
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
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  restartButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
