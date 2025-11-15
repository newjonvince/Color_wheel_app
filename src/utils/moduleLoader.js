// utils/moduleLoader.js - Safe module loading with error handling
import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import Constants from 'expo-constants';

// Production-ready configuration
const extra = Constants.expoConfig?.extra || {};
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

// Safe module loader with fallbacks
export const loadModules = () => {
  const modules = {};
  const errors = [];

  try {
    ({ StatusBar: modules.StatusBar } = require('expo-status-bar'));
    ({ NavigationContainer: modules.NavigationContainer } = require('@react-navigation/native'));
    ({ createBottomTabNavigator: modules.createBottomTabNavigator } = require('@react-navigation/bottom-tabs'));
    ({ GestureHandlerRootView: modules.GestureHandlerRootView } = require('react-native-gesture-handler'));
    modules.AsyncStorage = require('@react-native-async-storage/async-storage').default;
    ({ SafeAreaProvider: modules.SafeAreaProvider, SafeAreaView: modules.SafeAreaView } = require('react-native-safe-area-context'));
    try {
      modules.SecureStore = require('expo-secure-store');
    } catch (e) {
      console.warn('SecureStore not available:', e.message);
      modules.SecureStore = null;
    }
    
    try {
      modules.Updates = require('expo-updates');
    } catch (e) {
      console.warn('Updates not available:', e.message);
      modules.Updates = null;
    }
    
    modules.ApiService = require('../services/safeApiService').default;
    
    // Log successful module loading only in debug mode
    if (IS_DEBUG_MODE) {
      console.log('✅ App modules loaded successfully');
    }
  } catch (e) {
    console.error('FATAL: Module import failed at launch:', e?.message);
    console.error('Stack:', e?.stack);
    errors.push(e);
    
    // Provide minimal fallbacks to prevent RCTFatal
    modules.StatusBar = () => null;
    modules.NavigationContainer = ({ children }) => children;
    modules.createBottomTabNavigator = () => ({ Navigator: View, Screen: View });
    modules.GestureHandlerRootView = View;
    modules.SafeAreaProvider = View;
    modules.SafeAreaView = View;
    modules.SecureStore = null;
    modules.Updates = null;
    modules.ApiService = null;
  }

  return { modules, errors };
};

// Screen loader with fallbacks
export const loadScreens = () => {
  const screens = {};
  const errors = [];

  try {
    screens.BoardsScreen = require('../screens/BoardsScreen').default;
    screens.CommunityFeedScreen = require('../screens/CommunityFeedScreen').default;
    screens.LoginScreen = require('../screens/LoginScreen/index').default;
    screens.SignUpScreen = require('../screens/SignUpScreen').default;
    screens.UserSettingsScreen = require('../screens/UserSettingsScreen').default;
    
    // Log successful screen loading only in debug mode
    if (IS_DEBUG_MODE) {
      console.log('✅ All screen modules loaded successfully');
    }
  } catch (e) {
    console.error('Screen module load error:', e?.message);
    console.error('Stack:', e?.stack);
    errors.push(e);
  }

  // Create fallback screens for any that failed to load
  const makePlaceholder = (title) => () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 8 }}>{title || 'Screen Unavailable'}</Text>
      <Text style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
        This screen failed to load. Try restarting the app.
      </Text>
    </View>
  );

  if (!screens.BoardsScreen) screens.BoardsScreen = makePlaceholder('Profile Unavailable');
  if (!screens.CommunityFeedScreen) screens.CommunityFeedScreen = makePlaceholder('Community Unavailable');
  if (!screens.UserSettingsScreen) screens.UserSettingsScreen = makePlaceholder('Settings Unavailable');
  if (!screens.LoginScreen) screens.LoginScreen = makePlaceholder('Login Unavailable');
  if (!screens.SignUpScreen) screens.SignUpScreen = makePlaceholder('Sign Up Unavailable');

  return { screens, errors };
};

// ColorWheel screen loader with special handling
export const loadColorWheelScreen = () => {
  let ColorWheelScreen;
  let error = null;

  try { 
    ColorWheelScreen = require('../screens/ColorWheelScreen/index').default; 
    // Log ColorWheel loading only in debug mode
    if (IS_DEBUG_MODE) {
      console.log('✅ ColorWheelScreen loaded successfully');
    }
  } catch (e) {
    // Log ColorWheel failures only in debug mode (keep error for production)
    if (IS_DEBUG_MODE) {
      console.log('❌ ColorWheelScreen load failed on', Platform.OS + ':', e?.message);
    }
    console.error('Critical module load error:', e);
    error = e;
    
    const FallbackWheel = ({ onLogout, onRetry }) => (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, color: '#ff6b6b', textAlign: 'center', marginBottom: 12 }}>
          Color Wheel Unavailable
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 }}>
          The color wheel feature is temporarily unavailable. Try reloading the wheel or restarting the app.
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity 
            onPress={() => onRetry?.()} 
            style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginRight: 12 }}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => onLogout?.()} 
            style={{ backgroundColor: '#888', padding: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
    ColorWheelScreen = FallbackWheel;
  }

  return { ColorWheelScreen, error };
};

// Error boundary loader
export const loadErrorBoundary = () => {
  let ErrorBoundary = React.Fragment;
  try { 
    ErrorBoundary = require('../components/ErrorBoundary').default; 
  } catch (error) {
    console.warn('ErrorBoundary failed to load:', error);
  }
  return ErrorBoundary;
};
