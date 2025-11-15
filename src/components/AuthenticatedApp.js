// components/AuthenticatedApp.js - Main app content for authenticated users
import React, { useCallback, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView, Text } from 'react-native';
import Constants from 'expo-constants';

// Production-ready configuration
const extra = Constants.expoConfig?.extra || {};
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

import ColorWheelScreen from '../screens/ColorWheelScreen';
import CommunityFeedScreen from '../screens/CommunityFeedScreen';
import BoardsScreen from '../screens/BoardsScreen';
import UserSettingsScreen from '../screens/UserSettingsScreen';
import TabIcon from './TabIcon';
import { APP_CONFIG } from '../config/app';

const Tab = createBottomTabNavigator();

// ✅ Memoized TabIcon to prevent re-renders
const TabIconMemo = React.memo(({ focused, name }) => (
  <TabIcon focused={focused} name={name} />
));

const AuthenticatedApp = React.memo(({ user, handleLogout }) => {
  // ✅ Stable screen options - no dependencies on props
  const getScreenOptions = useCallback(({ route }) => ({
    tabBarIcon: ({ focused, color, size }) => <TabIconMemo focused={focused} name={route.name} />,
    ...APP_CONFIG.tabNavigation.screenOptions,
  }), []);

  // ✅ SAFER: Wrap navigation in try-catch with fallback
  const renderNavigation = () => {
    try {
      return (
        <NavigationContainer 
          linking={APP_CONFIG.linking}
          fallback={<SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Loading navigation...</Text></SafeAreaView>}
          onStateChange={(state) => {
            if (IS_DEBUG_MODE) console.log('Nav state:', state);
          }}
          onError={(error) => {
            console.error('🚨 Navigation error:', error);
          }}
        >
          <Tab.Navigator
            initialRouteName={APP_CONFIG.tabNavigation.initialRouteName}
            screenOptions={getScreenOptions}
            {...APP_CONFIG.tabNavigation.options}
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
      console.error('🚨 Failed to render navigation:', error);
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ textAlign: 'center' }}>Navigation failed. Please restart the app.</Text>
        </SafeAreaView>
      );
    }
  };

  return renderNavigation();
});

AuthenticatedApp.displayName = 'AuthenticatedApp';

export default AuthenticatedApp;
