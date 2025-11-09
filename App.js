// App.js - Ultra-optimized Fashion Color Wheel App
import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { AppState, Platform, LogBox, StyleSheet } from 'react-native';
import { enableScreens } from 'react-native-screens';

// Performance optimizations
enableScreens(true);

// Suppress warnings in production
if (!__DEV__) {
  LogBox.ignoreAllLogs();
}

// Optimized imports with lazy loading
const loadModules = () => import('./src/utils/moduleLoader').then(m => m.loadModules());
const loadScreens = () => import('./src/utils/moduleLoader').then(m => m.loadScreens());
const loadColorWheelScreen = () => import('./src/utils/moduleLoader').then(m => m.loadColorWheelScreen());
const loadErrorBoundary = () => import('./src/utils/moduleLoader').then(m => m.loadErrorBoundary());

// Lazy load components
const LoadingScreen = React.lazy(() => import('./src/components/LoadingScreen').then(m => ({ default: m.LoadingScreen })));
const AuthScreens = React.lazy(() => import('./src/components/AuthScreens').then(m => ({ default: m.AuthScreens })));
const AppNavigation = React.lazy(() => import('./src/components/AppNavigation').then(m => ({ default: m.AppNavigation })));

// Hooks
import { useAuth } from './src/hooks/useAuth';
import { useEnhancedColorMatches } from './src/hooks/useEnhancedColorMatches';
import { useColorWheelRetry } from './src/hooks/useColorWheelRetry';

// Configuration
import { initializeAppConfig } from './src/config/app';

// App state management
const APP_STATES = {
  INITIALIZING: 'initializing',
  LOADING_MODULES: 'loading_modules',
  AUTHENTICATING: 'authenticating',
  READY: 'ready',
  ERROR: 'error'
};

// Performance monitoring (development only)
const performanceMonitor = __DEV__ ? {
  startTime: Date.now(),
  logTiming: (label) => {
    console.log(`⏱️ ${label}: ${Date.now() - performanceMonitor.startTime}ms`);
  }
} : { logTiming: () => {} };

// Optimized App component
function OptimizedApp() {
  // App state
  const [appState, setAppState] = useState(APP_STATES.INITIALIZING);
  const [showSignUp, setShowSignUp] = useState(false);
  const [modules, setModules] = useState(null);
  const [screens, setScreens] = useState(null);
  const [ColorWheelScreen, setColorWheelScreen] = useState(null);
  const [ErrorBoundary, setErrorBoundary] = useState(React.Fragment);
  const [error, setError] = useState(null);

  // Custom hooks with error boundaries
  const authHook = useAuth();
  const colorMatchesHook = useEnhancedColorMatches();
  
  // Memoized destructuring to prevent unnecessary re-renders
  const {
    user,
    loading: authLoading,
    isInitialized,
    initializeAuth,
    handleLoginSuccess,
    handleSignUpComplete,
    handleLogout,
    handleAccountDeleted,
  } = authHook;

  const { 
    colorMatches: savedColorMatches, 
    saveColorMatch,
    loading: colorMatchesLoading 
  } = colorMatchesHook;

  // Initialize Updates module for retry functionality
  const Updates = modules?.Updates;
  const { wheelReloadNonce, retryLoadColorWheel } = useColorWheelRetry(Updates);

  // Memoized loading state
  const isLoading = useMemo(() => {
    return authLoading || colorMatchesLoading || appState === APP_STATES.LOADING_MODULES;
  }, [authLoading, colorMatchesLoading, appState]);

  // Optimized module loading with error handling
  const initializeModules = useCallback(async () => {
    try {
      setAppState(APP_STATES.LOADING_MODULES);
      performanceMonitor.logTiming('Module loading started');

      // Load modules in parallel for better performance
      const [
        { modules: loadedModules },
        { screens: loadedScreens },
        { ColorWheelScreen: loadedColorWheel },
        loadedErrorBoundary
      ] = await Promise.all([
        loadModules(),
        loadScreens(),
        loadColorWheelScreen(),
        loadErrorBoundary()
      ]);

      setModules(loadedModules);
      setScreens(loadedScreens);
      setColorWheelScreen(loadedColorWheel);
      setErrorBoundary(loadedErrorBoundary);

      performanceMonitor.logTiming('Modules loaded');
      setAppState(APP_STATES.AUTHENTICATING);

    } catch (moduleError) {
      console.error('Failed to load modules:', moduleError);
      setError(moduleError);
      setAppState(APP_STATES.ERROR);
    }
  }, []);

  // Initialize app with optimized timing
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Initialize app configuration first
        initializeAppConfig();
        performanceMonitor.logTiming('App config initialized');

        // Load modules
        await initializeModules();

        if (isMounted) {
          // Initialize auth after modules are loaded
          const authTimeout = setTimeout(() => {
            if (isMounted) {
              initializeAuth();
              setAppState(APP_STATES.READY);
              performanceMonitor.logTiming('App fully initialized');
            }
          }, 50);

          return () => clearTimeout(authTimeout);
        }
      } catch (initError) {
        console.error('App initialization failed:', initError);
        if (isMounted) {
          setError(initError);
          setAppState(APP_STATES.ERROR);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [initializeModules, initializeAuth]);

  // Optimized app state change handler
  const handleAppStateChange = useCallback((nextAppState) => {
    if (nextAppState === 'active' && !isInitialized && appState === APP_STATES.READY) {
      initializeAuth();
    }
  }, [isInitialized, initializeAuth, appState]);

  // App state listener with cleanup
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove?.();
    };
  }, [handleAppStateChange]);

  // Memoized extracted modules for performance
  const extractedModules = useMemo(() => {
    if (!modules) return {};
    
    return {
      StatusBar: modules.StatusBar,
      NavigationContainer: modules.NavigationContainer,
      createBottomTabNavigator: modules.createBottomTabNavigator,
      GestureHandlerRootView: modules.GestureHandlerRootView,
      SafeAreaProvider: modules.SafeAreaProvider,
      SafeAreaView: modules.SafeAreaView,
    };
  }, [modules]);

  // Memoized Tab navigator
  const Tab = useMemo(() => {
    return extractedModules.createBottomTabNavigator?.();
  }, [extractedModules.createBottomTabNavigator]);

  // Error boundary fallback
  if (error || appState === APP_STATES.ERROR) {
    const { SafeAreaProvider, SafeAreaView } = extractedModules;
    
    return (
      <Suspense fallback={<MinimalLoadingScreen />}>
        <LoadingScreen 
          SafeAreaProvider={SafeAreaProvider || React.Fragment}
          SafeAreaView={SafeAreaView || React.Fragment}
          error={error}
        />
      </Suspense>
    );
  }

  // Loading state with progress indication
  if (isLoading || !isInitialized || appState !== APP_STATES.READY) {
    const { SafeAreaProvider, SafeAreaView } = extractedModules;
    
    return (
      <Suspense fallback={<MinimalLoadingScreen />}>
        <LoadingScreen 
          SafeAreaProvider={SafeAreaProvider || React.Fragment}
          SafeAreaView={SafeAreaView || React.Fragment}
          error={null}
        />
      </Suspense>
    );
  }

  // Authentication screens
  if (!user) {
    const { SafeAreaProvider, SafeAreaView, StatusBar } = extractedModules;
    
    return (
      <Suspense fallback={<MinimalLoadingScreen />}>
        <AuthScreens
          SafeAreaProvider={SafeAreaProvider}
          SafeAreaView={SafeAreaView}
          StatusBar={StatusBar}
          showSignUp={showSignUp}
          setShowSignUp={setShowSignUp}
          screens={screens}
          handleLoginSuccess={handleLoginSuccess}
          handleSignUpComplete={handleSignUpComplete}
        />
      </Suspense>
    );
  }

  // Main app navigation
  const { 
    GestureHandlerRootView, 
    SafeAreaProvider, 
    NavigationContainer, 
    StatusBar 
  } = extractedModules;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Suspense fallback={<MinimalLoadingScreen />}>
          <AppNavigation
            Tab={Tab}
            NavigationContainer={NavigationContainer}
            ErrorBoundary={ErrorBoundary}
            StatusBar={StatusBar}
            user={user}
            screens={screens}
            ColorWheelScreen={ColorWheelScreen}
            wheelReloadNonce={wheelReloadNonce}
            saveColorMatch={saveColorMatch}
            savedColorMatches={savedColorMatches}
            handleLogout={handleLogout}
            handleAccountDeleted={handleAccountDeleted}
            retryLoadColorWheel={retryLoadColorWheel}
          />
        </Suspense>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Minimal loading screen for Suspense fallbacks
function MinimalLoadingScreen() {
  const { View, Text } = require('react-native');
  
  return (
    <View style={minimalStyles.container}>
      <Text style={minimalStyles.text}>🎨 Loading Fashion Color Wheel...</Text>
    </View>
  );
}

const minimalStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  text: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
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
    
    // In production, you might want to log this to a crash reporting service
    if (!__DEV__) {
      // logErrorToService(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <MinimalLoadingScreen />
      );
    }

    return this.props.children;
  }
}

// Main app export with error boundary
export default function App() {
  return (
    <AppErrorBoundary>
      <OptimizedApp />
    </AppErrorBoundary>
  );
}
