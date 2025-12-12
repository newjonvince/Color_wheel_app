// utils/moduleLoader.js - Safe module loading with error handling
import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import Constants from 'expo-constants';

// Production-ready configuration
const getSafeExpoExtra = () => {
  try {
    const expoConfig = Constants?.expoConfig;
    if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
      return expoConfig.extra;
    }
    console.warn('moduleLoader: expoConfig missing or malformed, using defaults');
  } catch (error) {
    console.warn('moduleLoader: unable to read expoConfig safely, using defaults', error);
  }
  return {};
};

const extra = getSafeExpoExtra();
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

// ✅ Safe module loading helper with validation
const loadModule = (modulePath, exportName, fallback = null) => {
  try {
    const mod = require(modulePath);
    const exported = exportName ? mod[exportName] : mod.default || mod;
    
    if (!exported && exportName) {
      console.warn(`Module ${modulePath} missing export: ${exportName}`);
      return fallback;
    }
    
    return exported;
  } catch (error) {
    console.warn(`Failed to load ${modulePath}:`, error.message);
    return fallback;
  }
};

// Safe module loader with fallbacks
export const loadModules = () => {
  const modules = {};
  const errors = [];

  // ✅ Load and validate each module separately
  modules.StatusBar = loadModule('expo-status-bar', 'StatusBar', () => null);
  modules.NavigationContainer = loadModule('@react-navigation/native', 'NavigationContainer', ({ children }) => children);
  modules.createBottomTabNavigator = loadModule('@react-navigation/bottom-tabs', 'createBottomTabNavigator', () => ({ Navigator: View, Screen: View }));
  modules.GestureHandlerRootView = loadModule('react-native-gesture-handler', 'GestureHandlerRootView', View);
  modules.AsyncStorage = loadModule('@react-native-async-storage/async-storage', null, null);
  
  // Handle SafeAreaContext with multiple exports
  try {
    const safeAreaModule = require('react-native-safe-area-context');
    modules.SafeAreaProvider = safeAreaModule.SafeAreaProvider || View;
    modules.SafeAreaView = safeAreaModule.SafeAreaView || View;
  } catch (error) {
    console.warn('Failed to load react-native-safe-area-context:', error.message);
    modules.SafeAreaProvider = View;
    modules.SafeAreaView = View;
    errors.push(error);
  }
  
  modules.SecureStore = loadModule('expo-secure-store', null, null);
  modules.Updates = loadModule('expo-updates', null, null);
  modules.ApiService = loadModule('../services/safeApiService', null, null);
  
  // Log successful module loading only in debug mode
  if (IS_DEBUG_MODE) {
    console.log('✅ App modules loaded successfully');
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
    ErrorBoundary = require('../components/UnifiedErrorBoundary').default; 
  } catch (error) {
    console.warn('UnifiedErrorBoundary failed to load:', error);
  }
  return ErrorBoundary;
};
