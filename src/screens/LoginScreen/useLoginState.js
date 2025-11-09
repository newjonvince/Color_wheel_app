// screens/LoginScreen/useOptimizedLoginState.js - Ultra-optimized login state with debouncing and caching
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { safeStorage } from '../../utils/safeStorage';
import ApiService from '../../services/safeApiService';
import { optimizedConstants } from './constants';

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

      if (validation && !validation.isValid) {
        setErrors(prev => ({ ...prev, [field]: validation.message }));
      } else {
        setErrors(prev => ({ ...prev, [field]: '' }));
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
    
    // Only validate if value has changed significantly
    if (Math.abs(value.length - lastValidationRef.current.email.length) > 2 || 
        value !== lastValidationRef.current.email) {
      debouncedValidate('email', value);
      lastValidationRef.current.email = value;
    }
    
    endTimer();
  }, [clearFieldError, debouncedValidate]);

  const updatePassword = useCallback((value) => {
    const endTimer = performanceMonitor.startTimer('update password');
    
    setPassword(value);
    clearFieldError('password');
    
    // Only validate if value has changed significantly
    if (Math.abs(value.length - lastValidationRef.current.password.length) > 1 || 
        value !== lastValidationRef.current.password) {
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
    const endTimer = performanceMonitor.startTimer('login process');
    
    setLoading(true);
    setGlobalError('');
    
    try {
      // Immediate validation without debounce
      const formValidation = validateForm(email, password);
      if (!formValidation.isValid) {
        setErrors(formValidation.errors);
        return;
      }

      if (__DEV__) {
        console.log('🔍 LoginState: Login attempt started');
      }

      const response = await withTimeout(
        ApiService.login(email.trim(), password),
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
      const errorMessage = getErrorMessage(error);
      setGlobalError(errorMessage);
      
      if (__DEV__) {
        console.error('❌ LoginState: Login failed:', error);
      }
    } finally {
      setLoading(false);
      endTimer();
    }
  }, [email, password, onLoginSuccess, saveSession]);

  // Optimized demo login with fallback
  const handleLocalDemoFallback = useCallback(async () => {
    const endTimer = performanceMonitor.startTimer('demo fallback');
    
    try {
      const demoUserWithTimestamp = {
        ...DEMO_USER,
        createdAt: new Date().toISOString(),
      };
      
      await safeStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(demoUserWithTimestamp));
      await safeStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true');
      
      onLoginSuccess?.(demoUserWithTimestamp);
    } finally {
      endTimer();
    }
  }, [onLoginSuccess]);

  const handleDemoLogin = useCallback(async () => {
    const endTimer = performanceMonitor.startTimer('demo login');
    
    setLoading(true);
    setGlobalError('');
    
    if (__DEV__) {
      console.log('🔍 LoginState: Demo login started...');
    }
    
    try {
      const response = await withTimeout(ApiService.demoLogin(), TIMEOUTS.demoLogin);
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
      await handleLocalDemoFallback();
    } finally {
      setLoading(false);
      endTimer();
    }
  }, [onLoginSuccess, saveSession, handleLocalDemoFallback]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Log performance stats in development
      if (__DEV__ && validationPerformance.emailValidations > 0) {
        console.log('📊 LoginState Performance:', {
          emailValidations: validationPerformance.emailValidations,
          passwordValidations: validationPerformance.passwordValidations,
          totalValidationTime: validationPerformance.totalTime,
          averageValidationTime: validationPerformance.totalTime / 
            (validationPerformance.emailValidations + validationPerformance.passwordValidations)
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
