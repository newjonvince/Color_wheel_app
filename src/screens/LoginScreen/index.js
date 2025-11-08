// screens/LoginScreen/index.js - Refactored LoginScreen
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import PropTypes from 'prop-types';

// Components
import { LoginHeader } from './components/LoginHeader';
import { ErrorBanner } from './components/ErrorBanner';
import { LoginForm } from './components/LoginForm';
import { LoginButtons } from './components/LoginButtons';
import { LoginFooter } from './components/LoginFooter';

// Hooks and styles
import { useLoginState } from './useLoginState';
import { styles } from './styles';

const LoginScreen = ({ onLoginSuccess, onSignUpPress }) => {
  // State management through custom hook
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
    
    // Actions
    updateEmail,
    updatePassword,
    togglePasswordVisibility,
    handleEmailFocus,
    handlePasswordFocus,
    handleBlur,
    focusNextField,
    handleLogin,
    handleDemoLogin,
  } = useLoginState(onLoginSuccess);

  return (
    <KeyboardAvoidingView 
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LoginHeader />
        
        <KeyboardAvoidingView style={styles.form}>
          <ErrorBanner message={globalError} />
          
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
            onDemoLogin={handleDemoLogin}
          />
        </KeyboardAvoidingView>
        
        <LoginFooter onSignUpPress={onSignUpPress} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// PropTypes for better development experience
LoginScreen.propTypes = {
  onLoginSuccess: PropTypes.func,
  onSignUpPress: PropTypes.func,
};

LoginScreen.defaultProps = {
  onLoginSuccess: () => {},
  onSignUpPress: () => {},
};

export default React.memo(LoginScreen);
