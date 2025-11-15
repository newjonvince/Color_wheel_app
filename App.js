// App.js - Simplified Fashion Color Wheel App
import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';

// Log suppression handled in initializeAppConfig

// Direct imports (no lazy loading to avoid complexity)
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// App configuration - initialize once at startup
import { initializeAppConfig, APP_CONFIG, getStatusBarStyle } from './src/config/app';
import { safeStorage } from './src/utils/safeStorage';
import safeApiService from './src/services/safeApiService';

// Screen imports - let error boundary catch failures instead of faking screens
import AuthenticatedApp from './src/components/AuthenticatedApp';
import UnauthenticatedApp from './src/components/UnauthenticatedApp';
import StorageErrorBoundary from './src/components/StorageErrorBoundary';
import CrashRecoveryBoundary from './src/components/CrashRecoveryBoundary';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import { useAuth } from './src/hooks/useAuth';
import { validateEnv } from './src/config/env';
import { logger } from './src/utils/AppLogger';

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
  const [isLoading, setIsLoading] = useState(true);
  
  const authState = useAuth();
  
  // Safer destructuring with useMemo for stability
  const {
    user = null,
    loading: authLoading = false,
    isInitialized = false,
    initializeAuth = DEFAULT_AUTH_HANDLERS.initializeAuth,
    handleLoginSuccess = DEFAULT_AUTH_HANDLERS.handleLoginSuccess,
    handleLogout = DEFAULT_AUTH_HANDLERS.handleLogout,
  } = authState || {};

  // Validation for debugging
  if (!authState || typeof authState !== 'object') {
    logger.error('🚨 useAuth returned invalid state:', authState);
  }

  // ✅ REACT 18 STRICTMODE: Initialize app with proper AbortController cleanup
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
        logger.info('🔄 Starting app initialization...');
        
        // Step 1: Validate environment variables first
        validateEnv(); // Fail fast if config is broken
        
        // Step 2: Initialize app config (required for other steps)
        await initializeAppConfig();
        logger.info('✅ initializeAppConfig() completed');

        // Step 3: Initialize storage layer (required by API service and auth)
        try {
          await safeStorage.init();
          logger.info('✅ safeStorage.init() completed');
        } catch (storageError) {
          logger.error('❌ safeStorage.init() failed:', storageError);
          // Continue anyway - safeStorage has internal fallbacks
          logger.warn('⚠️ Continuing with limited storage functionality');
        }

        // ✅ SAFER: Check if aborted or unmounted before continuing
        if (!isMounted || controller?.signal?.aborted) {
          logger.debug('🛑 Initialization aborted before auth step');
          return;
        }

        // Step 4: ✅ SAFER: Graceful degradation pattern with signal support
        logger.info('🔄 Starting parallel API and auth initialization...');
        const [apiResult, authResult] = await Promise.allSettled([
          safeApiService.ready.then(() => ({ success: true, service: 'API' })),
          initializeAuth({ signal: controller?.signal }).then(() => ({ success: true, service: 'Auth' }))
        ]);

        // ✅ SAFER: Check if aborted or unmounted after async operations
        if (!isMounted || controller?.signal?.aborted) {
          logger.debug('🛑 Initialization aborted after async operations');
          return; // Don't update state if aborted
        }

        // ✅ Track service states and notify user
        const serviceStates = {
          api: apiResult.status === 'fulfilled',
          auth: authResult.status === 'fulfilled',
        };

        if (!serviceStates.api) {
          logger.warn('API offline:', apiResult.reason);
          // ✅ Show user notification
          Alert.alert('Offline Mode', 'App running without cloud features');
        }

        if (!serviceStates.auth) {
          logger.warn('Auth failed:', authResult.reason);
          // Auth failure is OK - user will see login screen
        }

        // ✅ Store service states for UI decisions
        try {
          await safeStorage.setItem('serviceStates', JSON.stringify(serviceStates));
        } catch (storageError) {
          logger.warn('Failed to store service states:', storageError);
        }
        
        logger.info('✅ All initialization steps completed');
      } catch (error) {
        // ✅ SAFER: Don't log errors if aborted or unmounted
        if (!isMounted || controller?.signal?.aborted) {
          logger.debug('🛑 Initialization aborted during error handling');
          return;
        }
        
        logger.error('🚨 App initialization failed:', error);
        logger.error('Error stack:', error.stack);
        logger.error('Error details:', {
          message: error.message,
          name: error.name,
          cause: error.cause
        });
      } finally {
        // ✅ SAFER: Only update state if not aborted and still mounted
        if (isMounted && !controller?.signal?.aborted) {
          setIsLoading(false);
        }
      }
    };

    initialize();
    
    // ✅ REACT 18 STRICTMODE: Cleanup AbortController
    return () => {
      isMounted = false;
      controller?.abort();
    };
  }, []); // Empty deps = run once
  

  // ✅ Simplified render content with split components
  const renderContent = () => {
    // Loading screen
    if (isLoading || authLoading) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>🎨 Loading Fashion Color Wheel...</Text>
        </SafeAreaView>
      );
    }

    // Split auth flow - prevents unnecessary re-renders
    if (!isInitialized || !user) {
      return <UnauthenticatedApp handleLoginSuccess={handleLoginSuccess} />;
    }

    // Main authenticated app
    return <AuthenticatedApp user={user} handleLogout={handleLogout} />;
  };


  // Top-level wrapper with comprehensive error boundaries
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.fullScreen}>
          <StatusBar style={getStatusBarStyle()} />
          <StorageErrorBoundary>
            <CrashRecoveryBoundary>
              {renderContent()}
            </CrashRecoveryBoundary>
          </StorageErrorBoundary>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </AppErrorBoundary>
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


// Main app export with enhanced error boundaries
export default function App() {
  return (
    <CrashRecoveryBoundary>
      <AppErrorBoundary>
        <StorageErrorBoundary>
          <FashionColorWheelApp />
        </StorageErrorBoundary>
      </AppErrorBoundary>
    </CrashRecoveryBoundary>
  );
}
