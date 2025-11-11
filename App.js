// App.js - Simplified Fashion Color Wheel App
import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, LogBox } from 'react-native';
import { enableScreens } from 'react-native-screens';

// Performance optimizations
enableScreens(true);

// Suppress only specific warnings in production
if (!__DEV__) {
  // Ignore only the list of known noisy warnings
  LogBox.ignoreLogs([
    'Setting a timer', // Common React Native timer warnings
    'Require cycle:', // Module dependency cycles
    'componentWillReceiveProps', // Deprecated lifecycle warnings
    // add others you have confirmed are not critical
  ]);
}

// Direct imports (no lazy loading to avoid complexity)
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// App configuration - initialize once at startup
import { initializeAppConfig } from './src/config/app';
import { safeStorage } from './src/utils/safeStorage';
import safeApiService from './src/services/safeApiService';

// Error monitoring for module loading failures
const reportModuleError = (moduleName, error) => {
  if (__DEV__) {
    console.error(`[ModuleLoader] Failed to import ${moduleName}:`, error);
  } else {
    // In production, send to error monitoring service
    try {
      // Example: Sentry.captureException(error, { tags: { module: moduleName } });
      console.error(`[ModuleLoader] Failed to import ${moduleName}:`, error.message);
    } catch (reportingError) {
      console.error('Failed to report module loading error:', reportingError);
    }
  }
};

// Safe imports with fallbacks to prevent boot crashes
let LoginScreen, ColorWheelScreen, CommunityFeedScreen, BoardsScreen, UserSettingsScreen;
let TabIcon, useAuth;

try {
  LoginScreen = require('./src/screens/LoginScreen/index').default;
} catch (error) {
  reportModuleError('LoginScreen', error);
  console.warn('Failed to import LoginScreen:', error);
  LoginScreen = ({ onLoginSuccess }) => {
    React.useEffect(() => {
      // Auto-login fallback if LoginScreen fails
      const t = setTimeout(() => onLoginSuccess?.({ id: 'fallback', username: 'fallback' }), 1000);
      return () => clearTimeout(t);
    }, [onLoginSuccess]);
    return React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } },
      React.createElement(Text, null, 'Login screen unavailable - auto-logging in...')
    );
  };
}

try {
  ColorWheelScreen = require('./src/screens/ColorWheelScreen/index').default;
} catch (error) {
  reportModuleError('ColorWheelScreen', error);
  console.warn('Failed to import ColorWheelScreen:', error);
  ColorWheelScreen = () => React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } },
    React.createElement(Text, null, 'Color Wheel screen unavailable')
  );
}

try {
  CommunityFeedScreen = require('./src/screens/CommunityFeedScreen').default;
} catch (error) {
  reportModuleError('CommunityFeedScreen', error);
  console.warn('Failed to import CommunityFeedScreen:', error);
  CommunityFeedScreen = () => React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } },
    React.createElement(Text, null, 'Community screen unavailable')
  );
}

try {
  BoardsScreen = require('./src/screens/BoardsScreen').default;
} catch (error) {
  reportModuleError('BoardsScreen', error);
  console.warn('Failed to import BoardsScreen:', error);
  BoardsScreen = () => React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } },
    React.createElement(Text, null, 'Boards screen unavailable')
  );
}

try {
  UserSettingsScreen = require('./src/screens/UserSettingsScreen').default;
} catch (error) {
  reportModuleError('UserSettingsScreen', error);
  console.warn('Failed to import UserSettingsScreen:', error);
  UserSettingsScreen = () => React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } },
    React.createElement(Text, null, 'Settings screen unavailable')
  );
}

try {
  TabIcon = require('./src/components/TabIcon').default;
} catch (error) {
  reportModuleError('TabIcon', error);
  console.warn('Failed to import TabIcon:', error);
  TabIcon = ({ name }) => React.createElement(Text, null, name?.[0] || '?');
}

try {
  useAuth = require('./src/hooks/useAuth').useAuth;
} catch (error) {
  reportModuleError('useAuth', error);
  console.warn('Failed to import useAuth:', error);
  useAuth = () => ({
    user: null,
    loading: false,
    isInitialized: true,
    initializeAuth: async () => {},
    handleLoginSuccess: () => {},
    handleLogout: () => {},
  });
}

// Create Tab Navigator
const Tab = createBottomTabNavigator();

// Simplified App component
function FashionColorWheelApp() {
  const [isLoading, setIsLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);
  const [hasSeenLogin, setHasSeenLogin] = useState(false);
  const initializationAttempted = useRef(false);
  
  // Auth hook with safe destructuring to prevent crashes
  let authHook;
  try {
    authHook = useAuth() || {};
  } catch (error) {
    console.warn('useAuth hook failed:', error);
    authHook = {};
  }
  
  const {
    user = null,
    loading: authLoading = false,
    isInitialized = false,
    initializeAuth = async () => {
      console.warn('Auth not available - using fallback initializeAuth');
    },
    handleLoginSuccess = (userData) => {
      console.warn('Auth not available - using fallback handleLoginSuccess');
    },
    handleLogout = () => {
      console.warn('Auth not available - using fallback handleLogout');
    },
  } = authHook;

  // Custom login success handler that marks login as seen
  const onLoginSuccess = (userData) => {
    setHasSeenLogin(true);
    handleLoginSuccess(userData);
  };

  // Initialize auth - run only once to prevent repeated calls
  useEffect(() => {
    // Prevent repeated initialization attempts
    if (initializationAttempted.current) {
      return;
    }
    
    const initialize = async () => {
      initializationAttempted.current = true;
      
      try {
        // Initialize app configuration first (validates once at startup)
        await initializeAppConfig();
        
        // Initialize secure storage
        await safeStorage.init();
        
        // Initialize API service (await readiness to avoid races)
        await safeApiService.ready;
        
        // Then initialize auth if available
        if (typeof initializeAuth === 'function') {
          try {
            await initializeAuth();
          } catch (err) {
            console.warn('initializeAuth failed:', err);
          }
        } else {
          console.warn('initializeAuth not available; skipping');
        }
        setIsLoading(false);
      } catch (error) {
        console.error('App initialization failed:', error);
        setIsLoading(false);
      }
    };

    initialize();
  }, []); // Empty dependency array - run only once on mount
  
  // Handle case where auth becomes available after initial mount
  useEffect(() => {
    if (!initializationAttempted.current && 
        typeof initializeAuth === 'function' &&
        isLoading) {
      
      const lateInitialize = async () => {
        initializationAttempted.current = true;
        
        try {
          await initializeAuth();
          setIsLoading(false);
        } catch (error) {
          console.error('Late auth initialization failed:', error);
          setIsLoading(false);
        }
      };
      
      lateInitialize();
    }
  }, [initializeAuth, isLoading]); // Only depend on function availability and loading state

  // Stable TabIcon component to avoid re-renders
  const TabIconMemo = useCallback(({ focused, name }) => <TabIcon focused={focused} name={name} />, [TabIcon]);

  // Stable screen options function to prevent re-renders
  const getScreenOptions = useCallback(({ route }) => ({
    tabBarIcon: ({ focused, color, size }) => <TabIconMemo focused={focused} name={route.name} />,
    tabBarActiveTintColor: '#e74c3c',
    tabBarInactiveTintColor: '#7f8c8d',
    headerShown: false,
    lazy: true,
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

    // Login/SignUp screen
    if (!user || !isInitialized || !hasSeenLogin) {
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
              onLoginSuccess={onLoginSuccess}
              onSwitchToSignUp={() => setShowSignUp(true)}
            />
          )}
        </SafeAreaView>
      );
    }

    // Main app with tab navigation
    return (
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="ColorWheel"
          screenOptions={getScreenOptions}
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
        <StatusBar style="auto" />
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
      <FashionColorWheelApp />
    </AppErrorBoundary>
  );
}
