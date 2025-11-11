// components/AppNavigation.js - Main navigation component
import React, { useMemo, useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';
import { APP_CONFIG } from '../config/app';
import TabIcon from './TabIcon';

export const AppNavigation = ({ 
  Tab, 
  NavigationContainer, 
  ErrorBoundary, 
  StatusBar,
  user,
  screens,
  ColorWheelScreen,
  wheelReloadNonce,
  saveColorMatch,
  savedColorMatches,
  handleLogout,
  handleAccountDeleted,
  retryLoadColorWheel,
}) => {
  // Memoize screen options to prevent re-renders
  const screenOptions = useCallback(({ route }) => ({
    tabBarIcon: ({ focused }) => <TabIcon focused={focused} name={route.name} />,
    ...APP_CONFIG.tabNavigation.screenOptions,
    tabBarStyle: styles.tabBar,
    tabBarLabelStyle: styles.tabLabel,
  }), []);

  // Memoize ColorWheel screen component
  const ColorWheelComponent = useCallback((props) => (
    <ColorWheelScreen
      key={wheelReloadNonce}
      {...props}
      currentUser={user || null}
      onSaveColorMatch={saveColorMatch}
      onLogout={handleLogout}
      onRetry={retryLoadColorWheel}
      navigation={props?.navigation}
    />
  ), [wheelReloadNonce, user, saveColorMatch, handleLogout, retryLoadColorWheel]);

  return (
    <ErrorBoundary>
      <NavigationContainer linking={APP_CONFIG.linking} fallback={<Text>Loading…</Text>}>
        <StatusBar style="dark" />
        <Tab.Navigator
          {...APP_CONFIG.tabNavigation.options}
          initialRouteName={APP_CONFIG.tabNavigation.initialRouteName}
          screenOptions={screenOptions}
        >
          <Tab.Screen name="ColorWheel" options={{ title: 'Wheel' }}>
            {ColorWheelComponent}
          </Tab.Screen>

          <Tab.Screen name="Community" options={{ title: 'Community' }}>
            {(props) => (
              <screens.CommunityFeedScreen 
                {...props} 
                currentUser={user} 
                onSaveColorMatch={saveColorMatch} 
                onLogout={handleLogout} 
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Profile" options={{ title: 'Profile' }}>
            {(props) => (
              <screens.BoardsScreen 
                {...props} 
                currentUser={user} 
                savedColorMatches={savedColorMatches} 
                onSaveColorMatch={saveColorMatch} 
                onLogout={handleLogout} 
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Settings" options={{ title: 'Settings' }}>
            {(props) => (
              <screens.UserSettingsScreen 
                {...props} 
                currentUser={user} 
                onLogout={handleLogout} 
                onAccountDeleted={handleAccountDeleted} 
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  tabBar: { 
    backgroundColor: 'white', 
    borderTopWidth: 1, 
    borderTopColor: '#e9ecef', 
    paddingBottom: 5, 
    paddingTop: 5, 
    height: 65 
  },
  tabIcon: { fontSize: 24 },
  tabIconImage: { 
    width: 24, 
    height: 24 
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },
});
