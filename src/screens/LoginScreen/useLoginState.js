// Simple login state hook
import { useState, useCallback, useRef, useEffect } from 'react';
import { safeStorage } from '../../utils/safeStorage';
import ApiService from '../../services/safeApiService';
import {
  validateForm,
  validateEmail,
  withTimeout,
  parseLoginResponse,
  getErrorMessage,
  DEMO_USER,
  TIMEOUTS,
  STORAGE_KEYS,
} from './constants';

export const useOptimizedLoginState = (onLoginSuccess) => {
  // Basic state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  
  // Refs
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  // Simple email validation with debounce
  const debouncedEmailValidation = useCallback((value) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (value && isMountedRef.current) {
        const validation = validateEmail(value);
        if (!validation.isValid) {
          setErrors(prev => ({ ...prev, email: validation.message }));
        } else {
          setErrors(prev => ({ ...prev, email: '' }));
        }
      }
    }, 500); // 500ms debounce - simpler than 300ms
  }, []);

  // Update functions
  const updateEmail = useCallback((value) => {
    setEmail(value);
    setErrors(prev => ({ ...prev, email: '' }));
    if (globalError) setGlobalError('');
    
    // Optional debounced validation for inline errors
    if (value.length > 3) {
      debouncedEmailValidation(value);
    }
  }, [globalError, debouncedEmailValidation]);

  const updatePassword = useCallback((value) => {
    setPassword(value);
    setErrors(prev => ({ ...prev, password: '' }));
    if (globalError) setGlobalError('');
  }, [globalError]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // Focus handlers
  const handleEmailFocus = useCallback(() => {
    setFocusedField('email');
  }, []);

  const handlePasswordFocus = useCallback(() => {
    setFocusedField('password');
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedField(null);
  }, []);

  const focusNextField = useCallback(() => {
    if (passwordRef.current) {
      passwordRef.current.focus();
    }
  }, []);

  // Session save
  const saveSession = useCallback(async ({ user, token }) => {
    try {
      if (token && typeof token !== 'string') {
        throw new Error('Invalid token format');
      }

      await Promise.all([
        safeStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(user)),
        safeStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true'),
        ...(token ? [safeStorage.setItem(STORAGE_KEYS.authToken, token)] : []),
      ]);
    } catch (error) {
      console.error('Session save failed:', error);
      throw new Error('Failed to save login session');
    }
  }, []);

  // Login handler
  const handleLogin = useCallback(async () => {
    if (isProcessingRef.current) return;
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create AbortController with fallback for environments that don't support it
    if (typeof AbortController !== 'undefined') {
      abortControllerRef.current = new AbortController();
    } else {
      abortControllerRef.current = null;
    }
    
    isProcessingRef.current = true;
    setLoading(true);
    setGlobalError('');
    
    try {
      // Simple synchronous validation on submit
      const formValidation = validateForm(email, password);
      if (!formValidation.isValid) {
        setErrors(formValidation.errors);
        return;
      }

      const response = await withTimeout(
        ApiService.login(email.trim(), password, { 
          signal: abortControllerRef.current?.signal 
        }),
        TIMEOUTS.login
      );

      const { user, token } = parseLoginResponse(response);
      
      if (user && token) {
        await saveSession({ user, token });
        onLoginSuccess?.(user);
      } else {
        throw new Error('Invalid login response');
      }

    } catch (error) {
      if (isMountedRef.current) {
        setGlobalError(getErrorMessage(error));
      }
    } finally {
      isProcessingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [email, password, onLoginSuccess, saveSession]);

  // Demo login handler
  const handleDemoLogin = useCallback(async () => {
    if (isProcessingRef.current) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create AbortController with fallback for environments that don't support it
    if (typeof AbortController !== 'undefined') {
      abortControllerRef.current = new AbortController();
    } else {
      abortControllerRef.current = null;
    }
    
    isProcessingRef.current = true;
    setLoading(true);
    setGlobalError('');
    
    try {
      // Try backend demo first
      const response = await withTimeout(
        ApiService.demoLogin({ signal: abortControllerRef.current?.signal }), 
        TIMEOUTS.demoLogin
      );
      const { user, token } = parseLoginResponse(response);
      
      if (user && token) {
        await saveSession({ user, token });
        onLoginSuccess?.(user);
        return;
      }
    } catch (error) {
      // Backend demo failed, use local fallback
    }
    
    // Local demo fallback
    try {
      const demoUser = {
        ...DEMO_USER,
        createdAt: new Date().toISOString(),
      };
      
      await safeStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(demoUser));
      await safeStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true');
      
      if (isMountedRef.current) {
        onLoginSuccess?.(demoUser);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setGlobalError('Demo login failed. Please try again.');
      }
    } finally {
      isProcessingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [onLoginSuccess]);

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
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
  };
};

export default useOptimizedLoginState;
