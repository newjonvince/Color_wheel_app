// screens/LoginScreen/useOptimizedLoginState.js - Ultra-optimized login state with debouncing and caching
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { safeStorage } from '../../utils/safeStorage';
import ApiService from '../../services/safeApiService';
import { optimizedConstants } from './constants';
import { getNetworkStatus } from '../../hooks/useNetworkStatus';

const {
  validateForm,
  withTimeout,
  parseLoginResponse,
  getErrorMessage,
  DEMO_USER,
  TIMEOUTS,
  STORAGE_KEYS,
  VALIDATION_RULES,
  debouncedValidation
} = optimizedConstants;

// Performance monitoring
const performanceMonitor = __DEV__ ? {
  startTimer: (label) => {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      if (duration > 50) { // Only log operations taking longer than 50ms
        console.log(`⏱️ LoginState ${label}: ${duration}ms`);
      }
      return duration;
    };
  }
} : {
  startTimer: () => () => 0
};

// Memoized validation cache
const validationCache = new Map();
const cacheValidation = (key, result) => {
  validationCache.set(key, { result, timestamp: Date.now() });
  
  // Clean old cache entries (older than 30 seconds)
  const now = Date.now();
  for (const [cacheKey, entry] of validationCache.entries()) {
    if (now - entry.timestamp > 30000) {
      validationCache.delete(cacheKey);
    }
  }
};

const getCachedValidation = (key) => {
  const cached = validationCache.get(key);
  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached.result;
  }
  return null;
};

export const useOptimizedLoginState = (onLoginSuccess) => {
  // Component mounted flag to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Processing guard to prevent double-submission
  const isProcessingRef = useRef(false);
  
  // AbortController for cancelling network requests
  const abortControllerRef = useRef(null);
  
  // Form state with optimized initial values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // UI state with performance tracking
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  
  // Performance tracking state
  const [validationPerformance, setValidationPerformance] = useState({
    emailValidations: 0,
    passwordValidations: 0,
    totalTime: 0
  });
  
  // Refs for form management and debouncing
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastValidationRef = useRef({ email: '', password: '' });

  // Memoized validation functions with caching
  const validateEmailMemo = useMemo(() => {
    return (emailValue) => {
      const cacheKey = `email_${emailValue}`;
      const cached = getCachedValidation(cacheKey);
      if (cached) return cached;

      const endTimer = performanceMonitor.startTimer('email validation');
      const result = debouncedValidation.validateEmail(emailValue);
      endTimer();
      
      cacheValidation(cacheKey, result);
      return result;
    };
  }, []);

  const validatePasswordMemo = useMemo(() => {
    return (passwordValue) => {
      const cacheKey = `password_${passwordValue}`;
      const cached = getCachedValidation(cacheKey);
      if (cached) return cached;

      const endTimer = performanceMonitor.startTimer('password validation');
      const result = debouncedValidation.validatePassword(passwordValue);
      endTimer();
      
      cacheValidation(cacheKey, result);
      return result;
    };
  }, []);

  // Debounced validation function
  const debouncedValidate = useCallback((field, value) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const endTimer = performanceMonitor.startTimer(`${field} debounced validation`);
      
      let validation;
      if (field === 'email') {
        validation = validateEmailMemo(value);
        setValidationPerformance(prev => ({
          ...prev,
          emailValidations: prev.emailValidations + 1
        }));
      } else if (field === 'password') {
        validation = validatePasswordMemo(value);
        setValidationPerformance(prev => ({
          ...prev,
          passwordValidations: prev.passwordValidations + 1
        }));
      }

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        if (validation && !validation.isValid) {
          setErrors(prev => ({ ...prev, [field]: validation.message }));
        } else {
          setErrors(prev => ({ ...prev, [field]: '' }));
        }
      }

      const duration = endTimer();
      setValidationPerformance(prev => ({
        ...prev,
        totalTime: prev.totalTime + duration
      }));
    }, 300); // 300ms debounce
  }, [validateEmailMemo, validatePasswordMemo]);

  // Optimized clear field error function
  const clearFieldError = useCallback((field) => {
    setErrors(prev => {
      if (!prev[field]) return prev; // Avoid unnecessary state update
      return { ...prev, [field]: '' };
    });
    
    if (globalError) {
      setGlobalError('');
    }
  }, [globalError]);

  // Optimized update functions with debounced validation
  const updateEmail = useCallback((value) => {
    const endTimer = performanceMonitor.startTimer('update email');
    
    setEmail(value);
    clearFieldError('email');
        // Only validate if value has changed significantly and component is mounted
      if (isMountedRef.current && 
          (Math.abs(value.length - lastValidationRef.current.email.length) > 2 || 
           value !== lastValidationRef.current.email)) {
        debouncedValidate('email', value);
        lastValidationRef.current.email = value;
      }
    
    endTimer();
  }, [clearFieldError, debouncedValidate]);

  const updatePassword = useCallback((value) => {
    const endTimer = performanceMonitor.startTimer('update password');
    
    setPassword(value);
    clearFieldError('password');
        // Only validate if value has changed significantly and component is mounted
      if (isMountedRef.current && 
          (Math.abs(value.length - lastValidationRef.current.password.length) > 1 || 
           value !== lastValidationRef.current.password)) {
        debouncedValidate('password', value);
        lastValidationRef.current.password = value;
      }
    
    endTimer();
  }, [clearFieldError, debouncedValidate]);

  // Memoized toggle function
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // Optimized focus handlers with performance tracking
  const handleEmailFocus = useCallback(() => {
    const endTimer = performanceMonitor.startTimer('email focus');
    setFocusedField('email');
    endTimer();
  }, []);

  const handlePasswordFocus = useCallback(() => {
    const endTimer = performanceMonitor.startTimer('password focus');
    setFocusedField('password');
    endTimer();
  }, []);

  const handleBlur = useCallback(() => {
    const endTimer = performanceMonitor.startTimer('field blur');
    setFocusedField(null);
    endTimer();
  }, []);

  // Optimized focus management
  const focusNextField = useCallback(() => {
    const endTimer = performanceMonitor.startTimer('focus next field');
    if (passwordRef.current) {
      passwordRef.current.focus();
    }
    endTimer();
  }, []);

  // Optimized session save with error handling
  const saveSession = useCallback(async ({ user, token }) => {
    const endTimer = performanceMonitor.startTimer('save session');
    
    try {
      // Validate token type before saving
      if (token && typeof token !== 'string') {
        console.warn('❌ LoginState: Invalid token type, expected string but got:', typeof token);
        throw new Error('Invalid token format - must be a string');
      }

      const sessionPromises = [
        safeStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(user)),
        safeStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true'),
      ];

      if (token) {
        sessionPromises.push(safeStorage.setItem(STORAGE_KEYS.authToken, token));
      }

      await Promise.all(sessionPromises);
      
      if (__DEV__) {
        console.log('✅ LoginState: Session saved successfully');
      }
    } catch (error) {
      console.error('❌ LoginState: Session save failed:', error);
      throw new Error('Failed to save login session');
    } finally {
      endTimer();
    }
  }, []);

  // Optimized login handler with comprehensive error handling
  const handleLogin = useCallback(async () => {
    // Prevent double-submission race condition
    if (isProcessingRef.current) {
      return;
    }
    
    const endTimer = performanceMonitor.startTimer('login process');
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    isProcessingRef.current = true;
    setLoading(true);
    setGlobalError('');
    
    try {
      // Immediate validation without debounce
      const formValidation = validateForm(email, password);
      if (!formValidation.isValid) {
        setErrors(formValidation.errors);
        // clear processing/loading so UI is usable again
        isProcessingRef.current = false;
        if (isMountedRef.current) setLoading(false);
        endTimer();
        return;
      }

      if (__DEV__) {
        console.log('🔍 LoginState: Login attempt started');
      }

      const response = await withTimeout(
        ApiService.login(email.trim(), password, { 
          signal: abortControllerRef.current.signal 
        }),
        TIMEOUTS.login
      );

      const { user, token } = parseLoginResponse(response);

      if (user && token) {
        if (__DEV__) {
          console.log('✅ LoginState: Login successful');
        }
        
        await saveSession({ user, token });
        onLoginSuccess?.(user);
      } else {
        throw new Error('Invalid login response');
      }

    } catch (error) {
      let errorMessage = getErrorMessage(error);
      
      // Check if this is a network/connection error using NetInfo
      try {
        const networkStatus = await getNetworkStatus();
        const isNetworkError = error.message?.includes('Network Error') || 
                              error.message?.includes('fetch') || 
                              error.code === 'NETWORK_ERROR' ||
                              networkStatus.isOffline;
        
        if (isNetworkError) {
          errorMessage = 'Unable to connect to server. Please check your internet connection or try demo login.';
        }
      } catch (netError) {
        // Fallback to original error handling if NetInfo fails
        console.warn('Failed to check network status:', netError);
        if (error.message?.includes('Network Error') || 
            error.message?.includes('fetch') || 
            error.code === 'NETWORK_ERROR') {
          errorMessage = 'Unable to connect to server. Please check your internet connection or try demo login.';
        }
      }
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setGlobalError(errorMessage);
      }
      
      if (__DEV__) {
        console.error('❌ LoginState: Login failed:', error);
        console.log('Error details:', {
          message: error.message,
          code: error.code,
          response: error.response?.status,
          isNetworkError: error.message?.includes('Network Error') || error.message?.includes('fetch')
        });
      }
    } finally {
      // Reset processing flag and loading state
      isProcessingRef.current = false;
      
      // Only update loading state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
      endTimer();
    }
  }, [email, password, onLoginSuccess, saveSession]);

  // Improved demo fallback with comprehensive error handling
  const handleLocalDemoFallback = useCallback(async () => {
    const endTimer = performanceMonitor.startTimer('demo fallback');
    
    try {
      const demoUserWithTimestamp = {
        ...DEMO_USER,
        createdAt: new Date().toISOString(),
      };
      
      // Wrap storage operations in try/catch for better error handling
      try {
        await safeStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(demoUserWithTimestamp));
        await safeStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true');
        
        if (__DEV__) {
          console.log('✅ LoginState: Demo fallback storage successful');
        }
      } catch (storageError) {
        console.error('❌ LoginState: Demo fallback storage failed:', storageError);
        throw new Error('Demo login fallback failed: Unable to save demo user data - ' + (storageError.message || storageError.toString()));
      }
      
      // Only call success callback if component is still mounted
      if (isMountedRef.current) {
        onLoginSuccess?.(demoUserWithTimestamp);
      }
      
    } catch (error) {
      // Re-throw with more descriptive error message
      throw new Error('Demo login fallback failed: ' + (error.message || error.toString()));
    } finally {
      endTimer();
    }
  }, [onLoginSuccess]);

  const handleDemoLogin = useCallback(async () => {
    // Prevent double-submission race condition
    if (isProcessingRef.current) {
      return;
    }
    
    const endTimer = performanceMonitor.startTimer('demo login');
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    isProcessingRef.current = true;
    setLoading(true);
    setGlobalError('');
    
    if (__DEV__) {
      console.log('🔍 LoginState: Demo login started...');
    }
    
    try {
      const response = await withTimeout(
        ApiService.demoLogin({ signal: abortControllerRef.current.signal }), 
        TIMEOUTS.demoLogin
      );
      const { user, token } = parseLoginResponse(response);
      
      if (user && token) {
        if (__DEV__) {
          console.log('✅ LoginState: Backend demo login successful');
        }
        await saveSession({ user, token });
        onLoginSuccess?.(user);
      } else {
        if (__DEV__) {
          console.log('🔍 LoginState: Using local demo fallback');
        }
        await handleLocalDemoFallback();
      }
    } catch (error) {
      if (__DEV__) {
        console.log('🔍 LoginState: Backend demo failed, using local fallback');
      }
      
      // Wrap demo fallback in try/catch to handle fallback errors
      try {
        await handleLocalDemoFallback();
      } catch (fallbackError) {
        console.error('❌ LoginState: Demo fallback also failed:', fallbackError);
        
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setGlobalError('Demo login failed: ' + (fallbackError.message || 'Unable to create demo session'));
        }
      }
    } finally {
      // Reset processing flag and loading state
      isProcessingRef.current = false;
      
      // Only update loading state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
      endTimer();
    }
  }, [onLoginSuccess, saveSession, handleLocalDemoFallback]);

  // Cleanup effect with unmount tracking
  useEffect(() => {
    // Set mounted flag to true on mount
    isMountedRef.current = true;
    
    return () => {
      // Set mounted flag to false on unmount
      isMountedRef.current = false;
      
      // Cancel any ongoing network requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Log performance stats in development
      const totalValidations = validationPerformance.emailValidations + validationPerformance.passwordValidations;
      if (__DEV__ && totalValidations > 0) {
        console.log('📊 LoginState Performance:', {
          emailValidations: validationPerformance.emailValidations,
          passwordValidations: validationPerformance.passwordValidations,
          totalValidationTime: validationPerformance.totalTime,
          averageValidationTime: validationPerformance.totalTime / totalValidations
        });
      }
    };
  }, [validationPerformance]);

  // Memoized return object to prevent unnecessary re-renders
  return useMemo(() => ({
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
    
    // Performance stats (development only)
    ...__DEV__ && { validationPerformance }
  }), [
    email, password, showPassword, loading, errors, globalError, focusedField,
    emailRef, passwordRef, updateEmail, updatePassword, togglePasswordVisibility,
    handleEmailFocus, handlePasswordFocus, handleBlur, focusNextField,
    handleLogin, handleDemoLogin, validationPerformance
  ]);
};

// Default export for compatibility
export default useOptimizedLoginState;
