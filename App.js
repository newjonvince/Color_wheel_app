import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, AppState, Platform, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import ApiService from './src/services/api';

// --- Optional crash/error reporting (Sentry) -------------------------------
let sentryReady = false;
try {
  // Only attempt to load Sentry when DSN is set (Expo: app.json -> expo.extra.public.SENTRY_DSN or EXPO_PUBLIC_SENTRY_DSN)
  const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (SENTRY_DSN) {
    // Lazy require so local dev without the dep won't crash
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('sentry-expo');
    Sentry.init({
      dsn: SENTRY_DSN,
      enableInExpoDevelopment: true,
      debug: __DEV__,
      tracesSampleRate: 0.1,
    });
    sentryReady = true;
    console.log('✅ Sentry initialized');
  }
} catch (e) {
  console.warn('Sentry init skipped:', e?.message);
}

// --- Global JS error + unhandled rejection handling -----------------------
let isErrorHandlerActive = false;
const setupErrorHandling = () => {
  try {
    // Guard ErrorUtils access carefully (Hermes + RN versions can vary)
    if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
      const originalHandler = ErrorUtils.getGlobalHandler();
      const jsErrorHandler = (error, isFatal) => {
        if (isErrorHandlerActive) return;
        isErrorHandlerActive = true;
        try {
          console.error('🚨 JS Error:', error?.message || error, 'isFatal:', isFatal);
          console.error('Stack:', error?.stack);
          // pass through to RN's default
          if (typeof originalHandler === 'function') originalHandler(error, isFatal);
        } catch (handlerError) {
          console.error('Error in JS error handler:', handlerError);
        } finally {
          isErrorHandlerActive = false;
        }
      };
      ErrorUtils.setGlobalHandler(jsErrorHandler);
      console.log('✅ JS error handler configured');
    } else {
      console.warn('⚠️ ErrorUtils not available - JS error handling disabled');
    }
  } catch (setupError) {
    console.error('Failed to setup error handling:', setupError);
  }

  // Unhandled promise rejections (helps catch silent network/auth errors)
  try {
    const onUnhandledRejection = (event) => {
      const reason = event?.reason || event;
      const msg = (reason && (reason.message || reason.toString?.())) || 'Unknown rejection';
      console.error('🚨 Unhandled promise rejection:', msg);
    };
    // @ts-ignore - RN ships a DOM-like event API for globalThis in Hermes
    globalThis.addEventListener?.('unhandledrejection', onUnhandledRejection);
  } catch (e) {
    console.warn('Unhandled rejection handler not installed:', e?.message);
  }
};

setupErrorHandling();

// Tidy logs in production / TestFlight
if (!__DEV__) {
  LogBox.ignoreAllLogs(true);
}

// --- Screens ---------------------------------------------------------------
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

      // Protect against hanging init on TestFlight
      initTimeout = setTimeout(() => {
        console.error('⏰ App initialization timeout');
        setLoading(false);
        setIsInitialized(true);
      }, 10000);

      // Give native modules a tick to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Read token from SecureStore first, fallback to AsyncStorage
      let token = null;
      try {
        if (SecureStore?.getItemAsync) {
          token = await SecureStore.getItemAsync('authToken');
        }
        if (!token) {
          token = await AsyncStorage.getItem('authToken');
        }
      } catch (storageError) {
        console.error('📱 Storage access error:', storageError?.message);
        // Continue without token
      }

      if (token) {
        try {
          ApiService?.setToken?.(token);
          // Validate token quickly
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          );

          let profile = null;
          if (ApiService?.getUserProfile) {
            profile = await Promise.race([ApiService.getUserProfile(), timeoutPromise]);
          } else {
            // fallback to stored userData
            const storedUserData = await AsyncStorage.getItem('userData');
            if (storedUserData) profile = JSON.parse(storedUserData);
          }

          if (profile?.id) {
            setUser(profile);
            await loadSavedColorMatches(getMatchesKey(profile.id));
          } else {
            await clearStoredToken();
          }
        } catch (profileError) {
          console.warn('Profile validation failed, falling back:', profileError?.message);
          // Fallback to stored userData
          const storedUserData = await AsyncStorage.getItem('userData');
          if (storedUserData) {
            const userData = JSON.parse(storedUserData);
            setUser(userData);
            await loadSavedColorMatches(getMatchesKey(userData.id));
          } else {
            await clearStoredToken();
          }
        }
      }

      clearTimeout(initTimeout);
      setIsInitialized(true);
    } catch (e) {
      console.error('❌ App initialization error:', e?.message);
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
      await SecureStore?.deleteItemAsync?.('authToken');
      await AsyncStorage.removeItem('authToken');
      console.log('🗑️ Stored token cleared');
    } catch (error) {
      console.error('Failed to clear token:', error?.message);
    }
  };

  useEffect(() => {
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

  const loadSavedColorMatches = useCallback(async (key) => {
    try {
      const saved = await AsyncStorage.getItem(key);
      setSavedColorMatches(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.error('Error loading saved color matches:', error);
      setSavedColorMatches([]);
    }
  }, []);

  // Load color matches when user changes
  useEffect(() => {
    if (user?.id) {
      loadSavedColorMatches(getMatchesKey(user.id));
    }
  }, [user?.id, loadSavedColorMatches]);

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
    const nextUser = pickUser(u);
    setUser(nextUser);
    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(nextUser));
    } catch (error) {
      console.error('Error saving login state:', error);
    }
  }, []);

  const handleSignUpComplete = useCallback(async (u) => {
    const nextUser = pickUser(u);
    setUser(nextUser);
    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(nextUser));
      await loadSavedColorMatches(getMatchesKey(nextUser?.id));
    } catch (error) {
      console.warn('Error storing user data in AsyncStorage:', error);
    }
  }, [loadSavedColorMatches]);

  const handleLogout = useCallback(async () => {
    try {
      await ApiService.logout?.();
      await ApiService.clearToken?.();
      await AsyncStorage.removeItem('isLoggedIn');
      await AsyncStorage.removeItem('userData');
      setUser(null);
      await loadSavedColorMatches(getMatchesKey(null));
    } catch (error) {
      console.error('Error logging out:', error);
      setUser(null);
      await loadSavedColorMatches(getMatchesKey(null));
    }
  }, [loadSavedColorMatches]);

  const handleAccountDeleted = useCallback(async () => {
    try {
      await ApiService.clearToken?.();
      const keysToRemove = ['isLoggedIn', 'userData', getMatchesKey(user?.id)];
      await AsyncStorage.multiRemove(keysToRemove);
      setSavedColorMatches([]);
      setUser(null);
      await loadSavedColorMatches(getMatchesKey(null));
    } catch (error) {
      console.error('Error clearing data after account deletion:', error);
      setUser(null);
      await loadSavedColorMatches(getMatchesKey(null));
    }
  }, [user?.id, loadSavedColorMatches]);

  // Optional: Auto-reload on OTA update (helps TestFlight sessions)
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // ignore
      }
    };
    if (!__DEV__) checkUpdates();
  }, []);

  // --- Render ----------------------------------------------------------------
  if (loading || !isInitialized) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
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
            <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarIcon: ({ focused }) => <EmojiTabIcon focused={focused} name={route.name} />,
                tabBarActiveTintColor: '#e74c3c',
                tabBarInactiveTintColor: '#7f8c8d',
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabLabel,
                headerShown: false,
              })}
            >
              <Tab.Screen name="Community" options={{ title: 'Community' }}>
                {(props) => (
                  <CommunityFeedScreen
                    {...props}
                    currentUser={user}
                    onSaveColorMatch={saveColorMatch}
                    onLogout={handleLogout}
                  />
                )}
              </Tab.Screen>

              <Tab.Screen name="ColorWheel" options={{ title: 'Wheel' }}>
                {(props) => (
                  <ColorWheelScreen
                    {...props}
                    currentUser={user}
                    onSaveColorMatch={saveColorMatch}
                    onLogout={handleLogout}
                  />
                )}
              </Tab.Screen>

              <Tab.Screen name="Boards" options={{ title: 'My Boards' }}>
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

              <Tab.Screen name="Settings" options={{ title: 'Settings' }}>
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
