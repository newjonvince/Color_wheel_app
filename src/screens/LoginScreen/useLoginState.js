// Simple login state hook
import { useState, useCallback, useRef, useEffect } from 'react';
import { safeStorage } from '../../utils/safeStorage';
import ApiService from '../../services/safeApiService';
import { debounce } from '../../utils/debounce';
import { logger } from '../../utils/AppLogger';
import { validateForm, validateEmail, parseLoginResponse, getErrorMessage, withTimeout, DEMO_USER, TIMEOUTS, STORAGE_KEYS, sanitizeEmail, sanitizePassword } from './constants';

export const useOptimizedLoginState = (onLoginSuccess) => {
  // Basic state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  
  // Refs for focus management and abort controller
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(false);
  
  // ✅ Client-side rate limiting to prevent abuse
  const loginAttemptsRef = useRef([]);
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 60000; // 1 minute

  // ✅ Create debounced email validation once to prevent memory leaks
  const debouncedValidate = useRef(
    debounce((value) => {
      if (value && isMountedRef.current) {
        const validation = validateEmail(value);
        if (!validation.isValid) {
          setErrors(prev => ({ ...prev, email: validation.message }));
        } else {
          setErrors(prev => ({ ...prev, email: '' }));
        }
      }
    }, 500)
  ).current;

  // Update functions
  const updateEmail = useCallback((value) => {
    setEmail(value);
    setErrors(prev => ({ ...prev, email: '' }));
    if (globalError) setGlobalError('');
    
    // Optional debounced validation for inline errors
    if (value.length > 3) {
      debouncedValidate(value);
    }
  }, [globalError, debouncedValidate]);

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

  // ✅ Rate limiting check to prevent brute force attacks
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    
    // Remove attempts older than lockout duration
    loginAttemptsRef.current = loginAttemptsRef.current.filter(
      timestamp => now - timestamp < LOCKOUT_DURATION
    );
    
    if (loginAttemptsRef.current.length >= MAX_ATTEMPTS) {
      const oldestAttempt = Math.min(...loginAttemptsRef.current);
      const timeRemaining = Math.ceil((LOCKOUT_DURATION - (now - oldestAttempt)) / 1000);
      
      throw new Error(
        `Too many login attempts. Please try again in ${timeRemaining} seconds.`
      );
    }
    
    // Record this attempt
    loginAttemptsRef.current.push(now);
  }, []);

  // ✅ SAFER: Save session with transaction safety
  const saveSession = useCallback(async ({ user, token }) => {
    try {
      // Clear any existing session data first to prevent partial states
      await Promise.all([
        safeStorage.removeItem(STORAGE_KEYS.userData),
        safeStorage.removeItem(STORAGE_KEYS.authToken),
        safeStorage.removeItem(STORAGE_KEYS.isLoggedIn),
      ]);
      
      // Then write fresh session data
      const writeOperations = [
        safeStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(user)),
        safeStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true'),
      ];
      
      if (token) {
        writeOperations.push(safeStorage.setItem(STORAGE_KEYS.authToken, token));
      }
      
      await Promise.all(writeOperations);
      
    } catch (error) {
      logger.error('Session save failed:', error);
      
      // Clean up partial state on failure
      try {
        await Promise.all([
          safeStorage.removeItem(STORAGE_KEYS.userData),
          safeStorage.removeItem(STORAGE_KEYS.authToken),
          safeStorage.removeItem(STORAGE_KEYS.isLoggedIn),
        ]);
      } catch (cleanupError) {
        logger.error('Session cleanup failed:', cleanupError);
      }
      
      throw new Error('Failed to save login session');
    }
  }, []);

  // ✅ SAFER: Login handler with sanitization, rate limiting, and AbortController compatibility
  const handleLogin = useCallback(async () => {
    if (isProcessingRef.current) return;
    
    // Check rate limit first
    try {
      checkRateLimit();
    } catch (error) {
      setGlobalError(error.message);
      return;
    }
    
    // Cancel existing request
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {
        // Ignore abort errors
      }
    }
    
    // Build request options safely
    const requestOptions = {};
    
    if (typeof AbortController !== 'undefined') {
      abortControllerRef.current = new AbortController();
      requestOptions.signal = abortControllerRef.current.signal;
    } else {
      abortControllerRef.current = null;
    }
    
    isProcessingRef.current = true;
    setLoading(true);
    setGlobalError('');
    
    try {
      // Validate first
      const formValidation = validateForm(email, password);
      if (!formValidation.isValid) {
        setErrors(formValidation.errors);
        throw new Error('Validation failed'); // ✅ Throw instead of return
      }

      // ✅ Sanitize inputs before sending to API
      const sanitizedEmail = sanitizeEmail(email);
      const sanitizedPassword = sanitizePassword(password);

      const response = await withTimeout(
        ApiService.login(sanitizedEmail, sanitizedPassword, requestOptions), // ✅ Sanitized inputs
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
        // Don't show error for validation failures
        if (error.message !== 'Validation failed') {
          setGlobalError(getErrorMessage(error));
        }
      }
    } finally {
      isProcessingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false); // ✅ Always executes now
      }
    }
  }, [email, password, onLoginSuccess, saveSession, checkRateLimit]);

  // ✅ SAFER: Demo login with proper race condition handling
  const handleDemoLogin = useCallback(async () => {
    if (isProcessingRef.current) return;
    
    // Cancel existing request
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {
        // Ignore abort errors
      }
    }
    
    // Build request options safely
    const requestOptions = {};
    
    if (typeof AbortController !== 'undefined') {
      abortControllerRef.current = new AbortController();
      requestOptions.signal = abortControllerRef.current.signal;
    } else {
      abortControllerRef.current = null;
    }
    
    isProcessingRef.current = true;
    setLoading(true);
    setGlobalError('');
    
    let backendAttempted = false;
    
    try {
      // Try backend demo first
      backendAttempted = true;
      const response = await withTimeout(
        ApiService.demoLogin(requestOptions), 
        TIMEOUTS.demoLogin
      );
      
      const { user, token } = parseLoginResponse(response);
      
      if (!user || !token) {
        throw new Error('Invalid demo response');
      }
      
      // If we got here, backend demo worked - save it
      await saveSession({ user, token });
      
      if (isMountedRef.current) {
        onLoginSuccess?.(user);
      }
      
      // ✅ Explicit return - don't fall through
      return;
      
    } catch (backendError) {
      logger.warn('Backend demo failed:', backendError);
      
      // ✅ Only use local fallback if backend completely failed
      if (backendAttempted && !isMountedRef.current) {
        return; // Component unmounted during backend call
      }
      
      // Proceed to local fallback
      try {
        const demoUser = {
          ...DEMO_USER,
          createdAt: new Date().toISOString(),
        };
        
        // Clear any partial session data first
        await Promise.all([
          safeStorage.removeItem(STORAGE_KEYS.userData),
          safeStorage.removeItem(STORAGE_KEYS.authToken),
          safeStorage.removeItem(STORAGE_KEYS.isLoggedIn),
        ]);
        
        // Then write fresh demo session
        await safeStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(demoUser));
        await safeStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true');
        
        if (isMountedRef.current) {
          onLoginSuccess?.(demoUser);
        }
        
      } catch (localError) {
        logger.error('Local demo fallback failed:', localError);
        if (isMountedRef.current) {
          setGlobalError('Demo login failed. Please try again.');
        }
      }
    } finally {
      isProcessingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [onLoginSuccess, saveSession]);

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // ✅ Clean cancel method to prevent memory leaks
      debouncedValidate.cancel();
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
