// components/AuthScreens.js - Authentication screens component
import React from 'react';
import { Text } from 'react-native';
import { getStatusBarStyle } from '../config/app';

export const AuthScreens = ({ 
  SafeAreaProvider, 
  SafeAreaView, 
  StatusBar,
  showSignUp, 
  setShowSignUp,
  screens,
  handleLoginSuccess,
  handleSignUpComplete,
}) => (
  <SafeAreaProvider>
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style={getStatusBarStyle()} />
      {showSignUp ? (
        screens.SignUpScreen ? (
          <screens.SignUpScreen 
            onSignUpComplete={handleSignUpComplete} 
            onBackToLogin={() => setShowSignUp(false)} 
          />
        ) : (
          <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ fontSize: 18, color: '#ff6b6b', marginBottom: 8 }}>Sign Up Unavailable</Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
              Sign up is temporarily unavailable. Please try again later.
            </Text>
          </SafeAreaView>
        )
      ) : (
        screens.LoginScreen ? (
          <screens.LoginScreen 
            onLoginSuccess={handleLoginSuccess} 
            onSignUpPress={() => setShowSignUp(true)} 
          />
        ) : (
          <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ fontSize: 18, color: '#ff6b6b', marginBottom: 8 }}>Login Unavailable</Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
              Login is temporarily unavailable. Please restart the app.
            </Text>
          </SafeAreaView>
        )
      )}
    </SafeAreaView>
  </SafeAreaProvider>
);
