// components/AuthenticatedApp.js - Authenticated user flow with navigation
import React, { useCallback, useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import PropTypes from 'prop-types';
// Use shared helper to avoid duplicate code
import { isDebugMode } from '../utils/expoConfigHelper';

// Screen imports
import ColorWheelScreen from '../screens/ColorWheelScreen';
import BoardsScreen from '../screens/BoardsScreen';
import CommunityFeedScreen from '../screens/CommunityFeedScreen';
import UserSettingsScreen from '../screens/UserSettingsScreen';

// Tab icon component
import TabIcon from './TabIcon';

const Tab = createBottomTabNavigator();

let _isDebugModeValue = null;
const IS_DEBUG_MODE = () => {
  if (_isDebugModeValue === null) {
    _isDebugModeValue = isDebugMode();
  }
  return _isDebugModeValue;
};

/**
 * AuthenticatedApp - Main app navigation for authenticated users
 * This component renders the bottom tab navigation with all main screens
 */
const AuthenticatedApp = ({ user, handleLogout }) => {
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

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen
          name="ColorWheel"
          component={ColorWheelScreen}
          options={{
            title: 'Color Wheel',
            headerTitle: 'Fashion Color Wheel',
            tabBarIcon: renderTabIcon('ColorWheel'),
          }}
        />
        <Tab.Screen
          name="Boards"
          component={BoardsScreen}
          options={{
            title: 'Boards',
            headerTitle: 'My Boards',
            tabBarIcon: renderTabIcon('Boards'),
          }}
        />
        <Tab.Screen
          name="Community"
          component={CommunityFeedScreen}
          options={{
            title: 'Community',
            headerTitle: 'Community',
            tabBarIcon: renderTabIcon('Community'),
          }}
        />
        <Tab.Screen
          name="Settings"
          options={{
            title: 'Settings',
            headerTitle: 'Settings',
            tabBarIcon: renderTabIcon('Settings'),
            headerRight: renderLogoutButton,
          }}
        >
          {(props) => <UserSettingsScreen {...props} user={user} onLogout={handleLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
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
});

AuthenticatedApp.propTypes = {
  user: PropTypes.object,
  handleLogout: PropTypes.func.isRequired,
};

AuthenticatedApp.defaultProps = {
  user: null,
};

export default AuthenticatedApp;
