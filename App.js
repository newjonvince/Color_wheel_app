// App.patched.js — hardened App entry with crash-safe imports
import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, AppState, Platform, LogBox, TouchableOpacity } from 'react-native';

// Wrap potentially problematic imports
let StatusBar, NavigationContainer, createBottomTabNavigator;
let GestureHandlerRootView, AsyncStorage, SafeAreaProvider, SafeAreaView;
let SecureStore, Updates, ApiService;

try {
  ({ StatusBar } = require('expo-status-bar'));
  ({ NavigationContainer } = require('@react-navigation/native'));
  ({ createBottomTabNavigator } = require('@react-navigation/bottom-tabs'));
  ({ GestureHandlerRootView } = require('react-native-gesture-handler'));
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
  ({ SafeAreaProvider, SafeAreaView } = require('react-native-safe-area-context'));
  SecureStore = require('expo-secure-store');
  Updates = require('expo-updates');
  ApiService = require('./src/services/api').default;
  
  if (!__DEV__) console.log('App modules loaded successfully');
} catch (e) {
  console.error('FATAL: Module import failed at launch:', e?.message);
  console.error('Stack:', e?.stack);
  // Provide minimal fallbacks to prevent RCTFatal
  StatusBar = () => null;
  NavigationContainer = ({ children }) => children;
  createBottomTabNavigator = () => ({ Navigator: View, Screen: View });
  GestureHandlerRootView = View;
  SafeAreaProvider = View;
  SafeAreaView = View;
}

// Production JS fatal handler
if (!__DEV__ && global?.ErrorUtils?.setGlobalHandler) {
  const old = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((err, isFatal) => {
    console.log('JS Fatal:', isFatal, err?.message, err?.stack);
    old?.(err, isFatal);
  });
}

// Deep linking (ensure this matches your app.json "scheme")
const linking = {
  prefixes: ['colorwheel://'],
  config: { screens: { Community: 'community', ColorWheel: 'wheel', Profile: 'profile', Settings: 'settings' } },
};

// Quiet RN warnings in production
if (!__DEV__) LogBox.ignoreAllLogs(true);

// Dynamic imports with safe fallbacks - prevent launch crashes
let ColorWheelScreen;
try { 
  ColorWheelScreen = require('./src/screens/ColorWheelScreen').default; 
  if (!__DEV__) console.log('ColorWheelScreen loaded successfully');
} catch (e) {
  if (!__DEV__) console.log('ColorWheelScreen load failed:', e?.message);
  console.error('Critical module load error:', e);
  const FallbackWheel = ({ onLogout, onRetry }) => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, color: '#ff6b6b', textAlign: 'center', marginBottom: 12 }}>Color Wheel Unavailable</Text>
      <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 }}>The color wheel feature is temporarily unavailable. Try reloading the wheel or restarting the app.</Text>
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => onRetry?.()} style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 16 }}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onLogout?.()} style={{ backgroundColor: '#888', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontSize: 16 }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  ColorWheelScreen = FallbackWheel;
}

let BoardsScreen, DiscoverScreen, CommunityFeedScreen, LoginScreen, SignUpScreen, UserSettingsScreen;
try {
  BoardsScreen = require('./src/screens/BoardsScreen').default;
  DiscoverScreen = require('./src/screens/DiscoverScreen').default;
  CommunityFeedScreen = require('./src/screens/CommunityFeedScreen').default;
  LoginScreen = require('./src/screens/LoginScreen').default;
  SignUpScreen = require('./src/screens/SignUpScreen').default;
  UserSettingsScreen = require('./src/screens/UserSettingsScreen').default;
  
  if (!__DEV__) console.log('All screen modules loaded successfully');
} catch (e) {
  console.error('Screen module load error:', e?.message);
  console.error('Stack:', e?.stack);
}

const makePlaceholder = (title) => () => (
  <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:20 }}>
    <Text style={{ fontSize:18, marginBottom:8 }}>{title || 'Screen Unavailable'}</Text>
    <Text style={{ fontSize:13, color:'#666', textAlign:'center' }}>This screen failed to load. Try restarting the app.</Text>
  </View>
);
if (!BoardsScreen)        BoardsScreen = makePlaceholder('Profile Unavailable');
if (!CommunityFeedScreen) CommunityFeedScreen = makePlaceholder('Community Unavailable');
if (!UserSettingsScreen)  UserSettingsScreen = makePlaceholder('Settings Unavailable');
if (!LoginScreen)         LoginScreen = makePlaceholder('Login Unavailable');
if (!SignUpScreen)        SignUpScreen = makePlaceholder('Sign Up Unavailable');

let ErrorBoundary = React.Fragment;
try { ErrorBoundary = require('./src/components/ErrorBoundary').default; } catch {}

const Tab = createBottomTabNavigator();
const pickUser = (u) => (u?.user ? u.user : u);
const EmojiTabIcon = React.memo(({ name, focused }) => {
  const icons = { Community: focused ? '🌍' : '🌎', ColorWheel: focused ? '🎨' : '⚪', Profile: focused ? '👤' : '👥', Settings: focused ? '⚙️' : '🔧' };
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
      const mod = await import('./src/screens/ColorWheelScreen');
      if (mod?.default) {
        ColorWheelScreen = mod.default;
        setWheelReloadNonce((n) => n + 1);
        return;
      }
    } catch {}
    try { await Updates.reloadAsync(); } catch {}
  }, []);

  const clearStoredToken = async () => {
    try {
      await SecureStore?.deleteItemAsync?.('fashion_color_wheel_auth_token');
      await SecureStore?.deleteItemAsync?.('authToken');
      await AsyncStorage.removeItem('authToken');
    } catch {}
  };

  const initializeApp = useCallback(async () => {
    let initTimeout;
    try {
      initTimeout = setTimeout(() => { setLoading(false); setIsInitialized(true); }, 10000);
      await new Promise((r) => setTimeout(r, 50));

      let token = null;
      try {
        token = await SecureStore.getItemAsync('fashion_color_wheel_auth_token');
        if (!token) token = await SecureStore.getItemAsync('authToken');
        if (!token) token = await AsyncStorage.getItem('authToken');
      } catch {}

      if (token) {
        try {
          await ApiService?.setToken?.(token);
          await ApiService.ready;
          let profile = null;
          if (ApiService?.getUserProfile) {
            profile = await Promise.race([ApiService.getUserProfile(), new Promise((_, rej) => setTimeout(() => rej(new Error('Profile timeout')), 5000))]);
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
        } catch {
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
      if (initTimeout) clearTimeout(initTimeout);
      setError('Failed to initialize app');
      setIsInitialized(true);
    } finally {
      setLoading(false);
    }
  }, [loadSavedColorMatches]);

  useEffect(() => {
    const t = setTimeout(() => { initializeApp(); }, 50);
    return () => clearTimeout(t);
  }, [initializeApp]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && !isInitialized) {
        initializeApp();
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, [isInitialized, initializeApp]);

  const loadSavedColorMatches = useCallback(async (key) => {
    try {
      try {
        await ApiService.ready;
        const backendMatches = typeof ApiService.getUserColorMatches === 'function' ? await ApiService.getUserColorMatches() : null;
        if (backendMatches) {
          setSavedColorMatches(backendMatches || []);
          if (backendMatches?.length > 0) await AsyncStorage.setItem(key, JSON.stringify(backendMatches));
          return;
        }
      } catch {}
      const saved = await AsyncStorage.getItem(key);
      const localMatches = saved ? JSON.parse(saved) : [];
      setSavedColorMatches(localMatches);
    } catch {
      setSavedColorMatches([]);
    }
  }, []);

  useEffect(() => {
    if (user?.id) loadSavedColorMatches(getMatchesKey(user.id));
  }, [user?.id, loadSavedColorMatches]);

  const saveColorMatch = useCallback(async (colorMatch) => {
    try {
      // Validate input
      if (!colorMatch || typeof colorMatch !== 'object') {
        throw new Error('Invalid color match data: must be an object');
      }
      if (!Array.isArray(colorMatch.colors) || colorMatch.colors.length === 0) {
        throw new Error('Invalid color match data: colors array is required');
      }
      if (!colorMatch.base_color || typeof colorMatch.base_color !== 'string') {
        throw new Error('Invalid color match data: base_color is required');
      }
      if (!colorMatch.scheme || typeof colorMatch.scheme !== 'string') {
        throw new Error('Invalid color match data: scheme is required');
      }

      // Attempt to save to backend
      try {
        const savedResp = await ApiService.createColorMatch({
          base_color: colorMatch.base_color,
          scheme: colorMatch.scheme,
          colors: colorMatch.colors,
          title: colorMatch.title || `${colorMatch.scheme} palette`,
          description: colorMatch.description || '',
          is_public: !!colorMatch.is_public
        });
        
        const savedMatch = (savedResp && savedResp.data) ? savedResp.data : savedResp;
        const updated = [...savedColorMatches, savedMatch];
        setSavedColorMatches(updated);
        
        const key = getMatchesKey(user?.id);
        await AsyncStorage.setItem(key, JSON.stringify(updated));
        return savedMatch;
      } catch (apiError) {
        console.warn('Failed to save to backend, using local storage:', apiError);
        
        // Offline/local fallback
        const key = getMatchesKey(user?.id);
        const localMatch = { 
          ...colorMatch, 
          id: Date.now().toString(), 
          created_at: new Date().toISOString(),
          _isLocal: true // Mark as local for sync later
        };
        
        const updated = [...savedColorMatches, localMatch];
        setSavedColorMatches(updated);
        await AsyncStorage.setItem(key, JSON.stringify(updated));
        return localMatch;
      }
    } catch (error) {
      console.error('saveColorMatch error:', error);
      throw error; // Re-throw for UI error handling
    }
  }, [user?.id, savedColorMatches]);

  const handleLoginSuccess = useCallback(async (u) => {
    const nextUser = pickUser(u);
    try {
      if (nextUser?.token || nextUser?.authToken) {
        const tokenToSet = nextUser.token || nextUser.authToken;
        await ApiService.setToken?.(tokenToSet);
        if (ApiService.ready) await ApiService.ready;
      }
    } catch {}
    setUser(nextUser);
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
              onBackToLogin={() => setShowSignUp(false)} 
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
              detachInactiveScreens
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
                    key={wheelReloadNonce}
                    {...props}
                    currentUser={user || null}
                    onSaveColorMatch={saveColorMatch}
                    onLogout={handleLogout}
                    onRetry={retryLoadColorWheel}
                    navigation={props?.navigation}
                  />
                )}
              </Tab.Screen>

              <Tab.Screen name="Community" options={{ title: 'Community' }}>
                {(props) => (
                  <CommunityFeedScreen {...props} currentUser={user} onSaveColorMatch={saveColorMatch} onLogout={handleLogout} />
                )}
              </Tab.Screen>

              <Tab.Screen name="Profile" options={{ title: 'Profile' }}>
                {(props) => (
                  <BoardsScreen {...props} currentUser={user} savedColorMatches={savedColorMatches} onSaveColorMatch={saveColorMatch} onLogout={handleLogout} />
                )}
              </Tab.Screen>

              <Tab.Screen name="Settings" options={{ title: 'Settings' }}>
                {(props) => (
                  <UserSettingsScreen {...props} currentUser={user} onLogout={handleLogout} onAccountDeleted={handleAccountDeleted} />
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
  tabBar: { backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e9ecef', paddingBottom: 5, paddingTop: 5, height: 65 },
  tabIcon: { fontSize: 24 },
  tabLabel: { fontSize: 12, fontWeight: '600' },
});
