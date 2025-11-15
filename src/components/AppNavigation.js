// components/AppNavigation.js - Navigation wrapper using AuthenticatedApp
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AuthenticatedApp from './AuthenticatedApp';

export const AppNavigation = ({ 
  Tab, 
  NavigationContainer, 
  ErrorBoundary, 
  StatusBar,
  user,
  screens,
  ColorWheelScreen,
  wheelReloadNonce,
  handleLogout,
  handleAccountDeleted,
  retryLoadColorWheel,
}) => {
  // ✅ CONSOLIDATION FIX: Use AuthenticatedApp as single source of tab navigation
  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      <AuthenticatedApp 
        user={user} 
        handleLogout={handleLogout}
      />
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
