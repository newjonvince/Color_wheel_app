// components/UnauthenticatedApp.js - Auth flow for unauthenticated users
import React, { useState } from 'react';
import { SafeAreaView, View, Text } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';

const UnauthenticatedApp = React.memo(({ handleLoginSuccess }) => {
  const [showSignUp, setShowSignUp] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      {showSignUp ? (
        <SignUpScreen 
          onSignUpComplete={handleLoginSuccess}
          onBackToLogin={() => setShowSignUp(false)}
        />
      ) : (
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess}
          onSwitchToSignUp={() => setShowSignUp(true)}
        />
      )}
    </SafeAreaView>
  );
});

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 32,
  },
  switchAuth: {
    fontSize: 16,
    color: '#3498db',
    textDecorationLine: 'underline',
  },
};

UnauthenticatedApp.displayName = 'UnauthenticatedApp';

export default UnauthenticatedApp;
