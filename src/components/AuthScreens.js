// components/AuthScreens.js - Authentication screens component
import React from 'react';
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
        <screens.SignUpScreen 
          onSignUpComplete={handleSignUpComplete} 
          onBackToLogin={() => setShowSignUp(false)} 
        />
      ) : (
        <screens.LoginScreen 
          onLoginSuccess={handleLoginSuccess} 
          onSignUpPress={() => setShowSignUp(true)} 
        />
      )}
    </SafeAreaView>
  </SafeAreaProvider>
);
