import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, AppState, Platform, LogBox, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import ApiService from './src/services/api';

// Log API base URL at app startup for debugging
console.log('🚀 App startup - API base:', ApiService.baseURL);

// Deep link support (matches app.json -> expo.scheme: "colorwheel")
const linking = {
  prefixes: ['colorwheel://'],
  config: {
    screens: {
      Community: 'community',
      ColorWheel: 'wheel',
      Profile: 'profile',
      Settings: 'settings',
    },
  },
};

// --- Optional crash/error reporting (Sentry) -------------------------------
// Removed conditional Sentry require to avoid Metro/package issues
// To re-enable: install sentry-expo and uncomment the initialization code
let sentryReady = false;

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
      if (__DEV__) console.log('✅ JS error handler configured');
    } else {
      if (__DEV__) console.warn('⚠️ ErrorUtils not available - JS error handling disabled');
    }
  } catch (setupError) {
    if (__DEV__) console.error('Failed to setup error handling:', setupError);
  }

  // Unhandled promise rejections (helps catch silent network/auth errors)
  try {
    const onUnhandledRejection = (event) => {
      const reason = event?.reason || event;
      const msg = (reason && (reason.message || reason.toString?.())) || 'Unknown rejection';
      if (__DEV__) console.error('🚨 Unhandled promise rejection:', msg);
    };
    // @ts-ignore - RN ships a DOM-like event API for globalThis in Hermes
    globalThis.addEventListener?.('unhandledrejection', onUnhandledRejection);
  } catch (e) {
    if (__DEV__) console.warn('Unhandled rejection handler not installed:', e?.message);
  }
};

setupErrorHandling();

// Tidy logs in production / TestFlight
if (!__DEV__) {
  LogBox.ignoreAllLogs(true);
}

// --- Screens ---------------------------------------------------------------
// Enhanced import debugging for persistent crash
if (__DEV__) console.log('🔍 App.js: Starting screen imports...');

let ColorWheelScreen;
try {
  if (__DEV__) console.log('🔍 App.js: Importing ColorWheelScreen...');
  ColorWheelScreen = require('./src/screens/ColorWheelScreen').default;
  if (__DEV__) console.log('✅ App.js: ColorWheelScreen imported successfully');
} catch (error) {
  if (__DEV__) console.error('🚨 App.js: ColorWheelScreen import failed:', error);
  if (__DEV__) console.error('🚨 App.js: Error details:', error?.message, error?.stack);
  // Fallback component to prevent app crash
  ColorWheelScreen = ({ onLogout }) => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, color: '#ff6b6b', textAlign: 'center', marginBottom: 20 }}>
        Color Wheel Unavailable
      </Text>
      <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 }}>
        The color wheel feature is temporarily unavailable. Please try restarting the app.
      </Text>
      <TouchableOpacity 
        style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8 }}
        onPress={() => onLogout?.()}
      >
        <Text style={{ color: 'white', fontSize: 16 }}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

// UnavailableScreen fallback component
const UnavailableScreen = ({ screenName, onLogout }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
    <Text style={{ fontSize: 18, color: '#ff6b6b', textAlign: 'center', marginBottom: 20 }}>
      {screenName} Unavailable
    </Text>
    <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 }}>
      This feature is temporarily unavailable. Please try restarting the app.
    </Text>
    <TouchableOpacity 
      style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8 }}
      onPress={() => onLogout?.()}
    >
      <Text style={{ color: 'white', fontSize: 16 }}>Back to Login</Text>
    </TouchableOpacity>
  </View>
);

// Safe screen imports with fallbacks
let BoardsScreen, DiscoverScreen, CommunityFeedScreen, LoginScreen, SignUpScreen, UserSettingsScreen;

try {
  if (__DEV__) console.log('🔍 App.js: Importing BoardsScreen...');
  BoardsScreen = require('./src/screens/BoardsScreen').default;
} catch (error) {
  if (__DEV__) console.error('🚨 App.js: BoardsScreen import failed:', error);
  BoardsScreen = (props) => <UnavailableScreen screenName="Boards" {...props} />;
}

try {
  if (__DEV__) console.log('🔍 App.js: Importing DiscoverScreen...');
  DiscoverScreen = require('./src/screens/DiscoverScreen').default;
} catch (error) {
  if (__DEV__) console.error('🚨 App.js: DiscoverScreen import failed:', error);
  DiscoverScreen = (props) => <UnavailableScreen screenName="Discover" {...props} />;
}

try {
  if (__DEV__) console.log('🔍 App.js: Importing CommunityFeedScreen...');
  CommunityFeedScreen = require('./src/screens/CommunityFeedScreen').default;
} catch (error) {
  if (__DEV__) console.error('🚨 App.js: CommunityFeedScreen import failed:', error);
  CommunityFeedScreen = (props) => <UnavailableScreen screenName="Community" {...props} />;
}

try {
  if (__DEV__) console.log('🔍 App.js: Importing LoginScreen...');
  LoginScreen = require('./src/screens/LoginScreen').default;
} catch (error) {
  if (__DEV__) console.error('🚨 App.js: LoginScreen import failed:', error);
  LoginScreen = (props) => <UnavailableScreen screenName="Login" {...props} />;
}

try {
  if (__DEV__) console.log('🔍 App.js: Importing SignUpScreen...');
  SignUpScreen = require('./src/screens/SignUpScreen').default;
} catch (error) {
  if (__DEV__) console.error('🚨 App.js: SignUpScreen import failed:', error);
  SignUpScreen = (props) => <UnavailableScreen screenName="Sign Up" {...props} />;
}

try {
  if (__DEV__) console.log('🔍 App.js: Importing UserSettingsScreen...');
  UserSettingsScreen = require('./src/screens/UserSettingsScreen').default;
} catch (error) {
  if (__DEV__) console.error('🚨 App.js: UserSettingsScreen import failed:', error);
  UserSettingsScreen = (props) => <UnavailableScreen screenName="Settings" {...props} />;
}

if (__DEV__) console.log('✅ App.js: All screens imported with fallbacks');

// Components
import ErrorBoundary from './src/components/ErrorBoundary';

const Tab = createBottomTabNavigator();

// Helper: normalize various callback shapes to a user object
const pickUser = (u) => (u?.user ? u.user : u);

// Emoji tab icon (memoized)
const EmojiTabIcon = React.memo(({ name, focused }) => {
  const icons = {
    Community: focused ? '🌍' : '🌎',
    ColorWheel: focused ? '⚙️' : '⚪',
    Profile: focused ? '👤' : '👥',
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

      // Read token from SecureStore first, fallback to AsyncStorage (handle old & new keys)
      let token = null;
      try {
        token = await SecureStore?.getItemAsync?.('fashion_color_wheel_auth_token');
        if (!token) token = await SecureStore?.getItemAsync?.('authToken');
        if (!token) token = await AsyncStorage.getItem('authToken');
      } catch (storageError) {
        if (__DEV__) console.error('📱 Storage access error:', storageError?.message);
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
      await SecureStore?.deleteItemAsync?.('fashion_color_wheel_auth_token');
      await SecureStore?.deleteItemAsync?.('authToken'); // legacy
      await AsyncStorage.removeItem('authToken');
      if (__DEV__) console.log('🗑️ Stored token cleared');
    } catch (error) {
      if (__DEV__) console.error('Failed to clear token:', error?.message);
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
      console.log('App: Loading saved color matches for user');
      
      // Try to load from backend first
      try {
        const backendMatches = typeof ApiService.getUserColorMatches === 'function'
          ? await ApiService.getUserColorMatches()
          : null;
        if (Array.isArray(backendMatches)) {
          if (__DEV__) console.log('App: Loaded', backendMatches.length, 'color matches from backend');
          setSavedColorMatches(backendMatches);
          // Also save to local storage as backup
          if (backendMatches.length > 0) {
            await AsyncStorage.setItem(key, JSON.stringify(backendMatches));
          }
          return;
        }
      } catch (backendError) {
        console.warn('Backend load failed, falling back to local storage:', backendError);
      }
      
      // Fallback to local storage
      const saved = await AsyncStorage.getItem(key);
      const localMatches = saved ? JSON.parse(saved) : [];
      console.log('App: Loaded', localMatches.length, 'color matches from local storage');
      setSavedColorMatches(localMatches);
      
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
      console.log('App: Saving color match:', colorMatch);
      
      // Validate colorMatch structure to prevent crashes
      if (!colorMatch || typeof colorMatch !== 'object') {
        throw new Error('Invalid color match data: must be an object');
      }
      
      if (!colorMatch.colors || !Array.isArray(colorMatch.colors) || colorMatch.colors.length === 0) {
        throw new Error('Invalid color match data: colors array is required and must not be empty');
      }
      
      if (!colorMatch.base_color || typeof colorMatch.base_color !== 'string') {
        throw new Error('Invalid color match data: base_color is required and must be a string');
      }
      
      if (!colorMatch.scheme || typeof colorMatch.scheme !== 'string') {
        throw new Error('Invalid color match data: scheme is required and must be a string');
      }
      
      // Save to backend first
      try {
        const savedResp = await ApiService.createColorMatch({
          base_color: colorMatch.base_color,
          scheme: colorMatch.scheme,
          colors: colorMatch.colors,
          title: colorMatch.title || `${colorMatch.scheme} palette`,
          description: colorMatch.description || '',
          is_public: colorMatch.is_public || false
        });
        const savedMatch = (savedResp && savedResp.data) ? savedResp.data : savedResp;
        console.log('App: Color match saved to backend:', savedMatch);
        // Update local state with backend response (includes ID)
        const updated = [...savedColorMatches, savedMatch];
        setSavedColorMatches(updated);
        // Also save to local storage as backup
        const key = getMatchesKey(user?.id);
        await AsyncStorage.setItem(key, JSON.stringify(updated));
        return savedMatch;
      } catch (backendError) {
        console.error('Backend save failed, saving locally only:', backendError);
        
        // Fallback to local storage only
        const key = getMatchesKey(user?.id);
        const localMatch = { ...colorMatch, id: Date.now().toString(), created_at: new Date().toISOString() };
        const updated = [...savedColorMatches, localMatch];
        setSavedColorMatches(updated);
        await AsyncStorage.setItem(key, JSON.stringify(updated));
        
        return localMatch;
      }
    } catch (error) {
      console.error('Error saving color match:', error);
      throw error;
    }
  }, [user?.id, savedColorMatches]);

  // Helper: normalize various callback shapes to a user object
  const pickUser = (u) => {
    console.log('🔍 App.js: pickUser called with:', u);
    if (!u) return null;
    return u?.user ? u.user : u;
  };

  const handleLoginSuccess = useCallback(async (u) => {
    console.log('🔍 App.js: handleLoginSuccess called with:', u);
    
    try {
      const nextUser = pickUser(u);
      console.log('🔍 App.js: pickUser result:', nextUser);
      
      // if the LoginScreen passes back a token, set it now
      try { 
        if (u && (u.token || u.authToken)) { 
          console.log('🔍 App.js: Setting token from login response');
          ApiService.setToken?.(u.token || u.authToken); 
        } 
      } catch (tokenError) {
        console.error('🚨 App.js: Token setting error:', tokenError);
      }
      
      console.log('🔍 App.js: Setting user state...');
      setUser(nextUser);
      console.log('🔍 App.js: User state set successfully');
    } catch (error) {
      console.error('🚨 App.js: handleLoginSuccess error:', error);
      console.error('🚨 App.js: Error name:', error?.name);
      console.error('🚨 App.js: Error message:', error?.message);
      console.error('🚨 App.js: Error stack:', error?.stack);
      throw error; // Re-throw to trigger ErrorBoundary
    }
    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(nextUser));
    } catch (error) {
      console.error('Error saving login state:', error);
    }
  }, []);

  const handleSignUpComplete = useCallback(async (u) => {
    const nextUser = pickUser(u);
    // if the LoginScreen passes back a token, set it now
    try { if (u && (u.token || u.authToken)) { ApiService.setToken?.(u.token || u.authToken); } } catch {}
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
      ApiService.setToken?.(null);
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
      ApiService.setToken?.(null);
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
          <NavigationContainer linking={linking} fallback={<Text>Loading…</Text>}>
            <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
            <Tab.Navigator
              detachInactiveScreens={true}
              initialRouteName="ColorWheel"
              screenOptions={({ route }) => ({
                tabBarIcon: ({ focused }) => <EmojiTabIcon focused={focused} name={route.name} />,
                tabBarActiveTintColor: '#e74c3c',
                tabBarInactiveTintColor: '#7f8c8d',
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabLabel,
                headerShown: false,
              })}
            >
              <Tab.Screen name="ColorWheel" options={{ title: 'Wheel' }}>
                {(props) => (
                  <ColorWheelScreen
                    {...props}
                    currentUser={user || null}
                    onSaveColorMatch={saveColorMatch || (() => {
                      console.warn('saveColorMatch not available');
                      return Promise.resolve();
                    })}
                    onLogout={handleLogout || (() => {
                      console.warn('handleLogout not available');
                    })}
                    navigation={props?.navigation}
                  />
                )}
              </Tab.Screen>

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

              <Tab.Screen name="Profile" options={{ title: 'Profile' }}>
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
