// App.js — Ultra-minimal version to test native crash
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Absolute minimal app - no external dependencies
export default function MinimalApp() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🎨 Fashion Color Wheel</Text>
      <Text style={styles.subtitle}>Minimal Test Version</Text>
      <Text style={styles.info}>If you see this, React Native works!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  info: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

// Original app code (temporarily disabled)
/*
import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { AppState } from 'react-native';

// Organized imports
import { loadModules, loadScreens, loadColorWheelScreen, loadErrorBoundary } from './src/utils/moduleLoader';
import { initializeAppConfig } from './src/config/app';
import { useAuth } from './src/hooks/useAuth';
import { useEnhancedColorMatches } from './src/hooks/useEnhancedColorMatches';
import { useColorWheelRetry } from './src/hooks/useColorWheelRetry';
import { LoadingScreen } from './src/components/LoadingScreen';
import { AuthScreens } from './src/components/AuthScreens';
import { AppNavigation } from './src/components/AppNavigation';

// Initialize app configuration
initializeAppConfig();

function OriginalApp() {
  // Load modules with fallbacks
  const { modules } = loadModules();
  const { screens } = loadScreens();
  const { ColorWheelScreen } = loadColorWheelScreen();
  const ErrorBoundary = loadErrorBoundary();

  // Extract modules for easier use
  const {
    StatusBar,
    NavigationContainer,
    createBottomTabNavigator,
    GestureHandlerRootView,
    SafeAreaProvider,
    SafeAreaView,
    Updates,
  } = modules;

  // Create Tab navigator
  const Tab = createBottomTabNavigator();

  // State management hooks
  const [showSignUp, setShowSignUp] = useState(false);
  const [error] = useState(null);
  
  // Custom hooks for organized state management
  const {
    user,
    loading,
    isInitialized,
    initializeAuth,
    handleLoginSuccess,
    handleSignUpComplete,
    handleLogout,
    handleAccountDeleted,
  } = useAuth();

  const { colorMatches: savedColorMatches, saveColorMatch } = useEnhancedColorMatches();
  const { wheelReloadNonce, retryLoadColorWheel } = useColorWheelRetry(Updates);

  // Initialize app on mount
  useEffect(() => {
    const timeout = setTimeout(() => { initializeAuth(); }, 50);
    return () => clearTimeout(timeout);
  }, [initializeAuth]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && !isInitialized) {
        initializeAuth();
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, [isInitialized, initializeAuth]);

  // Render loading state
  if (loading || !isInitialized) {
    return (
      <LoadingScreen 
        SafeAreaProvider={SafeAreaProvider}
        SafeAreaView={SafeAreaView}
        error={error}
      />
    );
  }

  // Render authentication screens
  if (!user) {
    return (
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
    );
  }

  // Render main app navigation
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
*/
