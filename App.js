import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ApiService from './src/services/api';

// Global error handler for unhandled promise rejections
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('🚨 Global error handler:', error, 'isFatal:', isFatal);
  if (isFatal) {
    console.error('🚨 Fatal error detected, attempting graceful handling');
    // Log the error but don't crash the app
    Alert.alert(
      'Unexpected Error',
      'The app encountered an error but will continue running. Please restart if issues persist.',
      [{ text: 'OK' }]
    );
  }
  // Call original handler for logging
  if (originalHandler) {
    originalHandler(error, isFatal);
  }
});

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

// Per-user key for saved color matches
const getMatchesKey = (userId) => `savedColorMatches:${userId || 'anon'}`;

export default function App() {
  const [savedColorMatches, setSavedColorMatches] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showSignUp, setShowSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const loadSavedColorMatches = useCallback(async (key) => {
    try {
      const saved = await AsyncStorage.getItem(key);
      setSavedColorMatches(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.error('Error loading saved color matches:', error);
      setSavedColorMatches([]);
    }
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing Fashion Color Wheel app...');
      
      // Ensure ApiService is properly initialized
      if (!ApiService) {
        throw new Error('ApiService not available');
      }

      // Load tokens from secure storage with error handling
      try {
        if (typeof ApiService.loadTokenFromStorage === 'function') {
          await ApiService.loadTokenFromStorage();
          console.log('✅ Tokens loaded from storage');
        } else {
          console.log('⚠️ loadTokenFromStorage method not available');
        }
      } catch (tokenError) {
        console.log('⚠️ Failed to load tokens:', tokenError.message);
      }

      // Check token presence safely
      let connectionStatus = {};
      try {
        connectionStatus = (typeof ApiService.getConnectionStatus === 'function') 
          ? ApiService.getConnectionStatus() || {} 
          : {};
      } catch (statusError) {
        console.log('⚠️ Failed to get connection status:', statusError.message);
      }

      let user = null;
      if (connectionStatus.hasToken) {
        try {
          // Verify token & fetch profile with timeout
          console.log('🔍 Verifying user token...');
          if (typeof ApiService.getUserProfile === 'function') {
            const userProfile = await Promise.race([
              ApiService.getUserProfile(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
              )
            ]);
            user = userProfile?.user || userProfile;
            setIsLoggedIn(true);
            setCurrentUser(user);
            console.log('✅ User authenticated:', user?.username || user?.email);
          } else {
            console.log('⚠️ getUserProfile method not available');
          }
        } catch (error) {
          console.log('⚠️ Token verification failed, clearing tokens:', error?.message);
          try {
            if (typeof ApiService.clearToken === 'function') {
              await ApiService.clearToken();
            }
          } catch (clearError) {
            console.log('⚠️ Failed to clear token:', clearError.message);
          }
          setIsLoggedIn(false);
          setCurrentUser(null);
        }
      } else {
        console.log('📝 No valid token found, user not logged in');
      }

      // Load saved color matches for the resolved user (or anon)
      const key = getMatchesKey(user?.id);
      await loadSavedColorMatches(key);
      console.log('✅ App initialization complete');
    } catch (error) {
      console.error('❌ Critical error initializing app:', error);
      // Ensure app doesn't crash - set safe defaults
      setIsLoggedIn(false);
      setCurrentUser(null);
      try {
        await loadSavedColorMatches(getMatchesKey(null)); // try anon as last resort
      } catch (matchError) {
        console.error('❌ Failed to load anonymous matches:', matchError);
        setSavedColorMatches([]); // Set empty array as ultimate fallback
      }
    } finally {
      setIsLoading(false);
      console.log('🏁 App initialization finished');
    }
  };

  const saveColorMatch = useCallback(async (colorMatch) => {
    try {
      const key = getMatchesKey(currentUser?.id);
      const updated = [...savedColorMatches, colorMatch];
      setSavedColorMatches(updated);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving color match:', error);
    }
  }, [currentUser?.id, savedColorMatches]);

  const handleLoginSuccess = useCallback(async (u) => {
    const user = pickUser(u);
    setCurrentUser(user);
    setIsLoggedIn(true);

    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(user));

      // migrate anon saved matches if user has none yet
      const anonKey = getMatchesKey('anon');
      const userKey = getMatchesKey(user?.id);
      const [anon, existing] = await Promise.all([
        AsyncStorage.getItem(anonKey),
        AsyncStorage.getItem(userKey),
      ]);
      if (anon && !existing) {
        await AsyncStorage.setItem(userKey, anon);
      }
      await loadSavedColorMatches(userKey);
    } catch (error) {
      console.warn('Error storing user data in AsyncStorage:', error);
    }
  }, [loadSavedColorMatches]);

  const handleSignUpComplete = useCallback(async (u) => {
    const user = pickUser(u);
    setCurrentUser(user);
    setIsLoggedIn(true);
    setShowSignUp(false);

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

      setIsLoggedIn(false);
      setCurrentUser(null);

      // Load anon saved data for post-logout state
      await loadSavedColorMatches(getMatchesKey(null));
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggedIn(false);
      setCurrentUser(null);
      await loadSavedColorMatches(getMatchesKey(null));
    }
  }, [loadSavedColorMatches]);

  const handleAccountDeleted = useCallback(async () => {
    try {
      // Clear secure token too
      await ApiService.clearToken?.();

      // Remove known keys; avoid blind clear unless you want to wipe all app data
      const keysToRemove = ['isLoggedIn', 'userData', getMatchesKey(currentUser?.id)];
      await AsyncStorage.multiRemove(keysToRemove);

      setSavedColorMatches([]);
      setIsLoggedIn(false);
      setCurrentUser(null);

      // After delete, load anon scope (should be empty unless you keep demo state)
      await loadSavedColorMatches(getMatchesKey(null));
    } catch (error) {
      console.error('Error clearing data after account deletion:', error);
      setIsLoggedIn(false);
      setCurrentUser(null);
      await loadSavedColorMatches(getMatchesKey(null));
    }
  }, [currentUser?.id, loadSavedColorMatches]);

  const TabIcon = ({ name, focused }) => {
    const icons = {
      'Community': focused ? '🏠' : '🏘️',
      'ColorWheel': focused ? '🎨' : '🎭',
      'Boards': focused ? '📌' : '📋',
      'Settings': focused ? '⚙️' : '🔧',
    };
    return icons[name] || '📱';
  };

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingContainer}>
          <StatusBar style="auto" />
          <Text style={styles.loadingEmoji}>🎨</Text>
          <Text style={styles.loadingText}>Loading Fashion Color Wheel...</Text>
          <Text style={styles.loadingSubtext}>Preparing your color journey</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (showSignUp) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar style="auto" />
          <SignUpScreen
            onSignUpComplete={handleSignUpComplete}
            onBack={() => setShowSignUp(false)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar style="auto" />
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onSignUpPress={() => setShowSignUp(true)}
          />
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
              currentUser={currentUser}
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
              currentUser={currentUser}
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
              currentUser={currentUser}
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
              currentUser={currentUser}
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingEmoji: { fontSize: 64, marginBottom: 20 },
  loadingText: { fontSize: 24, color: '#2c3e50', fontWeight: 'bold', marginBottom: 10 },
  loadingSubtext: { fontSize: 16, color: '#7f8c8d', fontStyle: 'italic' },
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
}
