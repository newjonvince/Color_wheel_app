// components/AuthenticatedApp.js - Main app content for authenticated users
import React, { useCallback } from 'react';
import { SafeAreaView, Text } from 'react-native';
import Constants from 'expo-constants';
import TabIcon from './TabIcon';
// ✅ LAZY LOADING: Avoid circular dependency with config/app.js
let appConfig = null;
const getAppConfig = () => {
  if (appConfig) return appConfig;
  try {
    const configModule = require('../config/app');
    appConfig = configModule.APP_CONFIG || {};
  } catch (error) {
    console.warn('AuthenticatedApp: Failed to load app config:', error.message);
    appConfig = {};
  }
  return appConfig;
};

// Production-ready configuration
const extra = Constants.expoConfig?.extra || {};
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

// Navigation dependencies are guarded so missing native modules don't crash at import time
let NavigationContainer = null;
let createBottomTabNavigator = null;
let navigationLoadError = null;

const loadNavigationDeps = () => {
  if (NavigationContainer && createBottomTabNavigator) return;
  try {
    const nav = require('@react-navigation/native');
    const tabs = require('@react-navigation/bottom-tabs');
    NavigationContainer = nav.NavigationContainer;
    createBottomTabNavigator = tabs.createBottomTabNavigator;
  } catch (error) {
    navigationLoadError = error;
    console.error('Navigation modules failed to load:', error?.message || error);
  }
};

// Screen imports guarded for the same reason
let ColorWheelScreen = null;
let CommunityFeedScreen = null;
let BoardsScreen = null;
let UserSettingsScreen = null;
let screenLoadError = null;

const loadScreens = () => {
  if (ColorWheelScreen && CommunityFeedScreen && BoardsScreen && UserSettingsScreen) return;
  try {
    ColorWheelScreen = require('../screens/ColorWheelScreen').default;
    CommunityFeedScreen = require('../screens/CommunityFeedScreen').default;
    BoardsScreen = require('../screens/BoardsScreen').default;
    UserSettingsScreen = require('../screens/UserSettingsScreen').default;
  } catch (error) {
    screenLoadError = error;
    console.error('Screen modules failed to load:', error?.message || error);
  }
};

// Memoized TabIcon to prevent re-renders
const TabIconMemo = React.memo(({ focused, name }) => (
  <TabIcon focused={focused} name={name} />
));

const AuthenticatedApp = ({ user, handleLogout }) => {
  // Load dependencies once at render entry
  loadNavigationDeps();
  loadScreens();

  // If navigation failed to load, show a safe fallback instead of crashing
  if (!NavigationContainer || !createBottomTabNavigator || navigationLoadError) {
    const message = navigationLoadError?.message || 'Navigation dependencies not available';
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ textAlign: 'center', color: '#e74c3c', fontWeight: '600' }}>
          Navigation failed to load.
        </Text>
        <Text style={{ textAlign: 'center', marginTop: 8 }}>
          {message}
        </Text>
      </SafeAreaView>
    );
  }

  // If screens failed to load, show a safe fallback instead of crashing
  if (!ColorWheelScreen || !CommunityFeedScreen || !BoardsScreen || !UserSettingsScreen || screenLoadError) {
    const message = screenLoadError?.message || 'Screens not available';
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ textAlign: 'center', color: '#e74c3c', fontWeight: '600' }}>
          Screen modules failed to load.
        </Text>
        <Text style={{ textAlign: 'center', marginTop: 8 }}>
          {message}
        </Text>
      </SafeAreaView>
    );
  }

  const Tab = createBottomTabNavigator();

  // Stable screen options - no dependencies on props
  const getScreenOptions = useCallback(({ route }) => ({
    tabBarIcon: ({ focused }) => <TabIconMemo focused={focused} name={route.name} />,
    ...getAppConfig().tabNavigation?.screenOptions,
  }), []);

  // SAFER: Wrap navigation in try-catch with fallback
  const renderNavigation = () => {
    try {
      return (
        <NavigationContainer>
          <Tab.Navigator
            initialRouteName={getAppConfig().tabNavigation?.initialRouteName}
            screenOptions={getScreenOptions}
            {...getAppConfig().tabNavigation?.options}
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
              name="Boards" 
              component={BoardsScreen}
              options={{ title: 'My Boards' }}
            />
            <Tab.Screen 
              name="Settings" 
              component={UserSettingsScreen}
              options={{ title: 'Settings' }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      );
    } catch (error) {
      console.error('dYs" Failed to render navigation:', error);
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ textAlign: 'center' }}>Navigation failed. Please restart the app.</Text>
        </SafeAreaView>
      );
    }
  };

  return renderNavigation();
};

AuthenticatedApp.displayName = 'AuthenticatedApp';

export default AuthenticatedApp;
