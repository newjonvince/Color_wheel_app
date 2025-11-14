import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PropTypes from 'prop-types';

import LoginHeader from './components/LoginHeader';
import ErrorBanner from './components/ErrorBanner';
import LoginForm from './components/LoginForm';
import LoginButtons from './components/LoginButtons';

import { useOptimizedLoginState } from './useLoginState';
import { optimizedStyles, optimizedColors } from './styles';

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

  return (
    <LinearGradient
      colors={[
        optimizedColors.gradientStart,
        optimizedColors.gradientMid,
        optimizedColors.gradientEnd,
      ]}
      style={{ flex: 1 }}
    >
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
              errors={errors}
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
