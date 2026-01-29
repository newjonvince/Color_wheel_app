// components/AuthenticatedApp.js - Authenticated user flow with navigation
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import PropTypes from 'prop-types';
import TabIcon from './TabIcon';

// CRASH FIX: Lazy-load all screen imports to prevent early module initialization
let _BoardsScreen = null;
let _BoardsScreenLoadAttempted = false;
const getBoardsScreen = () => {
  if (_BoardsScreen) return _BoardsScreen;
  if (_BoardsScreenLoadAttempted) return _BoardsScreen;
  _BoardsScreenLoadAttempted = true;
  try {
    const mod = require('../screens/BoardsScreen');
    _BoardsScreen = mod?.default || mod;
  } catch (error) {
    console.warn('AuthenticatedApp: BoardsScreen load failed', error?.message);
    _BoardsScreen = function BoardsScreenLoadFailure() {
      throw new Error(`BoardsScreen load failed: ${error?.message || String(error)}`);
    };
  }
  return _BoardsScreen;
};

let _CommunityFeedScreen = null;
let _CommunityFeedScreenLoadAttempted = false;
const getCommunityFeedScreen = () => {
  if (_CommunityFeedScreen) return _CommunityFeedScreen;
  if (_CommunityFeedScreenLoadAttempted) return _CommunityFeedScreen;
  _CommunityFeedScreenLoadAttempted = true;
  try {
    const mod = require('../screens/CommunityFeedScreen');
    _CommunityFeedScreen = mod?.default || mod;
  } catch (error) {
    console.warn('AuthenticatedApp: CommunityFeedScreen load failed', error?.message);
    _CommunityFeedScreen = function CommunityFeedScreenLoadFailure() {
      throw new Error(`CommunityFeedScreen load failed: ${error?.message || String(error)}`);
    };
  }
  return _CommunityFeedScreen;
};

let _UserSettingsScreen = null;
let _UserSettingsScreenLoadAttempted = false;
const getUserSettingsScreen = () => {
  if (_UserSettingsScreen) return _UserSettingsScreen;
  if (_UserSettingsScreenLoadAttempted) return _UserSettingsScreen;
  _UserSettingsScreenLoadAttempted = true;
  try {
    const mod = require('../screens/UserSettingsScreen');
    _UserSettingsScreen = mod?.default || mod;
  } catch (error) {
    console.warn('AuthenticatedApp: UserSettingsScreen load failed', error?.message);
    _UserSettingsScreen = function UserSettingsScreenLoadFailure() {
      throw new Error(`UserSettingsScreen load failed: ${error?.message || String(error)}`);
    };
  }
  return _UserSettingsScreen;
};

let _ColorWheelScreen = null;
let _ColorWheelScreenLoadAttempted = false;
let _ColorWheelScreenLoadError = null;
const getColorWheelScreen = () => {
  if (_ColorWheelScreen) return _ColorWheelScreen;
  if (_ColorWheelScreenLoadAttempted) return _ColorWheelScreen;
  _ColorWheelScreenLoadAttempted = true;
  try {
    const mod = require('../screens/ColorWheelScreen');
    _ColorWheelScreen = mod?.default || mod;
  } catch (error) {
    _ColorWheelScreenLoadError = error;
    const message = error?.message || String(error);
    _ColorWheelScreen = function ColorWheelScreenLoadFailure() {
      throw new Error(`ColorWheelScreen load failed: ${message}`);
    };
  }
  return _ColorWheelScreen;
};

const Tab = createBottomTabNavigator();

/**
 * AuthenticatedApp - Main app navigation for authenticated users
 * This component renders the bottom tab navigation with all main screens
 */
const AuthenticatedApp = ({ user, handleLogout }) => {
  const [colorWheelReady, setColorWheelReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setColorWheelReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Memoize screen options for performance
  const screenOptions = useMemo(() => ({
    headerShown: true,
    headerStyle: {
      backgroundColor: '#fff',
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    headerTitleStyle: {
      fontWeight: '600',
      fontSize: 18,
    },
    tabBarStyle: {
      backgroundColor: '#fff',
      borderTopColor: '#f0f0f0',
      paddingBottom: Platform.OS === 'ios' ? 20 : 5,
      paddingTop: 5,
      height: Platform.OS === 'ios' ? 85 : 60,
    },
    tabBarActiveTintColor: '#e74c3c',
    tabBarInactiveTintColor: '#95a5a6',
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '500',
    },
  }), []);

  // Logout button for settings screen header
  const renderLogoutButton = useCallback(() => (
    <TouchableOpacity 
      style={styles.logoutButton}
      onPress={handleLogout}
      accessibilityLabel="Log out"
      accessibilityRole="button"
    >
      <Text style={styles.logoutButtonText}>Logout</Text>
    </TouchableOpacity>
  ), [handleLogout]);

  // Tab icon renderer - uses tab name that matches TabIcon component's TAB_ICONS
  const renderTabIcon = useCallback((tabName) => ({ focused, color, size }) => (
    <TabIcon name={tabName} focused={focused} color={color} size={size} />
  ), []);

  const LoadingPlaceholder = useCallback(() => (
    <View style={styles.loadingPlaceholder}>
      <ActivityIndicator size="large" color="#e74c3c" />
      <Text style={styles.loadingPlaceholderText}>Loading...</Text>
    </View>
  ), []);

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="ColorWheel"
        options={{
          title: 'Color Wheel',
          headerTitle: 'Fashion Color Wheel',
          tabBarIcon: renderTabIcon('ColorWheel'),
        }}
      >
        {(props) => (
          colorWheelReady
            ? (() => {
              const ColorWheelScreen = getColorWheelScreen();
              return (
                <ColorWheelScreen
                  {...props}
                  currentUser={user}
                  onLogout={handleLogout}
                />
              );
            })()
            : <LoadingPlaceholder />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Boards"
        options={{
          title: 'Boards',
          headerTitle: 'My Boards',
          tabBarIcon: renderTabIcon('Boards'),
        }}
      >
        {(props) => {
          const BoardsScreen = getBoardsScreen();
          return (
            <BoardsScreen
              {...props}
              currentUser={user}
            />
          );
        }}
      </Tab.Screen>
      <Tab.Screen
        name="Community"
        options={{
          title: 'Community',
          headerTitle: 'Community',
          tabBarIcon: renderTabIcon('Community'),
        }}
      >
        {(props) => {
          const CommunityFeedScreen = getCommunityFeedScreen();
          return (
            <CommunityFeedScreen
              {...props}
              currentUser={user}
            />
          );
        }}
      </Tab.Screen>
      <Tab.Screen
        name="Settings"
        options={{
          title: 'Settings',
          headerTitle: 'Settings',
          tabBarIcon: renderTabIcon('Settings'),
          headerRight: renderLogoutButton,
        }}
      >
        {(props) => {
          const UserSettingsScreen = getUserSettingsScreen();
          return (
            <UserSettingsScreen
              {...props}
              currentUser={user}
              onLogout={handleLogout}
            />
          );
        }}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  logoutButton: {
    marginRight: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e74c3c',
    borderRadius: 6,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingPlaceholderText: {
    marginTop: 10,
    color: '#666',
    fontWeight: '500',
  },
});

AuthenticatedApp.propTypes = {
  user: PropTypes.object,
  handleLogout: PropTypes.func.isRequired,
};

AuthenticatedApp.defaultProps = {
  user: null,
};

export default AuthenticatedApp;
