// index.js (LoginScreen)
import React from 'react';
import { SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LoginHeader from './components/LoginHeader';
import LoginForm from './components/LoginForm';
import LoginButtons from './components/LoginButtons';
import ErrorBanner from './components/ErrorBanner';
import { optimizedStyles as styles, optimizedColors } from './styles';
import { useOptimizedLoginState } from './useLoginState';

export default function LoginScreen(props) {
  // Call hook directly at top level - let Error Boundary handle any errors
  const {
    email = '',
    password = '',
    showPassword = false,
    loading = false,
    errors = {},
    globalError = '',
    focusedField = null,
    emailRef = null,
    passwordRef = null,
    updateEmail = () => {},
    updatePassword = () => {},
    togglePasswordVisibility = () => {},
    handleEmailFocus = () => {},
    handlePasswordFocus = () => {},
    handleBlur = () => {},
    focusNextField = () => {},
    handleLogin = () => {},
    handleDemoLogin = () => {},
  } = useOptimizedLoginState(props.onLoginSuccess) || {};

  // Create props for components
  const formProps = {
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
  };

  const buttonProps = {
    loading,
    onLogin: handleLogin,
    onDemo: handleDemoLogin,
    onSignUp: () => {}, // Placeholder for sign up functionality
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <LinearGradient
          colors={[optimizedColors.gradientStart, optimizedColors.gradientMid, optimizedColors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <LoginHeader />
            <ErrorBanner message={globalError} />
            <View style={styles.form}>
              <LoginForm {...formProps} />
              <LoginButtons {...buttonProps} />
            </View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
