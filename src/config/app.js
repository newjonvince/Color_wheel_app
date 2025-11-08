// config/app.js - App configuration and constants
import { Platform, LogBox } from 'react-native';

// App configuration
export const APP_CONFIG = {
  // Deep linking configuration
  linking: {
    prefixes: ['colorwheel://'],
    config: { 
      screens: { 
        Community: 'community', 
        ColorWheel: 'wheel', 
        Profile: 'profile', 
        Settings: 'settings' 
      } 
    },
  },

  // Tab navigation configuration
  tabNavigation: {
    initialRouteName: "ColorWheel",
    screenOptions: {
      tabBarActiveTintColor: '#e74c3c',
      tabBarInactiveTintColor: '#7f8c8d',
      headerShown: false,
    },
    options: {
      detachInactiveScreens: true,
    }
  },

  // Tab icons configuration
  tabIcons: {
    Community: { focused: '🌍', unfocused: '🌎' },
    ColorWheel: { focused: '🎨', unfocused: '⚪' },
    Profile: { focused: '👤', unfocused: '👥' },
    Settings: { focused: '⚙️', unfocused: '🔧' },
  },

  // App initialization settings
  initialization: {
    timeoutMs: 10000,
    profileTimeoutMs: 5000,
    initDelayMs: 50,
  },
};

// Initialize app-level configurations
export const initializeAppConfig = () => {
  // Production JS fatal handler
  if (!__DEV__ && global?.ErrorUtils?.setGlobalHandler) {
    const old = global.ErrorUtils.getGlobalHandler?.();
    global.ErrorUtils.setGlobalHandler((err, isFatal) => {
      console.log('JS Fatal:', isFatal, err?.message, err?.stack);
      old?.(err, isFatal);
    });
  }

  // Quiet RN warnings in production
  if (!__DEV__) {
    LogBox.ignoreAllLogs(true);
  }
};

// Status bar configuration
export const getStatusBarStyle = () => {
  return Platform.OS === 'ios' ? 'dark' : 'auto';
};

// Helper functions
export const pickUser = (u) => (u?.user ? u.user : u);

export const getMatchesKey = (userId) => `savedColorMatches:${userId || 'anon'}`;

// Tab icon component factory
export const createTabIcon = (tabIcons) => {
  return ({ name, focused }) => {
    const icons = tabIcons;
    const icon = focused ? icons[name]?.focused : icons[name]?.unfocused;
    return icon || '📱';
  };
};
