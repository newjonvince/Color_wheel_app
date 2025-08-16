// App.patched.js — hardened App entry with retry for ColorWheel import
import 'react-native-gesture-handler';
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

// Production error handler to capture fatal JS errors
if (!__DEV__ && global?.ErrorUtils?.setGlobalHandler) {
  const old = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((err, isFatal) => {
    console.log('JS Fatal:', isFatal, err?.message, err?.stack); // or POST to your server
    old?.(err, isFatal);
  });
}
import ApiService from './src/services/api';

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
let sentryReady = FalseLikeToAvoidTreeShaking(); // tiny trick to keep block intact
function FalseLikeToAvoidTreeShaking(){ return false; }
try {
  const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (SENTRY_DSN) {
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
    if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
      const originalHandler = ErrorUtils.getGlobalHandler();
      const jsErrorHandler = (error, isFatal) => {
        if (isErrorHandlerActive) return;
        isErrorHandlerActive = true;
        try {
          console.error('🚨 JS Error:', error?.message || error, 'isFatal:', isFatal);
          console.error('Stack:', error?.stack);
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

  try {
    const onUnhandledRejection = (event) => {
      const reason = event?.reason || event;
      const msg = (reason && (reason.message || reason.toString?.())) || 'Unknown rejection';
      console.error('🚨 Unhandled promise rejection:', msg);
    };
    globalThis.addEventListener?.('unhandledrejection', onUnhandledRejection);
  } catch (e) {
    console.warn('Unhandled rejection handler not installed:', e?.message);
  }
};
setupErrorHandling();

if (!__DEV__) {
  LogBox.ignoreAllLogs(true);
}

// --- Screens (with resilient fallback) ------------------------------------
console.log('🔍 App.js: Starting screen imports...');

let ColorWheelScreen;
try {
  console.log('🔍 App.js: Importing ColorWheelScreen...');
  ColorWheelScreen = require('./src/screens/ColorWheelScreen').default;
  console.log('✅ App.js: ColorWheelScreen imported successfully');
} catch (error) {
  console.error('🚨 ColorWheelScreen import failed:', error);
  const FallbackWheel = ({ onLogout, onRetry }) => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, color: '#ff6b6b', textAlign: 'center', marginBottom: 12 }}>
        Color Wheel Unavailable
      </Text>
      <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 }}>
        The color wheel feature is temporarily unavailable. Try reloading the wheel or restarting the app.
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity 
          style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginRight: 12 }}
          onPress={() => onRetry?.()}
        >
          <Text style={{ color: 'white', fontSize: 16 }}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ backgroundColor: '#888', padding: 12, borderRadius: 8 }}
          onPress={() => onLogout?.()}
        >
          <Text style={{ color: 'white', fontSize: 16 }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  ColorWheelScreen = FallbackWheel;
}

let BoardsScreen, DiscoverScreen, CommunityFeedScreen, LoginScreen, SignUpScreen, UserSettingsScreen;
try {
  console.log('🔍 App.js: Importing other screens...');
  BoardsScreen = require('./src/screens/BoardsScreen').default;
  DiscoverScreen = require('./src/screens/DiscoverScreen').default;
  CommunityFeedScreen = require('./src/screens/CommunityFeedScreen').default;
  LoginScreen = require('./src/screens/LoginScreen').default;
  SignUpScreen = require('./src/screens/SignUpScreen').default;
  UserSettingsScreen = require('./src/screens/UserSettingsScreen').default;
  console.log('✅ App.js: All other screens imported successfully');
} catch (error) {
  console.error('🚨 App.js: Other screens import failed:', error);
}

// Safe fallback components for any screens that failed to import
const makePlaceholder = (title) => (props) => (
  <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:20 }}>
    <Text style={{ fontSize:18, marginBottom:8 }}>{title || 'Screen Unavailable'}</Text>
    <Text style={{ fontSize:13, color:'#666', textAlign:'center' }}>
      This screen failed to load. Try restarting the app.
    </Text>
  </View>
);
if (!BoardsScreen)        BoardsScreen = makePlaceholder('Profile Unavailable');
if (!CommunityFeedScreen) CommunityFeedScreen = makePlaceholder('Community Unavailable');
if (!UserSettingsScreen)  UserSettingsScreen = makePlaceholder('Settings Unavailable');
if (!LoginScreen)         LoginScreen = makePlaceholder('Login Unavailable');
if (!SignUpScreen)        SignUpScreen = makePlaceholder('Sign Up Unavailable');

let ErrorBoundary = React.Fragment;
try { ErrorBoundary = require('./src/components/ErrorBoundary').default; }
catch { console.warn('ErrorBoundary unavailable, using Fragment.'); }

const Tab = createBottomTabNavigator();
const pickUser = (u) => (u?.user ? u.user : u);
const EmojiTabIcon = React.memo(({ name, focused }) => {
  const icons = {
    Community: focused ? '🌍' : '🌎',
    ColorWheel: focused ? '⚙️' : '⚪',
    Profile: focused ? '👤' : '👥',
    Settings: focused ? '⚙️' : '🔧',
  };
  return <Text style={styles.tabIcon}>{icons[name] || '📱'}</Text>;
});
const getMatchesKey = (userId) => `savedColorMatches:${userId || 'anon'}`;

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [savedColorMatches, setSavedColorMatches] = useState([]);
  const [wheelReloadNonce, setWheelReloadNonce] = useState(0);

  const retryLoadColorWheel = useCallback(async () => {
    try {
      // Try a dynamic import to recover from transient module init failures
      const mod = await import('./src/screens/ColorWheelScreen');
      if (mod?.default) {
        // replace module-level variable and trigger a re-render
        ColorWheelScreen = mod.default;
        setWheelReloadNonce(n => n + 1);
        return;
      }
    } catch (e) {
      console.warn('Retry import failed, attempting app reload:', e?.message);
    }
    try { await Updates.reloadAsync(); } catch {}
  }, []);

  const initializeApp = useCallback(async () => {
    let initTimeout;
    try {
      console.log('🚀 Starting app initialization...');
      initTimeout = setTimeout(() => {
        console.error('⏰ App initialization timeout');
        setLoading(false);
        setIsInitialized(true);
      }, 10000);
      await new Promise(resolve => setTimeout(resolve, 100));

      let token = null;
      try {
        if (SecureStore?.getItemAsync) {
          token = await SecureStore.getItemAsync('fashion_color_wheel_auth_token');
          if (!token) token = await SecureStore.getItemAsync('authToken'); // legacy
        }
        if (!token) token = await AsyncStorage.getItem('authToken');
      } catch (storageError) {
        console.error('📱 Storage access error:', storageError?.message);
      }

      if (token) {
        try {
          await ApiService?.setToken?.(token);
          await ApiService.ready;
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          );
          let profile = null;
          if (ApiService?.getUserProfile) {
            profile = await Promise.race([ApiService.getUserProfile(), timeoutPromise]);
          } else {
            const storedUserData = await AsyncStorage.getItem('userData');
            if (storedUserData) profile = JSON.parse(storedUserData);
          }
          const normalized = pickUser(profile);
          if (normalized?.id) {
            setUser(normalized);
            await ApiService.ready;
            await loadSavedColorMatches(getMatchesKey(normalized.id));
          } else {
            await clearStoredToken();
          }
        } catch (profileError) {
          console.warn('Profile validation failed, falling back:', profileError?.message);
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

  const clearStoredToken = async () => {
    try {
      await SecureStore?.deleteItemAsync?.('fashion_color_wheel_auth_token');
      await SecureStore?.deleteItemAsync?.('authToken');
      await AsyncStorage.removeItem('authToken');
      console.log('🗑️ Stored tokens cleared (both keys)');
    } catch (error) {
      console.error('Failed to clear tokens:', error?.message);
    }
  };

  useEffect(() => {
    const initTimer = setTimeout(() => {
      initializeApp();
    }, 50);
    return () => clearTimeout(initTimer);
  }, [initializeApp]);

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
      try {
        await ApiService.ready;
        const backendMatches = typeof ApiService.getUserColorMatches === 'function'
          ? await ApiService.getUserColorMatches()
          : null;
        if (backendMatches) {
          setSavedColorMatches(backendMatches || []);
          if (backendMatches?.length > 0) {
            await AsyncStorage.setItem(key, JSON.stringify(backendMatches));
          }
          return;
        }
      } catch (backendError) {
        console.warn('Backend load failed, falling back to local storage:', backendError);
      }
      const saved = await AsyncStorage.getItem(key);
      const localMatches = saved ? JSON.parse(saved) : [];
      setSavedColorMatches(localMatches);
    } catch (error) {
      console.error('Error loading saved color matches:', error);
      setSavedColorMatches([]);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadSavedColorMatches(getMatchesKey(user.id));
    }
  }, [user?.id, loadSavedColorMatches]);

  const saveColorMatch = useCallback(async (colorMatch) => {
    try {
      if (!colorMatch || typeof colorMatch !== 'object') throw new Error('Invalid color match data: must be an object');
      if (!colorMatch.colors || !Array.isArray(colorMatch.colors) || colorMatch.colors.length === 0)
        throw new Error('Invalid color match data: colors array is required and must not be empty');
      if (!colorMatch.base_color || typeof colorMatch.base_color !== 'string')
        throw new Error('Invalid color match data: base_color is required and must be a string');
      if (!colorMatch.scheme || typeof colorMatch.scheme !== 'string')
        throw new Error('Invalid color match data: scheme is required and must be a string');

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
        const updated = [...savedColorMatches, savedMatch];
        setSavedColorMatches(updated);
        const key = getMatchesKey(user?.id);
        await AsyncStorage.setItem(key, JSON.stringify(updated));
        return savedMatch;
      } catch (backendError) {
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

  const handleLoginSuccess = useCallback(async (u) => {
    let nextUser;
    try {
      nextUser = pickUser(u);
      try {
        if (nextUser?.token || nextUser?.authToken) {
          const tokenToSet = nextUser.token || nextUser.authToken;
          await ApiService.setToken?.(tokenToSet);
          if (ApiService.ready) { await ApiService.ready; }
        }
      } catch (tokenError) {}
      setUser(nextUser);
      if (__DEV__) {
        console.log('🚀 App startup - API base:', ApiService?.baseURL || 'API service not ready');
        console.log('🎨 Reanimated ready:', typeof global.__reanimatedWorkletInit === 'function');
      }
    } catch (error) {
      console.error('🚨 App.js: handleLoginSuccess error:', error);
      throw error;
    }
    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(nextUser));
    } catch {}
  }, []);

  const handleSignUpComplete = useCallback(async (u) => {
    const nextUser = pickUser(u);
    try { if (u && (u.token || u.authToken)) { ApiService.setToken?.(u.token || u.authToken); } } catch {}
    setUser(nextUser);
    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(nextUser));
      await loadSavedColorMatches(getMatchesKey(nextUser?.id));
    } catch {}
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
    } catch {
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
    } catch {
      setUser(null);
      await loadSavedColorMatches(getMatchesKey(null));
    }
  }, [user?.id, loadSavedColorMatches]);

  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {}
    };
    if (!__DEV__) checkUpdates();
  }, []);

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
                    key={wheelReloadNonce}                       // force remount after retry import
                    {...props}
                    currentUser={user || null}
                    onSaveColorMatch={saveColorMatch || (() => Promise.resolve())}
                    onLogout={handleLogout || (() => {})}
                    onRetry={retryLoadColorWheel}                // exposed to fallback component
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
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { fontSize: 18, color: '#666', textAlign: 'center', marginBottom: 10 },
  errorText: { fontSize: 14, color: '#ff6b6b', textAlign: 'center', marginTop: 10 },
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
