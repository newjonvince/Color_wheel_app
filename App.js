// App.js - Simplified Fashion Color Wheel App
import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, LogBox } from 'react-native';
import { enableScreens } from 'react-native-screens';

// Performance optimizations
enableScreens(true);

// Suppress warnings in production
if (!__DEV__) {
  LogBox.ignoreAllLogs();
}

// Direct imports (no lazy loading to avoid complexity)
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Import screens directly
import LoginScreen from './src/screens/LoginScreen/index';
import ColorWheelScreen from './src/screens/ColorWheelScreen/index';
import CommunityFeedScreen from './src/screens/CommunityFeedScreen';
import BoardsScreen from './src/screens/BoardsScreen';
import UserSettingsScreen from './src/screens/UserSettingsScreen';

// Import components
import TabIcon from './src/components/TabIcon';

// Hooks
import { useAuth } from './src/hooks/useAuth';

// Create Tab Navigator
const Tab = createBottomTabNavigator();

// Simplified App component
function FashionColorWheelApp() {
  const [isLoading, setIsLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);
  const [hasSeenLogin, setHasSeenLogin] = useState(false);
  
  // Auth hook
  const {
    user,
    loading: authLoading,
    isInitialized,
    initializeAuth,
    handleLoginSuccess,
    handleLogout,
  } = useAuth();

  // Custom login success handler that marks login as seen
  const onLoginSuccess = (userData) => {
    setHasSeenLogin(true);
    handleLoginSuccess(userData);
  };

  // Initialize auth
  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeAuth();
        setIsLoading(false);
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setIsLoading(false);
      }
    };

    initialize();
  }, [initializeAuth]);

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
      <GestureHandlerRootView style={styles.fullScreen}>
        <NavigationContainer>
          <Tab.Navigator
            initialRouteName="ColorWheel"
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused }) => (
                <TabIcon focused={focused} name={route.name} />
              ),
              tabBarActiveTintColor: '#e74c3c',
              tabBarInactiveTintColor: '#7f8c8d',
              headerShown: false,
              lazy: true,
            })}
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
      </GestureHandlerRootView>
    );
  };

  // Single SafeAreaProvider wrapper with StatusBar
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {renderContent()}
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
