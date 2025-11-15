// App.js - Simplified Fashion Color Wheel App
import 'react-native-gesture-handler';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { enableScreens } from 'react-native-screens';

// Performance optimizations
enableScreens(true);

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

// Simplified App component with split auth/main flows
function FashionColorWheelApp() {
  const [isLoading, setIsLoading] = useState(true);
  
  // ✅ SAFER: Safe destructuring with fallback
  const authState = useAuth() || {};
  const {
    user = null,
    loading: authLoading = false,
    isInitialized = false,
    initializeAuth = async () => { console.warn('Auth not initialized'); },
    handleLoginSuccess = () => { console.warn('Auth not initialized'); },
    handleLogout = () => { console.warn('Auth not initialized'); },
  } = authState;

  // Validation for debugging
  if (!authState || typeof authState !== 'object') {
    console.error('🚨 useAuth returned invalid state:', authState);
  }

  // Initialize app - sequential for dependency safety, parallel where safe
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🔄 Starting app initialization...');
        
        // Step 1: Validate environment variables first
        validateEnv(); // Fail fast if config is broken
        
        // Step 2: Initialize app config (required for other steps)
        await initializeAppConfig();
        console.log('✅ initializeAppConfig() completed');

        // Step 3: Initialize storage layer (required by API service and auth)
        try {
          await safeStorage.init();
          console.log('✅ safeStorage.init() completed');
        } catch (storageError) {
          console.error('❌ safeStorage.init() failed:', storageError);
          // Continue anyway - safeStorage has internal fallbacks
          console.warn('⚠️ Continuing with limited storage functionality');
        }

        // Step 4: ✅ SAFER: Graceful degradation pattern
        console.log('🔄 Starting parallel API and auth initialization...');
        const [apiResult, authResult] = await Promise.allSettled([
          safeApiService.ready.then(() => ({ success: true, service: 'API' })),
          initializeAuth().then(() => ({ success: true, service: 'Auth' }))
        ]);

        // Check results and continue with degraded functionality
        if (apiResult.status === 'rejected') {
          console.error('⚠️ API service failed, running in offline mode:', apiResult.reason);
          // App can still work without API (local palette generation)
        }

        if (authResult.status === 'rejected') {
          console.error('⚠️ Auth failed, showing login screen:', authResult.reason);
          // Auth failure is expected if user isn't logged in
        }
        
        console.log('✅ All initialization steps completed');
      } catch (error) {
        console.error('🚨 App initialization failed:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          cause: error.cause
        });
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
    
    // ✅ SAFER: Run only once on mount
  }, []); // Empty deps = run once
  

  // ✅ Simplified render content with split components
  const renderContent = () => {
    // Loading screen
    if (isLoading || authLoading) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
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

// Error boundary wrapper
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Something went wrong. Please restart the app.</Text>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

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
