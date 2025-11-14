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
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ColorWheelScreen from './src/screens/ColorWheelScreen';
import CommunityFeedScreen from './src/screens/CommunityFeedScreen';
import BoardsScreen from './src/screens/BoardsScreen';
import UserSettingsScreen from './src/screens/UserSettingsScreen';
import TabIcon from './src/components/TabIcon';
import StorageErrorBoundary from './src/components/StorageErrorBoundary';
import { useAuth } from './src/hooks/useAuth';

// Create Tab Navigator
const Tab = createBottomTabNavigator();

// Simplified App component
function FashionColorWheelApp() {
  const [isLoading, setIsLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);
  
  // Auth hook - let error boundary catch render-time errors
  const {
    user = null,
    loading: authLoading = false,
    isInitialized = false,
    initializeAuth = async () => {},
    handleLoginSuccess = () => {},
    handleLogout = () => {},
  } = useAuth();

  // Initialize app - sequential for dependency safety, parallel where safe
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🔄 Starting app initialization...');
        
        // Step 1: Initialize app config first (required for other steps)
        await initializeAppConfig();
        console.log('✅ initializeAppConfig() completed');

        // Step 2: Initialize storage layer (required by API service and auth)
        try {
          await safeStorage.init();
          console.log('✅ safeStorage.init() completed');
        } catch (storageError) {
          console.error('❌ safeStorage.init() failed:', storageError);
          // Continue anyway - safeStorage has internal fallbacks
          console.warn('⚠️ Continuing with limited storage functionality');
        }

        // Step 3: Run API service and auth initialization in parallel (both depend on storage)
        console.log('🔄 Starting parallel API and auth initialization...');
        await Promise.all([
          safeApiService.ready.then(() => console.log('✅ safeApiService.ready completed')).catch(e => { console.error('❌ safeApiService.ready failed:', e); throw e; }),
          initializeAuth().then(() => console.log('✅ initializeAuth() completed')).catch(e => { console.error('❌ initializeAuth() failed:', e); throw e; }),
        ]);
        
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
  }, [initializeAuth]);
  

  // Stable TabIcon component to avoid re-renders
  const TabIconMemo = useCallback(({ focused, name }) => <TabIcon focused={focused} name={name} />, []);

  // Stable screen options function using APP_CONFIG
  const getScreenOptions = useCallback(({ route }) => ({
    tabBarIcon: ({ focused, color, size }) => <TabIconMemo focused={focused} name={route.name} />,
    ...APP_CONFIG.tabNavigation.screenOptions,
  }), [TabIconMemo]);

  // Render content based on app state
  const renderContent = () => {
    // Loading screen
    if (isLoading || authLoading) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🎨 Loading Fashion Color Wheel...</Text>
        </SafeAreaView>
      );
    }

    // Login/SignUp screen - simple authentication gating
    if (!isInitialized || !user) {
      return (
        <SafeAreaView style={styles.container}>
          {showSignUp ? (
            <View style={styles.authContainer}>
              <Text style={styles.authTitle}>Sign Up</Text>
              <Text style={styles.authSubtitle}>Create your account</Text>
              <Text 
                style={styles.switchAuth}
                onPress={() => setShowSignUp(false)}
              >
                Already have an account? Login
              </Text>
            </View>
          ) : (
            <LoginScreen 
              onLoginSuccess={handleLoginSuccess}
              onSwitchToSignUp={() => setShowSignUp(true)}
            />
          )}
        </SafeAreaView>
      );
    }

    // Main app with tab navigation
    return (
      <NavigationContainer linking={APP_CONFIG.linking}>
        <Tab.Navigator
          initialRouteName={APP_CONFIG.tabNavigation.initialRouteName}
          screenOptions={getScreenOptions}
          {...APP_CONFIG.tabNavigation.options}
        >
          <Tab.Screen 
            name="ColorWheel" 
            component={ColorWheelScreen}
            options={{ title: 'Color Wheel' }}
          />
          <Tab.Screen 
            name="Community" 
            component={CommunityFeedScreen}
            options={{ title: 'Community' }}
          />
          <Tab.Screen 
            name="Profile" 
            component={BoardsScreen}
            options={{ title: 'Profile' }}
          />
          <Tab.Screen 
            name="Settings" 
            component={UserSettingsScreen}
            options={{ title: 'Settings' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    );
  };

  // Top-level wrapper with GestureHandlerRootView for gesture library stability
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.fullScreen}>
        <StatusBar style={getStatusBarStyle()} />
        {renderContent()}
      </GestureHandlerRootView>
    </SafeAreaProvider>
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

// Main app export with error boundary
export default function App() {
  return (
    <AppErrorBoundary>
      <StorageErrorBoundary>
        <FashionColorWheelApp />
      </StorageErrorBoundary>
    </AppErrorBoundary>
  );
}
