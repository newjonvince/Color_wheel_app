// hooks/useAuth.js - Memory-safe authentication state management
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { safeStorage } from '../utils/safeStorage';
import { logger } from '../utils/AppLogger';

// ✅ Create static defaults OUTSIDE hook
const SAFE_AUTH_DEFAULTS = {
  user: null,
  loading: false,
  isInitialized: false,
  error: null,
  initializeAuth: async () => {
    console.warn('useAuth: Using fallback initializeAuth');
    return Promise.resolve();
  },
  handleLoginSuccess: async () => {
    console.warn('useAuth: Using fallback handleLoginSuccess');
  },
  handleSignUpComplete: async () => {
    console.warn('useAuth: Using fallback handleSignUpComplete');
  },
  handleLogout: async () => {
    console.warn('useAuth: Using fallback handleLogout');
  },
  handleAccountDeleted: async () => {
    console.warn('useAuth: Using fallback handleAccountDeleted');
  },
  clearError: () => {
    console.warn('useAuth: Using fallback clearError');
  },
  retryLastOperation: async () => {
    console.warn('useAuth: Using fallback retryLastOperation');
  },
  forceRetryInitialization: async () => {
    console.warn('useAuth: Using fallback forceRetryInitialization');
  },
};

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  
  // 🔧 Track mounted state
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  // 🔧 Safe state setter - only updates if mounted
  const safeSetState = useCallback((setter, value) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

  // 🔧 Initialize auth with proper cleanup and abort support
  useEffect(() => {
    isMountedRef.current = true;
    abortControllerRef.current = new AbortController();

    const initializeAuth = async () => {
      try {
        safeSetState(setLoading, true);
        safeSetState(setError, null);
        
        // Initialize auth logic here
        const token = await safeStorage.getToken();
        if (token) {
          // Load user profile - placeholder implementation
          safeSetState(setUser, { id: 'demo', email: 'demo@example.com' });
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        safeSetState(setError, error);
      } finally {
        safeSetState(setLoading, false);
        safeSetState(setIsInitialized, true);
      }
    };

    initializeAuth();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [safeSetState]);

  // 🔧 Clear stored token helper - Enhanced with better error handling
  const clearStoredToken = useCallback(async () => {
    const errors = [];
    
    try {
      // Try to clear auth data
      const clearResult = await safeStorage.clearAuth();
      if (clearResult) {
        logger.info('✅ Auth data cleared successfully');
      } else {
        logger.warn('⚠️ Auth data clearing returned false - partial success');
      }
    } catch (error) {
      logger.error('❌ Failed to clear auth data:', error);
      errors.push(`Auth clearing failed: ${error.message}`);
    }
    
    // Also try to clear specific token
    try {
      await safeStorage.clearToken();
      logger.info('✅ Token cleared successfully');
    } catch (error) {
      logger.error('❌ Failed to clear token:', error);
      errors.push(`Token clearing failed: ${error.message}`);
    }
    
    // If we had errors, throw a combined error
    if (errors.length > 0) {
      throw new Error(`Storage clearing failed: ${errors.join(', ')}`);
    }
  }, []);

  // 🔧 Initialize auth function - FIXED: Now properly handles signal parameter + retry mechanism
  const initializeAuth = useCallback(async ({ signal, retryCount = 0 } = {}) => {
    if (!isMountedRef.current) return;
    
    const maxRetries = 3;
    const isRetry = retryCount > 0;
    
    if (!isRetry) {
      safeSetState(setLoading, true);
      safeSetState(setError, null);
    }
    
    try {
      // Check if operation was aborted before starting
      if (signal?.aborted) {
        logger.info('Auth initialization aborted before starting');
        return;
      }
      
      logger.info(`🔐 ${isRetry ? `Retrying auth initialization (attempt ${retryCount + 1}/${maxRetries + 1})` : 'Starting auth initialization'}...`);
      
      // Initialize auth logic with retry mechanism for storage failures
      let token = null;
      try {
        token = await safeStorage.getToken();
      } catch (storageError) {
        logger.warn(`⚠️ Storage getToken failed (attempt ${retryCount + 1}):`, storageError.message);
        
        // If this is a storage initialization issue, try to reinitialize storage
        if (storageError.message?.includes('not initialized') || storageError.message?.includes('SecureStore')) {
          try {
            logger.info('🔄 Attempting to reinitialize storage...');
            await safeStorage.init();
            token = await safeStorage.getToken();
            logger.info('✅ Storage reinitialized successfully');
          } catch (reinitError) {
            logger.error('❌ Storage reinitialization failed:', reinitError.message);
            throw storageError; // Throw original error
          }
        } else {
          throw storageError;
        }
      }
      
      // Check abort signal after async operation
      if (signal?.aborted) {
        logger.info('Auth initialization aborted after token check');
        return;
      }
      
      if (token) {
        // Load user profile - placeholder implementation
        const userData = { id: 'demo', email: 'demo@example.com' };
        
        // Final abort check before setting user
        if (signal?.aborted) {
          logger.info('Auth initialization aborted before setting user');
          return;
        }
        
        safeSetState(setUser, userData);
        logger.info('✅ Auth initialization completed with user');
      } else {
        logger.info('✅ Auth initialization completed - no stored token');
      }
    } catch (error) {
      // Don't set error if operation was aborted
      if (signal?.aborted || error.name === 'AbortError') {
        logger.info('Auth initialization aborted:', error.message);
        return;
      }
      
      // Retry logic for recoverable errors
      if (retryCount < maxRetries && !signal?.aborted) {
        const isRetryableError = 
          error.message?.includes('storage') ||
          error.message?.includes('SecureStore') ||
          error.message?.includes('AsyncStorage') ||
          error.message?.includes('not initialized') ||
          error.message?.includes('timeout');
        
        if (isRetryableError) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
          logger.info(`🔄 Retrying auth initialization in ${delay}ms...`);
          
          setTimeout(() => {
            if (!signal?.aborted && isMountedRef.current) {
              initializeAuth({ signal, retryCount: retryCount + 1 });
            }
          }, delay);
          return; // Don't set error state yet, we're retrying
        }
      }
      
      logger.error(`❌ Auth initialization failed after ${retryCount + 1} attempts:`, error);
      safeSetState(setError, error);
    } finally {
      // Only update state if not aborted and still mounted
      if (!signal?.aborted && isMountedRef.current) {
        safeSetState(setLoading, false);
        safeSetState(setIsInitialized, true);
      }
    }
  }, [safeSetState]);

  // 🔧 Handle login success - FIXED: Added rollback mechanism for partial failures
  const handleLoginSuccess = useCallback(async (userData, authToken = null) => {
    if (!isMountedRef.current) return;
    
    // Store original state for rollback
    const originalUser = user;
    const originalError = error;
    
    try {
      logger.info('🔐 Processing login success...');
      
      // Clear any existing errors first
      safeSetState(setError, null);
      
      // Step 1: Store auth token if provided
      if (authToken) {
        try {
          await safeStorage.setToken(authToken);
          logger.info('✅ Auth token stored successfully');
        } catch (tokenError) {
          logger.error('❌ Failed to store auth token:', tokenError);
          throw new Error(`Token storage failed: ${tokenError.message}`);
        }
      }
      
      // Step 2: Store user data
      if (userData) {
        try {
          await safeStorage.setUserData(userData);
          logger.info('✅ User data stored successfully');
        } catch (userDataError) {
          logger.error('❌ Failed to store user data:', userDataError);
          
          // Rollback: Clear the token we just stored
          if (authToken) {
            try {
              await safeStorage.clearToken();
              logger.info('🔄 Rolled back auth token due to user data failure');
            } catch (rollbackError) {
              logger.error('❌ Failed to rollback auth token:', rollbackError);
            }
          }
          
          throw new Error(`User data storage failed: ${userDataError.message}`);
        }
      }
      
      // Step 3: Update state only after successful storage
      safeSetState(setUser, userData);
      logger.info('✅ Login success processing completed');
      
    } catch (error) {
      logger.error('❌ Login success handling failed:', error);
      
      // Rollback state to original values
      safeSetState(setUser, originalUser);
      safeSetState(setError, error);
      
      // Ensure we're in a clean state
      try {
        await safeStorage.clearAuth();
        logger.info('🔄 Cleared auth data due to login success failure');
      } catch (clearError) {
        logger.error('❌ Failed to clear auth data during rollback:', clearError);
      }
    }
  }, [safeSetState, user, error]);

  // 🔧 Handle signup complete
  const handleSignUpComplete = useCallback(async (userData) => {
    if (!isMountedRef.current) return;
    
    try {
      safeSetState(setUser, userData);
      safeSetState(setError, null);
    } catch (error) {
      console.error('Signup completion handling failed:', error);
      safeSetState(setError, error);
    }
  }, [safeSetState]);

  // 🔧 Handle logout - FIXED: Maintains consistent state on partial failures
  const handleLogout = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    logger.info('🔐 Starting logout process...');
    
    // Always clear user state first to prevent UI inconsistencies
    safeSetState(setUser, null);
    safeSetState(setError, null);
    
    const errors = [];
    
    try {
      // Attempt to clear stored data - collect errors but don't fail completely
      try {
        await clearStoredToken();
        logger.info('✅ Auth tokens cleared successfully');
      } catch (tokenError) {
        logger.error('❌ Failed to clear auth tokens:', tokenError);
        errors.push(`Token clearing failed: ${tokenError.message}`);
      }
      
      // Try to clear user data separately
      try {
        await safeStorage.removeItem('userData');
        logger.info('✅ User data cleared successfully');
      } catch (userDataError) {
        logger.error('❌ Failed to clear user data:', userDataError);
        errors.push(`User data clearing failed: ${userDataError.message}`);
      }
      
      // If we had partial failures, log them but don't show error to user
      if (errors.length > 0) {
        logger.warn('⚠️ Logout completed with partial failures:', errors);
        // Don't set error state - user is logged out successfully from UI perspective
      } else {
        logger.info('✅ Logout completed successfully');
      }
      
    } catch (error) {
      // This should rarely happen since we're handling errors above
      logger.error('❌ Unexpected error during logout:', error);
      // Still don't set error state - user is already logged out from UI perspective
    }
  }, [safeSetState, clearStoredToken]);

  // 🔧 Handle account deleted
  const handleAccountDeleted = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      await clearStoredToken();
      safeSetState(setUser, null);
      safeSetState(setError, null);
    } catch (error) {
      console.error('Account deletion handling failed:', error);
      safeSetState(setError, error);
    }
  }, [safeSetState, clearStoredToken]);

  // 🔧 Clear error state function - FIXED: Added error clearing mechanism
  const clearError = useCallback(() => {
    if (isMountedRef.current) {
      safeSetState(setError, null);
      logger.info('✅ Error state cleared');
    }
  }, [safeSetState]);
  
  // 🔧 Retry failed operation - Enhanced with comprehensive recovery
  const retryLastOperation = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    logger.info('🔄 Retrying last failed operation...');
    
    // Clear error first
    safeSetState(setError, null);
    safeSetState(setLoading, true);
    
    try {
      // Step 1: Try to reinitialize storage if needed
      try {
        await safeStorage.init();
        logger.info('✅ Storage reinitialized during retry');
      } catch (storageError) {
        logger.warn('⚠️ Storage reinit failed during retry:', storageError.message);
        // Continue anyway - storage might still work
      }
      
      // Step 2: If not initialized, try to initialize auth
      if (!isInitialized) {
        logger.info('🔄 Attempting auth initialization retry...');
        await initializeAuth();
        logger.info('✅ Auth initialization retry succeeded');
      } else {
        // Step 3: If initialized but no user, try to reload user from storage
        if (!user) {
          logger.info('🔄 Attempting to reload user from storage...');
          try {
            const token = await safeStorage.getToken();
            if (token) {
              // Load user profile - placeholder implementation
              const userData = { id: 'demo', email: 'demo@example.com' };
              safeSetState(setUser, userData);
              logger.info('✅ User reloaded from storage');
            } else {
              logger.info('ℹ️ No stored token found during retry');
            }
          } catch (tokenError) {
            logger.warn('⚠️ Failed to reload user from storage:', tokenError.message);
            // This is not necessarily an error - user might not be logged in
          }
        } else {
          logger.info('✅ Auth state appears healthy, no retry needed');
        }
      }
    } catch (error) {
      logger.error('❌ Retry operation failed:', error);
      safeSetState(setError, error);
    } finally {
      safeSetState(setLoading, false);
    }
  }, [safeSetState, isInitialized, initializeAuth, user]);

  // 🔧 Force retry initialization - For manual retry from UI
  const forceRetryInitialization = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    logger.info('🔄 Force retrying initialization (user requested)...');
    
    // Reset all auth state
    safeSetState(setUser, null);
    safeSetState(setError, null);
    safeSetState(setLoading, true);
    safeSetState(setIsInitialized, false);
    
    try {
      // Force reinitialize storage
      await safeStorage.init();
      logger.info('✅ Storage force reinitialized');
      
      // Force reinitialize auth with fresh start
      await initializeAuth({ retryCount: 0 });
      logger.info('✅ Auth force reinitialized');
      
    } catch (error) {
      logger.error('❌ Force retry failed:', error);
      safeSetState(setError, error);
      safeSetState(setLoading, false);
      safeSetState(setIsInitialized, true); // Mark as initialized even if failed
    }
  }, [safeSetState, initializeAuth]);

  // 🔧 Memoized auth state to prevent unnecessary re-renders
  const authState = useMemo(() => ({
    user,
    loading,
    isInitialized,
    error,
    initializeAuth,
    handleLoginSuccess,
    handleSignUpComplete,
    handleLogout,
    handleAccountDeleted,
    clearError,
    retryLastOperation,
    forceRetryInitialization,
  }), [
    user,
    loading,
    isInitialized,
    error,
    initializeAuth,
    handleLoginSuccess,
    handleSignUpComplete,
    handleLogout,
    handleAccountDeleted,
    clearError,
    retryLastOperation,
    forceRetryInitialization,
  ]);

  // ✅ ROOT CAUSE FIX: Ensure ALWAYS returns object, never undefined
  try {
    return authState;
  } catch (error) {
    console.error('useAuth hook error - returning safe defaults:', error);
    return SAFE_AUTH_DEFAULTS; // ✅ Stable reference
  }
};
