// Simple login state hook
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
// CRASH FIX: Lazy-load expo-haptics to prevent native bridge access at module load time

// Lazy expo-haptics getter to avoid module-load-time native bridge access
let _haptics = null;
const getHaptics = () => {
  if (_haptics) return _haptics;
  try {
    _haptics = require('expo-haptics');
  } catch (error) {
    console.warn('useLoginState: expo-haptics load failed', error?.message);
    _haptics = {
      impactAsync: () => Promise.resolve(),
      notificationAsync: () => Promise.resolve(),
      selectionAsync: () => Promise.resolve(),
    };
  }
  return _haptics;
};
import { safeAsyncStorage } from '../../utils/safeAsyncStorage';
import ApiService from '../../services/safeApiService';
import { debounce } from '../../utils/throttledCallbacks';
import { validateForm, validateEmail, parseLoginResponse, getErrorMessage, withTimeout, createDemoUser, TIMEOUTS, sanitizeEmail, sanitizePassword } from './constants';

// Lazy logger proxy to avoid circular import crashes
let _loggerInstance = null;
const getLogger = () => {
  if (_loggerInstance) return _loggerInstance;
  try {
    const mod = require('../../utils/AppLogger');
    _loggerInstance = mod?.logger || mod?.default || console;
  } catch (error) {
    console.warn('useLoginState: AppLogger load failed, using console', error?.message || error);
    _loggerInstance = console;
  }
  return _loggerInstance;
};

const logger = {
  debug: (...args) => getLogger()?.debug?.(...args),
  info: (...args) => getLogger()?.info?.(...args),
  warn: (...args) => getLogger()?.warn?.(...args),
  error: (...args) => getLogger()?.error?.(...args),
};

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
  
  // Client-side rate limiting to prevent abuse
  const loginAttemptsRef = useRef([]);
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 60000; // 1 minute
  const RATE_LIMIT_KEY = '@login_attempts';

  // Don't use useRef for debounced function - use useMemo
  const debouncedValidate = useMemo(() => {
    const fn = debounce((value) => {
      if (!value) return;
      
      const validation = validateEmail(value);
      
      // Use callback form to avoid closure issues
      setErrors(prev => {
        if (!validation.isValid) {
          return { ...prev, email: validation.message };
        }
        const { email, ...rest } = prev;
        return rest;
      });
    }, 500);
    if (!fn.cancel) {
      fn.cancel = () => {};
    }
    return fn;
  }, []); // Create once

  // Load persisted rate limit on mount
  useEffect(() => {
    const loadRateLimit = async () => {
      try {
        const stored = await safeAsyncStorage.getItem(RATE_LIMIT_KEY);
        if (stored) {
          const attempts = JSON.parse(stored);
          // Filter out expired attempts
          const now = Date.now();
          const valid = attempts.filter(t => now - t < LOCKOUT_DURATION);
          loginAttemptsRef.current = valid;
        }
      } catch (error) {
        logger.error('Failed to load rate limit data:', error);
      }
    };
    
    loadRateLimit();
  }, []);

  // REMOVED: Duplicate cleanup effect - consolidated into single cleanup at end

  const updateEmail = useCallback((value) => {
    setEmail(value);
    setErrors(prev => {
      const { email, ...rest } = prev;
      return rest;
    });
    if (globalError) setGlobalError('');
    
    // Call debounced validation directly
    if (value && value.length > 3) {
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

  // Persist rate limit on change
  const checkRateLimit = useCallback(async () => {
    const now = Date.now();
    
    // Remove expired attempts
    loginAttemptsRef.current = loginAttemptsRef.current.filter(
      timestamp => now - timestamp < LOCKOUT_DURATION
    );
    
    if (loginAttemptsRef.current.length >= MAX_ATTEMPTS) {
      const oldestAttempt = Math.min(...loginAttemptsRef.current);
      const timeRemaining = Math.ceil((LOCKOUT_DURATION - (now - oldestAttempt)) / 1000);
      
      // Haptic feedback for rate limit warning
      try {
        await getHaptics().notificationAsync(getHaptics().NotificationFeedbackType.Warning);
      } catch (hapticError) {
        // Haptics might not be available on all devices
        logger.warn('Haptic feedback failed:', hapticError);
      }
      
      throw new Error(
        `Too many login attempts. Please try again in ${timeRemaining} seconds.` 
      );
    }
    
    // Record this attempt
    loginAttemptsRef.current.push(now);
    
    // Persist to storage
    try {
      await safeAsyncStorage.setItem(
        RATE_LIMIT_KEY,
        JSON.stringify(loginAttemptsRef.current)
      );
    } catch (error) {
      logger.warn('Failed to persist rate limit data:', error);
      // Continue anyway - at least we have in-memory tracking
    }
  }, []);

  // Reset client-side rate limit tracking (used after successful demo login fallback)
  const resetRateLimit = useCallback(async () => {
    loginAttemptsRef.current = [];
    try {
      await safeAsyncStorage.removeItem(RATE_LIMIT_KEY);
    } catch (error) {
      logger.warn('Failed to reset rate limit data:', error);
    }
  }, []);

  // SAFER: Save session with transaction safety
  const saveSession = useCallback(async ({ user, token, refreshToken = null }) => {
    // The user record is persisted by AuthContext once onLoginSuccess runs; all that is needed
    // here is to hand the tokens to the API client, which keeps them in memory and in the
    // keychain. (This used to also write to STORAGE_KEYS.userData/authToken/isLoggedIn, which do
    // not exist: removing an undefined key made the keychain look broken and raised a
    // "Security Error" alert.)
    try {
      if (token) {
        await ApiService.setToken(token, refreshToken);
      }
    } catch (error) {
      logger.error('Session save failed:', error);
      throw new Error('Failed to save login session');
    }
  }, []);

  // SAFER: Login handler with sanitization, rate limiting, and AbortController compatibility
  const handleLogin = useCallback(async () => {
    if (isProcessingRef.current) return;
    
    // Check rate limit first
    try {
      await checkRateLimit();
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
        throw new Error('Validation failed'); // Throw instead of return
      }

      // Sanitize inputs before sending to API
      const sanitizedEmail = sanitizeEmail(email);
      const sanitizedPassword = sanitizePassword(password);

      const response = await withTimeout(
        ApiService.login(sanitizedEmail, sanitizedPassword, requestOptions), // Sanitized inputs
        TIMEOUTS.login
      );

      const { user, token, refreshToken } = parseLoginResponse(response);
      
      if (user && token) {
        await saveSession({ user, token, refreshToken });
        
        // Haptic feedback for login success
        try {
          await getHaptics().notificationAsync(getHaptics().NotificationFeedbackType.Success);
        } catch (hapticError) {
          logger.warn('Haptic feedback failed:', hapticError);
        }
        
        onLoginSuccess?.(user);
      } else {
        throw new Error('Invalid login response');
      }

    } catch (error) {
      if (isMountedRef.current) {
        // Don't show error for validation failures
        if (error.message !== 'Validation failed') {
          setGlobalError(getErrorMessage(error));
          
          // Haptic feedback for login error
          try {
            await getHaptics().notificationAsync(getHaptics().NotificationFeedbackType.Error);
          } catch (hapticError) {
            logger.warn('Haptic feedback failed:', hapticError);
          }
        }
      }
    } finally {
      isProcessingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false); // Always executes now
      }
    }
  }, [email, password, onLoginSuccess, saveSession, checkRateLimit]);

  // Demo login with atomic transaction semantics
  const handleDemoLogin = useCallback(async () => {
    if (isProcessingRef.current) return;
    
    // Cancel existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const requestOptions = {};
    if (typeof AbortController !== 'undefined') {
      abortControllerRef.current = new AbortController();
      requestOptions.signal = abortControllerRef.current.signal;
    }
    
    isProcessingRef.current = true;
    setLoading(true);
    setGlobalError('');
    
    try {
      // Try backend demo with full transaction semantics
      try {
        const response = await withTimeout(
          ApiService.demoLogin(requestOptions), 
          TIMEOUTS.demoLogin
        );
        
        const { user, token, refreshToken } = parseLoginResponse(response);
        
        if (!user || !token) {
          throw new Error('Invalid demo response');
        }
        
        // CRITICAL: saveSession must complete fully or rollback
        await saveSession({ user, token, refreshToken });
        
        // Haptic feedback for demo login success
        try {
          await getHaptics().notificationAsync(getHaptics().NotificationFeedbackType.Success);
        } catch (hapticError) {
          logger.warn('Haptic feedback failed:', hapticError);
        }
        
        // Only call success callback after FULL transaction
        if (isMountedRef.current) {
          onLoginSuccess?.(user);
        }
        
        // Success - early return
        return;
        
      } catch (backendError) {
        logger.warn('Backend demo failed:', backendError);
        
        // Check if component unmounted during backend call
        if (!isMountedRef.current) {
          return;
        }
        
        // If saveSession failed, stop here and surface error instead of fallback
        if (backendError?.message?.includes('Failed to save login session')) {
          setGlobalError('Demo login failed. Please try again.');
          return;
        }
      }
      
      // Local fallback - only runs if backend completely failed
      logger.info('Using local demo fallback');
      
      try {
        // Offline demo: no account on the server, so no token. AuthContext stores the user.
        const demoUser = createDemoUser();

        // Haptic feedback for local demo success
        try {
          await getHaptics().notificationAsync(getHaptics().NotificationFeedbackType.Success);
        } catch (hapticError) {
          logger.warn('Haptic feedback failed:', hapticError);
        }
        
        if (isMountedRef.current) {
          await resetRateLimit();
          onLoginSuccess?.(demoUser);
        }
        
      } catch (localError) {
        logger.error('Local demo fallback failed:', localError);
        
        if (isMountedRef.current) {
          setGlobalError('Demo login failed. Please try again.');
          
          // Haptic feedback for demo login error
          try {
            await getHaptics().notificationAsync(getHaptics().NotificationFeedbackType.Error);
          } catch (hapticError) {
            logger.warn('Haptic feedback failed:', hapticError);
          }
        }
      }
      
    } finally {
      isProcessingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [onLoginSuccess, saveSession]);

  // FIXED: Single cleanup effect with empty deps (no unnecessary dependencies)
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Safe to call even if undefined - debouncedValidate created once with useMemo([], [])
      debouncedValidate?.cancel?.();
    };
  }, []); // Empty deps - cleanup only on unmount

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
