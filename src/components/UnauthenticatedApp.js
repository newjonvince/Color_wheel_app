// components/UnauthenticatedApp.js - Unauthenticated user flow
import React from 'react';
import PropTypes from 'prop-types';
import LoginScreen from '../screens/LoginScreen';

/**
 * UnauthenticatedApp - Renders the login flow for unauthenticated users
 * This component is shown when no user is logged in
 */
const UnauthenticatedApp = ({ handleLoginSuccess }) => {
  return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
};

UnauthenticatedApp.propTypes = {
  handleLoginSuccess: PropTypes.func.isRequired,
};

export default UnauthenticatedApp;
