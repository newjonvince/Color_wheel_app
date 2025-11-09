// screens/LoginScreen/index.js - Ultra-optimized LoginScreen with performance enhancements
import React, { Suspense, useMemo, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, Text } from 'react-native';
import PropTypes from 'prop-types';

// Lazy load components for better performance
const LoginHeader = React.lazy(() => import('./components/LoginHeader').then(m => ({ default: m.LoginHeader })));
const ErrorBanner = React.lazy(() => import('./components/ErrorBanner').then(m => ({ default: m.ErrorBanner })));
const LoginForm = React.lazy(() => import('./components/LoginForm').then(m => ({ default: m.LoginForm })));
const LoginButtons = React.lazy(() => import('./components/LoginButtons').then(m => ({ default: m.LoginButtons })));
const LoginFooter = React.lazy(() => import('./components/LoginFooter').then(m => ({ default: m.LoginFooter })));

// Hooks and styles
import { useOptimizedLoginState } from './useLoginState';
import { optimizedStyles } from './styles';

// Performance monitoring
const performanceMonitor = __DEV__ ? {
  startTime: Date.now(),
  logTiming: (label) => {
    const duration = Date.now() - performanceMonitor.startTime;
    if (duration > 100) { // Only log slow operations
      console.log(`⏱️ LoginScreen ${label}: ${duration}ms`);
    }
  }
} : { logTiming: () => {} };

// Minimal loading component for Suspense
const LoginLoadingFallback = React.memo(() => (
  <View style={optimizedStyles.loadingContainer}>
    <Text style={optimizedStyles.loadingText}>Loading...</Text>
  </View>
));

// Error boundary for login components
class LoginErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('LoginScreen Error:', error, errorInfo);
    
    // In production, log to crash reporting service
    if (!__DEV__) {
      // logErrorToService('LoginScreen', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={optimizedStyles.errorContainer}>
          <Text style={optimizedStyles.errorTitle}>Login Error</Text>
          <Text style={optimizedStyles.errorMessage}>
            Something went wrong. Please try again.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const OptimizedLoginScreen = ({ onLoginSuccess, onSignUpPress }) => {
  performanceMonitor.logTiming('render start');

  // Optimized state management with memoization and debouncing
  const loginState = useOptimizedLoginState(onLoginSuccess);
  
  // Memoized destructuring to prevent unnecessary re-renders
  const {
    // Form state
    email,
    password,
    showPassword,
    
    // UI state
    loading,
    errors,
    globalError,
    focusedField,
    
    // Refs
    emailRef,
    passwordRef,
    
    // Actions (already memoized in hook)
    updateEmail,
    updatePassword,
    togglePasswordVisibility,
    handleEmailFocus,
    handlePasswordFocus,
    handleBlur,
    focusNextField,
    handleLogin,
    handleDemoLogin,
  } = loginState;

  // Memoized form props to prevent unnecessary re-renders
  const formProps = useMemo(() => ({
    email,
    password,
    showPassword,
    errors,
    focusedField,
    emailRef,
    passwordRef,
    onEmailChange: updateEmail,
    onPasswordChange: updatePassword,
    onTogglePassword: togglePasswordVisibility,
    onEmailFocus: handleEmailFocus,
    onPasswordFocus: handlePasswordFocus,
    onBlur: handleBlur,
    onFocusNext: focusNextField,
    onSubmit: handleLogin,
  }), [
    email, password, showPassword, errors, focusedField,
    emailRef, passwordRef, updateEmail, updatePassword,
    togglePasswordVisibility, handleEmailFocus, handlePasswordFocus,
    handleBlur, focusNextField, handleLogin
  ]);

  // Memoized button props
  const buttonProps = useMemo(() => ({
    loading,
    onLogin: handleLogin,
    onDemoLogin: handleDemoLogin,
  }), [loading, handleLogin, handleDemoLogin]);

  // Memoized footer props
  const footerProps = useMemo(() => ({
    onSignUpPress,
  }), [onSignUpPress]);

  // Memoized keyboard avoiding behavior
  const keyboardBehavior = useMemo(() => 
    Platform.OS === 'ios' ? 'padding' : 'height'
  , []);

  performanceMonitor.logTiming('render complete');

  return (
    <LoginErrorBoundary>
      <KeyboardAvoidingView 
        style={optimizedStyles.keyboardAvoidingView}
        behavior={keyboardBehavior}
      >
        <ScrollView 
          contentContainerStyle={optimizedStyles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
        >
          <Suspense fallback={<LoginLoadingFallback />}>
            <LoginHeader />
          </Suspense>
          
          <KeyboardAvoidingView style={optimizedStyles.form}>
            <Suspense fallback={<LoginLoadingFallback />}>
              <ErrorBanner message={globalError} />
            </Suspense>
            
            <Suspense fallback={<LoginLoadingFallback />}>
              <LoginForm {...formProps} />
            </Suspense>
            
            <Suspense fallback={<LoginLoadingFallback />}>
              <LoginButtons {...buttonProps} />
            </Suspense>
          </KeyboardAvoidingView>
          
          <Suspense fallback={<LoginLoadingFallback />}>
            <LoginFooter {...footerProps} />
          </Suspense>
        </ScrollView>
      </KeyboardAvoidingView>
    </LoginErrorBoundary>
  );
};

// Optimized PropTypes with better validation
OptimizedLoginScreen.propTypes = {
  onLoginSuccess: PropTypes.func,
  onSignUpPress: PropTypes.func,
};

OptimizedLoginScreen.defaultProps = {
  onLoginSuccess: () => {},
  onSignUpPress: () => {},
};

// Export with React.memo and custom comparison for better performance
const arePropsEqual = (prevProps, nextProps) => {
  return (
    prevProps.onLoginSuccess === nextProps.onLoginSuccess &&
    prevProps.onSignUpPress === nextProps.onSignUpPress
  );
};

export default React.memo(OptimizedLoginScreen, arePropsEqual);
