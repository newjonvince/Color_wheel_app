// screens/LoginScreen/useLoginState.js - Login state management hook
import { useState, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../../services/api';
import { 
  validateForm, 
  withTimeout, 
  parseLoginResponse, 
  getErrorMessage,
  DEMO_USER,
  TIMEOUTS,
  STORAGE_KEYS 
} from './constants';

export const useLoginState = (onLoginSuccess) => {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  
  // Refs for form management
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Clear errors when user starts typing
  const clearFieldError = useCallback((field) => {
    setErrors(prev => ({ ...prev, [field]: '' }));
    setGlobalError('');
  }, []);

  // Update email with validation
  const updateEmail = useCallback((value) => {
    setEmail(value);
    clearFieldError('email');
  }, [clearFieldError]);

  // Update password with validation
  const updatePassword = useCallback((value) => {
    setPassword(value);
    clearFieldError('password');
  }, [clearFieldError]);

  // Toggle password visibility
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // Focus management
  const handleEmailFocus = useCallback(() => setFocusedField('email'), []);
  const handlePasswordFocus = useCallback(() => setFocusedField('password'), []);
  const handleBlur = useCallback(() => setFocusedField(null), []);

  // Focus next field
  const focusNextField = useCallback(() => {
    if (passwordRef.current) {
      passwordRef.current.focus();
    }
  }, []);

  // Session management
  const saveSession = useCallback(async ({ user, token }) => {
    try {
      const sessionPromise = Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(user)),
        AsyncStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true'),
      ]);

      if (token) {
        const tokenPromise = Promise.all([
          SecureStore.setItemAsync(STORAGE_KEYS.authToken, token, { 
            keychainService: 'fashioncolorwheel.auth' 
          }),
          SecureStore.setItemAsync(STORAGE_KEYS.legacyAuthToken, token, { 
            keychainService: 'fashioncolorwheel.auth' 
          }),
          ApiService.setToken(token),
        ]);

        await Promise.all([sessionPromise, tokenPromise]);
        await ApiService.ready;
      } else {
        await sessionPromise;
      }
    } catch (error) {
      console.warn('Failed to persist session:', error?.message);
      throw new Error('Failed to save login session');
    }
  }, []);

  // Validate form
  const validateCurrentForm = useCallback(() => {
    const validation = validateForm(email, password);
    setErrors(validation.errors);
    return validation.isValid;
  }, [email, password]);

  // Handle login
  const handleLogin = useCallback(async () => {
    if (loading) return;
    
    // Clear previous errors
    setGlobalError('');
    
    // Validate form
    if (!validateCurrentForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await withTimeout(
        ApiService.login(email.trim().toLowerCase(), password), 
        TIMEOUTS.login
      );

      const { user, token } = parseLoginResponse(response);

      if (!user || !token) {
        const message = response?.message || 'Server did not return user/token.';
        setGlobalError(message);
        return;
      }

      await saveSession({ user, token });
      onLoginSuccess?.(user);
    } catch (error) {
      console.error('Login error:', error);
      const message = getErrorMessage(error);
      setGlobalError(message);
    } finally {
      setLoading(false);
    }
  }, [email, password, loading, validateCurrentForm, saveSession, onLoginSuccess]);

  // Handle demo login
  const handleDemoLogin = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    setGlobalError('');
    
    if (__DEV__) console.log('🔍 LoginScreen: Demo login started...');
    
    try {
      const response = await withTimeout(ApiService.demoLogin(), TIMEOUTS.demoLogin);
      const { user, token } = parseLoginResponse(response);
      
      if (user && token) {
        if (__DEV__) console.log('🔍 LoginScreen: Backend demo login successful');
        await saveSession({ user, token });
        onLoginSuccess?.(user);
      } else {
        // Fallback to local demo user
        if (__DEV__) console.log('🔍 LoginScreen: Using local demo fallback');
        await handleLocalDemoFallback();
      }
    } catch (error) {
      console.error('Demo login error:', error);
      // Fallback to local demo user
      try {
        await handleLocalDemoFallback();
      } catch (fallbackError) {
        console.error('Demo fallback error:', fallbackError);
        setGlobalError('Failed to start demo. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [loading, saveSession, onLoginSuccess]);

  // Local demo fallback
  const handleLocalDemoFallback = useCallback(async () => {
    const demoUser = {
      ...DEMO_USER,
      createdAt: new Date().toISOString(),
    };
    
    await AsyncStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(demoUser));
    await AsyncStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true');
    onLoginSuccess?.(demoUser);
  }, [onLoginSuccess]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
    setGlobalError('');
  }, []);

  return {
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
    clearErrors,
    validateCurrentForm,
  };
};
