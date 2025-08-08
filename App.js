import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './src/services/api';

// Import screens
import ColorWheelScreen from './src/screens/ColorWheelScreen';
import BoardsScreen from './src/screens/BoardsScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import CommunityFeedScreen from './src/screens/CommunityFeedScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import UserSettingsScreen from './src/screens/UserSettingsScreen';

// Import components
import ErrorBoundary from './src/components/ErrorBoundary';

const Tab = createBottomTabNavigator();

// Tab Icon Helper Function
const TabIcon = ({ name, focused }) => {
  const icons = {
    'Community': focused ? '🏠' : '🏘️',
    'ColorWheel': focused ? '🎨' : '🎭',
    'Boards': focused ? '📌' : '📋',
  };
  return icons[name] || '📱';
};

export default function App() {
  const [savedColorMatches, setSavedColorMatches] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showSignUp, setShowSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Load tokens from secure storage (handled by ApiService)
      await ApiService.loadTokenFromStorage();
      
      // Check if user has valid tokens
      const connectionStatus = ApiService.getConnectionStatus();
      
      if (connectionStatus.hasToken) {
        try {
          // Verify token by getting user profile
          const userProfile = await ApiService.getUserProfile();
          setIsLoggedIn(true);
          setCurrentUser(userProfile.user);
        } catch (error) {
          // Token might be expired, clear it
          console.log('Token verification failed, clearing tokens');
          await ApiService.clearToken();
          setIsLoggedIn(false);
          setCurrentUser(null);
        }
      }
      
      // Load saved color matches
      await loadSavedColorMatches();
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedColorMatches = async () => {
    try {
      const saved = await AsyncStorage.getItem('savedColorMatches');
      if (saved) {
        setSavedColorMatches(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading saved color matches:', error);
    }
  };

  const saveColorMatch = async (colorMatch, scheme) => {
    try {
      const updatedMatches = [...savedColorMatches, colorMatch];
      setSavedColorMatches(updatedMatches);
      await AsyncStorage.setItem('savedColorMatches', JSON.stringify(updatedMatches));
    } catch (error) {
      console.error('Error saving color match:', error);
    }
  };

  const handleLoginSuccess = async (userData) => {
    setCurrentUser(userData.user);
    setIsLoggedIn(true);
    
    // Store user data in AsyncStorage for backward compatibility
    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(userData.user));
    } catch (error) {
      console.warn('Error storing user data in AsyncStorage:', error);
    }
  };

  const handleSignUpComplete = async (userData) => {
    setCurrentUser(userData.user);
    setIsLoggedIn(true);
    setShowSignUp(false);
    
    // Store user data in AsyncStorage for backward compatibility
    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(userData.user));
    } catch (error) {
      console.warn('Error storing user data in AsyncStorage:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // Call API logout
      await ApiService.logout();
      
      // Clear AsyncStorage
      await AsyncStorage.removeItem('isLoggedIn');
      await AsyncStorage.removeItem('userData');
      
      setIsLoggedIn(false);
      setCurrentUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
      // Still clear local state even if API call fails
      setIsLoggedIn(false);
      setCurrentUser(null);
    }
  };

  const handleAccountDeleted = async () => {
    try {
      // Clear all local data
      await AsyncStorage.clear();
      setSavedColorMatches([]);
      setIsLoggedIn(false);
      setCurrentUser(null);
    } catch (error) {
      console.error('Error clearing data after account deletion:', error);
      // Still clear state
      setIsLoggedIn(false);
      setCurrentUser(null);
    }
  };

  const TabIcon = ({ name, focused }) => {
    const icons = {
      'Community': focused ? '🏠' : '🏘️',
      'ColorWheel': focused ? '🎨' : '🎭',
      'Boards': focused ? '📌' : '📋',
      'Settings': focused ? '⚙️' : '🔧',
    };
    return icons[name] || '📱';
  };

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingEmoji}>🎨</Text>
        <Text style={styles.loadingText}>Loading Fashion Color Wheel...</Text>
        <Text style={styles.loadingSubtext}>Preparing your color journey</Text>
      </View>
    );
  }

  // Show sign up screen
  if (showSignUp) {
    return (
      <>
        <StatusBar style="auto" />
        <SignUpScreen 
          onSignUpComplete={handleSignUpComplete}
          onBack={() => setShowSignUp(false)}
        />
      </>
    );
  }

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return (
      <>
        <StatusBar style="auto" />
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess}
          onSignUpPress={() => setShowSignUp(true)}
        />
      </>
    );
  }

  // Show main app if logged in
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => (
            <Text style={styles.tabIcon}>
              {TabIcon({ name: route.name, focused })}
            </Text>
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
  </GestureHandlerRootView>
);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 24,
    color: '#2c3e50',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  loadingSubtext: {
    fontSize: 16,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  tabBar: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingBottom: 5,
    paddingTop: 5,
    height: 65,
  },
  tabIcon: {
    fontSize: 24,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
