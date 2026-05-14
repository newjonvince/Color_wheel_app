// LoginScreen/index.js
// FIX: Comprehensive child sanitization to prevent "Text strings must be rendered within a <Text> component" error
import React, { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, Text } from 'react-native';
import PropTypes from 'prop-types';
import LoginHeader from './components/LoginHeader';
import ErrorBanner from './components/ErrorBanner';
import LoginForm from './components/LoginForm';
import LoginButtons from './components/LoginButtons';

import { useOptimizedLoginState } from './useLoginState';
import { optimizedStyles, optimizedColors } from './styles';

let _LinearGradientModule = undefined;
const getLinearGradient = () => {
  if (_LinearGradientModule !== undefined) return _LinearGradientModule;
  try {
    const mod = require('expo-linear-gradient');
    _LinearGradientModule = mod?.LinearGradient || mod;
  } catch (error) {
    console.warn('LoginScreen: expo-linear-gradient load failed', error?.message || error);
    _LinearGradientModule = null;
  }
  return _LinearGradientModule;
};

// FIX: Recursive child sanitizer that handles ALL edge cases
const sanitizeChildren = (children) => {
  // Handle null, undefined, or boolean (React ignores these)
  if (children === null || children === undefined || typeof children === 'boolean') {
    return null;
  }
  
  // Handle strings and numbers - wrap in Text
  if (typeof children === 'string') {
    // Empty strings can cause issues too
    if (children.trim() === '') return null;
    return <Text>{children}</Text>;
  }
  
  if (typeof children === 'number') {
    return <Text>{String(children)}</Text>;
  }
  
  // Handle arrays - recursively sanitize each element
  if (Array.isArray(children)) {
    return children.map((child, index) => {
      const sanitized = sanitizeChildren(child);
      // Add key if it's a valid element without one
      if (React.isValidElement(sanitized) && sanitized.key === null) {
        return React.cloneElement(sanitized, { key: index });
      }
      return sanitized;
    }).filter(Boolean); // Remove nulls
  }
  
  // Handle React elements - return as-is (they handle their own children)
  if (React.isValidElement(children)) {
    return children;
  }
  
  // Handle fragments
  if (children?.type === React.Fragment) {
    return sanitizeChildren(children.props.children);
  }
  
  // Fallback: if it's some other type, ignore it
  console.warn('LoginScreen: Unknown child type', typeof children);
  return null;
};

const LinearGradient = ({ children, style, colors, ...rest }) => {
  const Comp = getLinearGradient();
  
  // FIX: Validate colors array
  const safeColors = useMemo(() => {
    if (!Array.isArray(colors) || colors.length < 2) {
      console.warn('LoginScreen: Invalid colors prop, using fallback');
      return ['#ff4fb2', '#24d39a', '#2b4bff']; // Fallback gradient colors
    }
    // Ensure all colors are strings
    return colors.map(c => (typeof c === 'string' ? c : '#ff4fb2'));
  }, [colors]);
  
  // FIX: Sanitize all children
  const safeChildren = useMemo(() => sanitizeChildren(children), [children]);
  
  if (!Comp) {
    // Fallback to View with first color as background
    return (
      <View style={[style, { backgroundColor: safeColors[0] }]}>
        {safeChildren}
      </View>
    );
  }
  
  return (
    <Comp style={style} colors={safeColors} {...rest}>
      {safeChildren}
    </Comp>
  );
};

// Memoize to avoid unnecessary re-renders
LinearGradient.displayName = 'LinearGradient';

const LoginScreen = ({ onLoginSuccess }) => {
  const state = useOptimizedLoginState(onLoginSuccess);

  const {
    email,
    password,
    showPassword,
    loading,
    errors,
    globalError,
    focusedField,
    emailRef,
    passwordRef,
    updateEmail,
    updatePassword,
    togglePasswordVisibility,
    handleEmailFocus,
    handlePasswordFocus,
    handleBlur,
    focusNextField,
    handleLogin,
    handleDemoLogin,
  } = state;

  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : 'height';

  // FIX: Memoize gradient colors to ensure stable reference
  const gradientColors = useMemo(() => [
    optimizedColors.gradientStart,
    optimizedColors.gradientMid,
    optimizedColors.gradientEnd,
  ], []);

  // FIX: Ensure errors is always an object
  const safeErrors = errors || {};

  return (
    <LinearGradient colors={gradientColors} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={optimizedStyles.keyboardAvoidingView}
        behavior={keyboardBehavior}
      >
        <ScrollView
          contentContainerStyle={optimizedStyles.scrollContainer}
        >
          <LoginHeader />

          <ErrorBanner message={globalError} />

          <View style={optimizedStyles.form}>
            <LoginForm
              email={email}
              password={password}
              showPassword={showPassword}
              errors={safeErrors}
              focusedField={focusedField}
              emailRef={emailRef}
              passwordRef={passwordRef}
              onEmailChange={updateEmail}
              onPasswordChange={updatePassword}
              onTogglePassword={togglePasswordVisibility}
              onEmailFocus={handleEmailFocus}
              onPasswordFocus={handlePasswordFocus}
              onBlur={handleBlur}
              onFocusNext={focusNextField}
              onSubmit={handleLogin}
            />

            <LoginButtons
              loading={loading}
              onLogin={handleLogin}
              onDemo={handleDemoLogin}
              onSignUp={() => {}}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

LoginScreen.propTypes = {
  onLoginSuccess: PropTypes.func,
};

LoginScreen.defaultProps = {
  onLoginSuccess: () => {},
};

export default LoginScreen;
