// hooks/useAuth.js - Lean auth state with guarded storage access
import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeStorage } from '../utils/safeStorage';

// Lazy logger proxy to avoid circular import crashes
let _loggerInstance = null;
const getLogger = () => {
  if (_loggerInstance) return _loggerInstance;
  try {
    const mod = require('../utils/AppLogger');
    _loggerInstance = mod?.logger || mod?.default || console;
  } catch (error) {
    console.warn('useAuth: AppLogger load failed, using console', error?.message || error);
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

const SAFE_DEFAULTS = {
  user: null,
  loading: false,
  isInitialized: false,
  error: null,
  initializeAuth: async () => {},
  handleLoginSuccess: async () => {},
  handleLogout: async () => {},
  handleSignUpComplete: async () => {},
  handleAccountDeleted: async () => {},
  clearError: () => {},
  retryLastOperation: async () => {},
};

export const useAuth = () => {
  console.log('🔐 useAuth: Hook called');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  console.log('🔐 useAuth: Initial state set, loading:', true);

  // Guarded storage helper
  const safeStorageCall = useCallback(async (fn, label) => {
    try {
      return await fn();
    } catch (err) {
      logger.warn(label || 'safeStorage call failed', err);
      return null;
    }
  }, []);

const initializeAuth = useCallback(async () => {
  setLoading(true);
  setError(null);
  
  try {
    const token = await safeStorageCall(
      () => safeStorage.getToken(), 
      'getToken failed'
    );
    
    if (token) {
      const storedUser = await safeStorageCall(
        () => safeStorage.getUserData?.(), 
        'getUserData failed'
      );
      
      if (storedUser) {
        setUser(storedUser);
        logger.info('Auth restored from storage');
      }
    }
  } catch (err) {
    logger.error('initializeAuth failed:', err);
    setError(err);
  } finally {
    setLoading(false);
    setIsInitialized(true);
  }
}, [safeStorageCall]);

useEffect(() => {
  let isMounted = true;

  (async () => {
    try {
      await initializeAuth();
    } catch (err) {
      if (isMounted) {
        logger.error('Auth init effect failed:', err);
      }
    }
  })();
  
  return () => {
    isMounted = false;
  };
}, [initializeAuth]);

  const handleLoginSuccess = useCallback(async (userData, authToken) => {
    setLoading(true);
    setError(null);
    try {
      if (authToken) {
        await safeStorageCall(() => safeStorage.setToken(authToken), 'setToken failed');
      }
      if (userData) {
        await safeStorageCall(() => safeStorage.setUserData?.(userData), 'setUserData failed');
      }
      setUser(userData || null);
      logger.info('Login success processed');
    } catch (err) {
      setError(err);
      logger.error('Login handling failed:', err);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [safeStorageCall]);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await safeStorageCall(() => safeStorage.clearAuth?.(), 'clearAuth failed');
    } catch (err) {
      logger.error('Logout cleanup failed:', err);
    } finally {
      setUser(null);
      setLoading(false);
      setIsInitialized(true);
    }
  }, [safeStorageCall]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const retryLastOperation = useCallback(() => {
    // For simplicity, just re-run init to refresh from storage
    return initializeAuth();
  }, [initializeAuth]);

  const handleSignUpComplete = useCallback(async (userData) => {
    setUser(userData || null);
    setError(null);
    setIsInitialized(true);
  }, []);

  const handleAccountDeleted = useCallback(async () => {
    await handleLogout();
  }, [handleLogout]);

  const authState = useMemo(() => ({
    user,
    loading,
    isInitialized,
    error,
    initializeAuth,
    handleLoginSuccess,
    handleLogout,
    handleSignUpComplete,
    handleAccountDeleted,
    clearError,
    retryLastOperation,
  }), [
    user,
    loading,
    isInitialized,
    error,
    initializeAuth,
    handleLoginSuccess,
    handleLogout,
    handleSignUpComplete,
    handleAccountDeleted,
    clearError,
    retryLastOperation,
  ]);

  console.log('🔐 useAuth: Returning state:', authState);
  return authState;
};

export default useAuth;

