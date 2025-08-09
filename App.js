import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Alert, AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import ApiService from './src/services/api';

// Global error handler for unhandled promise rejections and crashes
let isErrorHandlerActive = false;
const originalHandler = ErrorUtils?.getGlobalHandler?.();

const safeErrorHandler = (error, isFatal) => {
  if (isErrorHandlerActive) return; // Prevent recursive errors
  isErrorHandlerActive = true;
  
  try {
    console.error('🚨 Global error handler:', error?.message || error, 'isFatal:', isFatal);
    
    // For fatal errors, prevent app termination
    if (isFatal) {
      console.error('🚨 Fatal error prevented:', error?.stack || error);
      // Don't show alert during initialization to prevent crashes
      setTimeout(() => {
        Alert.alert(
          'App Error',
          'An error occurred. Please restart the app if issues persist.',
          [{ text: 'OK' }]
        );
      }, 1000);
      return; // Prevent calling original handler for fatal errors
    }
    
    // Call original handler for non-fatal errors only
    if (originalHandler && typeof originalHandler === 'function') {
      originalHandler(error, false); // Force non-fatal
    }
  } catch (handlerError) {
    console.error('Error in error handler:', handlerError);
  } finally {
    isErrorHandlerActive = false;
  }
};

// Set global error handler with safety checks
if (ErrorUtils && typeof ErrorUtils.setGlobalHandler === 'function') {
  ErrorUtils.setGlobalHandler(safeErrorHandler);
}

// Handle unhandled promise rejections
if (typeof global !== 'undefined') {
  global.addEventListener?.('unhandledRejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
    event.preventDefault(); // Prevent crash
  });
}

// Screens
import ColorWheelScreen from './src/screens/ColorWheelScreen';
import BoardsScreen from './src/screens/BoardsScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import CommunityFeedScreen from './src/screens/CommunityFeedScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import UserSettingsScreen from './src/screens/UserSettingsScreen';

// Components
import ErrorBoundary from './src/components/ErrorBoundary';

const Tab = createBottomTabNavigator();

// Helper: normalize various callback shapes to a user object
const pickUser = (u) => (u?.user ? u.user : u);

// Emoji tab icon (memoized)
const EmojiTabIcon = React.memo(({ name, focused }) => {
  const icons = {
    Community: focused ? '🏠' : '🏘️',
    ColorWheel: focused ? '🎨' : '🎭',
    Boards: focused ? '📌' : '📋',
    Settings: focused ? '⚙️' : '🔧',
  };
  return <Text style={styles.tabIcon}>{icons[name] || '📱'}</Text>;
});

// Helper: get storage key for color matches based on user ID
const getMatchesKey = (userId) => `savedColorMatches:${userId || 'anon'}`;

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [savedColorMatches, setSavedColorMatches] = useState([]);

  // Safe initialization with multiple fallbacks
  const initializeApp = useCallback(async () => {
    let initTimeout;
    try {
      console.log('🚀 Starting app initialization...');
      
      // Set initialization timeout
      initTimeout = setTimeout(() => {
        console.error('⏰ App initialization timeout');
        setLoading(false);
        setIsInitialized(true);
      }, 10000);

      // Wait for native modules to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if SecureStore is available
      let token = null;
      try {
        if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
          token = await SecureStore.getItemAsync('authToken');
          console.log('📱 SecureStore token check:', token ? 'found' : 'not found');
        } else {
          console.log('📱 SecureStore not available, checking AsyncStorage...');
          token = await AsyncStorage.getItem('authToken');
        }
      } catch (storageError) {
        console.error('📱 Storage access error:', storageError.message);
        // Continue without token
      }
      
      if (token) {
        console.log('📱 Token found, setting on ApiService and validating...');
        try {
          // Set token on ApiService before making requests
          if (ApiService.setToken && typeof ApiService.setToken === 'function') {
            ApiService.setToken(token);
            console.log('✅ Token set on ApiService');
          } else {
            console.warn('⚠️ ApiService.setToken method not available');
          }
          
          // Validate token with shorter timeout for faster startup
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          );
          
          const profile = await Promise.race([
            ApiService.getUserProfile(),
            timeoutPromise
          ]);
          
          if (profile && profile.id) {
            console.log('✅ User authenticated:', profile.username);
            setUser(profile);
            // Load saved color matches for the authenticated user
            await loadSavedColorMatches(getMatchesKey(profile.id));
            console.log('✅ User color matches loaded');
          } else {
            console.log('❌ Invalid profile response');
            await clearStoredToken();
          }
        } catch (profileError) {
          console.error('❌ Profile validation error:', profileError.message);
          await clearStoredToken();
        }
      } else {
        console.log('📱 No stored token found');
      }
      
      clearTimeout(initTimeout);
      setIsInitialized(true);
      
    } catch (error) {
      console.error('❌ App initialization error:', error.message);
      if (initTimeout) clearTimeout(initTimeout);
      setError('Failed to initialize app');
      setIsInitialized(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Safe token clearing helper
  const clearStoredToken = async () => {
    try {
      if (SecureStore && typeof SecureStore.deleteItemAsync === 'function') {
        await SecureStore.deleteItemAsync('authToken');
      }
      await AsyncStorage.removeItem('authToken');
      console.log('🗑️ Stored token cleared');
    } catch (error) {
      console.error('Failed to clear token:', error.message);
    }
  };

  useEffect(() => {
    // Delay initialization slightly to ensure native modules are ready
    const initTimer = setTimeout(() => {
      initializeApp();
    }, 50);
    
    return () => clearTimeout(initTimer);
  }, [initializeApp]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && !isInitialized) {
        console.log('📱 App became active, reinitializing...');
        initializeApp();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isInitialized, initializeApp]);

  // Load color matches when user changes
  useEffect(() => {
    if (user?.id) {
      loadSavedColorMatches(getMatchesKey(user.id));
    }
  }, [user?.id, loadSavedColorMatches]);

  const loadSavedColorMatches = useCallback(async (key) => {
    try {
      const saved = await AsyncStorage.getItem(key);
      setSavedColorMatches(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.error('Error loading saved color matches:', error);
      setSavedColorMatches([]);
    }
  }, []);

  const saveColorMatch = useCallback(async (colorMatch) => {
    try {
      const key = getMatchesKey(user?.id);
      const updated = [...savedColorMatches, colorMatch];
      setSavedColorMatches(updated);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving color match:', error);
    }
  }, [user?.id, savedColorMatches]);

  const handleLoginSuccess = useCallback(async (u) => {
    const user = pickUser(u);
    setUser(user);

    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      console.log('✅ Login successful, user data saved');
      // Color matches will be loaded by useEffect when user.id changes
    } catch (error) {
      console.error('Error saving login state:', error);
      // Continue anyway - user is logged in, just storage failed
    }
  }, []);

  const handleSignUpComplete = useCallback(async (u) => {
    const user = pickUser(u);
    setUser(user);

    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      await loadSavedColorMatches(getMatchesKey(user?.id));
    } catch (error) {
      console.warn('Error storing user data in AsyncStorage:', error);
    }
  }, [loadSavedColorMatches]);

  const handleLogout = useCallback(async () => {
    try {
      await ApiService.logout?.();
      await ApiService.clearToken?.(); // ensure secure token is wiped

      await AsyncStorage.removeItem('isLoggedIn');
      await AsyncStorage.removeItem('userData');

      setUser(null);

      // Load anon saved data for post-logout state
      await loadSavedColorMatches(getMatchesKey(null));
    } catch (error) {
      console.error('Error logging out:', error);
      setUser(null);
      await loadSavedColorMatches(getMatchesKey(null));
    }
  }, [loadSavedColorMatches]);

  const handleAccountDeleted = useCallback(async () => {
    try {
      // Clear secure token too
      await ApiService.clearToken?.();

      // Remove known keys; avoid blind clear unless you want to wipe all app data
      const keysToRemove = ['isLoggedIn', 'userData', getMatchesKey(user?.id)];
      await AsyncStorage.multiRemove(keysToRemove);

      setSavedColorMatches([]);
      setUser(null);

      // After delete, load anon scope (should be empty unless you keep demo state)
      await loadSavedColorMatches(getMatchesKey(null));
    } catch (error) {
      console.error('Error clearing data after account deletion:', error);
      setUser(null);
      await loadSavedColorMatches(getMatchesKey(null));
    }
  }, [user?.id, loadSavedColorMatches]);

  // Show loading state with timeout protection
  if (loading || !isInitialized) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar style="auto" />
          {showSignUp ? (
            <SignUpScreen
              onSignUpComplete={handleSignUpComplete}
              onBack={() => setShowSignUp(false)}
            />
          ) : (
            <LoginScreen
              onLoginSuccess={handleLoginSuccess}
              onSignUpPress={() => setShowSignUp(true)}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NavigationContainer>
            <StatusBar style="auto" />
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarIcon: ({ focused }) => (
                  <EmojiTabIcon focused={focused} name={route.name} />
                ),
                tabBarActiveTintColor: '#e74c3c',
                tabBarInactiveTintColor: '#7f8c8d',
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabLabel,
                headerShown: false,
              })}
            >
              <Tab.Screen 
                name="Community" 
                options={{ title: 'Community' }}
              >
                {(props) => (
                  <CommunityFeedScreen 
                    {...props} 
                    currentUser={user}
                    onSaveColorMatch={saveColorMatch}
                    onLogout={handleLogout}
                  />
                )}
              </Tab.Screen>
              
              <Tab.Screen 
                name="ColorWheel" 
                options={{ title: 'Wheel' }}
              >
                {(props) => (
                  <ColorWheelScreen 
                    {...props} 
                    currentUser={user}
                    onSaveColorMatch={saveColorMatch}
                    onLogout={handleLogout}
                  />
                )}
              </Tab.Screen>
              
              <Tab.Screen 
                name="Boards" 
                options={{ title: 'My Boards' }}
              >
                {(props) => (
                  <BoardsScreen 
                    {...props} 
                    currentUser={user}
                    savedColorMatches={savedColorMatches}
                    onSaveColorMatch={saveColorMatch}
                    onLogout={handleLogout}
                  />
                )}
              </Tab.Screen>
              
              <Tab.Screen 
                name="Settings" 
                options={{ title: 'Settings' }}
              >
                {(props) => (
                  <UserSettingsScreen 
                    {...props} 
                    currentUser={user}
                    onLogout={handleLogout}
                    onAccountDeleted={handleAccountDeleted}
                  />
                )}
              </Tab.Screen>
            </Tab.Navigator>
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 10,
  },
  tabBar: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingBottom: 5,
    paddingTop: 5,
    height: 65,
  },
  tabIcon: { fontSize: 24 },
  tabLabel: { fontSize: 12, fontWeight: '600' },
});
