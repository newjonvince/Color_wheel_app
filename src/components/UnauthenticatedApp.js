// components/UnauthenticatedApp.js - Unauthenticated user flow
import React from 'react';
import PropTypes from 'prop-types';

let _LoginScreen = null;
const getLoginScreen = () => {
  if (_LoginScreen) return _LoginScreen;
  try {
    const mod = require('../screens/LoginScreen');
    _LoginScreen = mod?.default || mod;
  } catch (error) {
    console.warn('UnauthenticatedApp: LoginScreen load failed', error?.message || error);
    _LoginScreen = () => null;
  }
  return _LoginScreen;
};

/**
 * UnauthenticatedApp - Renders the login flow for unauthenticated users
 * This component is shown when no user is logged in
 */
const UnauthenticatedApp = ({ handleLoginSuccess }) => {
  const LoginScreen = getLoginScreen();
  return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
};

UnauthenticatedApp.propTypes = {
  handleLoginSuccess: PropTypes.func.isRequired,
};

export default UnauthenticatedApp;
