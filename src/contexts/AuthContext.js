// contexts/AuthContext.js - Split Auth Context for better performance
// ✅ PERFORMANCE: Split state and dispatch to prevent unnecessary re-renders
import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { logger } from '../utils/AppLogger';
import { safeStorage } from '../utils/safeStorage';

// ✅ PRODUCTION SAFETY: Gate console.log statements
// ✅ CRASH FIX: Use typeof check to prevent ReferenceError in production
const devLog = (...args) => (typeof __DEV__ !== 'undefined' && __DEV__) && console.log(...args);
const devWarn = (...args) => (typeof __DEV__ !== 'undefined' && __DEV__) && console.warn(...args);

// Auth action types
const AUTH_ACTIONS = {
  INITIALIZE_START: 'INITIALIZE_START',
  INITIALIZE_SUCCESS: 'INITIALIZE_SUCCESS',
  INITIALIZE_ERROR: 'INITIALIZE_ERROR',
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_ERROR: 'LOGIN_ERROR',
  LOGOUT: 'LOGOUT',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_USER: 'SET_USER'
};

// Initial auth state
const initialAuthState = {
  user: null,
  loading: false,
  isInitialized: false,
  error: null,
  isAuthenticating: false
};

// Auth reducer for state management
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.INITIALIZE_START:
      return {
        ...state,
        loading: true,
        error: null,
        isInitialized: false
      };

    case AUTH_ACTIONS.INITIALIZE_SUCCESS:
      return {
        ...state,
        loading: false,
        isInitialized: true,
        user: action.payload.user || null,
        error: null
      };

    case AUTH_ACTIONS.INITIALIZE_ERROR:
      return {
        ...state,
        loading: false,
        isInitialized: true, // Still initialized, just with error
        error: action.payload.error,
        user: null
      };

    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isAuthenticating: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticating: false,
        error: null,
        isInitialized: true
      };

    case AUTH_ACTIONS.LOGIN_ERROR:
      return {
        ...state,
        isAuthenticating: false,
        error: action.payload.error,
        user: null
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        isAuthenticating: false,
        error: null,
        // Keep isInitialized true after logout
        isInitialized: true
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload.user
      };

    default:
      devWarn('Unknown auth action:', action.type);
      return state;
  }
};

// ✅ PERFORMANCE: Split contexts to prevent unnecessary re-renders
const AuthStateContext = createContext(null);
const AuthDispatchContext = createContext(null);

// ✅ PERFORMANCE: Memoized auth state hook
export const useAuthState = () => {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState must be used within an AuthProvider');
  }
  return context;
};

// ✅ PERFORMANCE: Memoized auth dispatch hook
export const useAuthDispatch = () => {
  const context = useContext(AuthDispatchContext);
  if (!context) {
    throw new Error('useAuthDispatch must be used within an AuthProvider');
  }
  return context;
};

// ✅ BACKWARD COMPATIBILITY: Combined auth hook
export const useAuth = () => {
  const state = useAuthState();
  const dispatch = useAuthDispatch();
  
  return {
    ...state,
    ...dispatch
  };
};

// ✅ MAIN AUTH PROVIDER: Manages authentication state and actions
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const initializationRef = useRef(false);
  // ✅ MEMORY LEAK FIX: Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // ✅ REAL AUTH PERSISTENCE: Using safeStorage for actual user persistence
  const getStoredUser = useCallback(async () => {
    try {
      devLog('🔑 Checking for stored user...');
      
      const storedUserJson = await safeStorage.getUserData();
      if (storedUserJson) {
        devLog('✅ Found stored user');
        return storedUserJson; // Already parsed by safeStorage
      }
      
      devLog('ℹ️ No stored user found');
      return null;
    } catch (error) {
      logger.error('Failed to get stored user:', error);
      return null;
    }
  }, []);

  const setStoredUser = useCallback(async (user) => {
    try {
      if (user) {
        devLog('💾 Storing user...');
        await safeStorage.setUserData(user);
      } else {
        devLog('🗑️ Removing stored user...');
        await safeStorage.clearAuth();
      }
    } catch (error) {
      logger.error('Failed to store user:', error);
    }
  }, []);

  // ✅ INITIALIZATION: Check for existing auth on app start
  const initializeAuth = useCallback(async () => {
    if (initializationRef.current) {
      devLog('🔐 Auth already initialized, skipping...');
      return;
    }

    initializationRef.current = true;
    
    try {
      devLog('🔐 Initializing authentication...');
      dispatch({ type: AUTH_ACTIONS.INITIALIZE_START });

      // Check for stored user
      const storedUser = await getStoredUser();
      
      if (storedUser) {
        // TODO: Validate stored user token/session
        devLog('✅ Restored user from storage');
        dispatch({ 
          type: AUTH_ACTIONS.INITIALIZE_SUCCESS, 
          payload: { user: storedUser } 
        });
      } else {
        devLog('ℹ️ No stored user, starting fresh');
        dispatch({ 
          type: AUTH_ACTIONS.INITIALIZE_SUCCESS, 
          payload: { user: null } 
        });
      }
    } catch (error) {
      logger.error('Auth initialization failed:', error);
      // ✅ CRASH FIX: Only dispatch if still mounted
      if (isMountedRef.current) {
        dispatch({ 
          type: AUTH_ACTIONS.INITIALIZE_ERROR, 
          // ✅ FIX: Serialize error message instead of full error object
          payload: { error: error?.message || 'Auth initialization failed' } 
        });
      }
    }
  }, [getStoredUser]); // ✅ FIX: Remove logger from deps - it's a stable module import

  // ✅ LOGIN: Handle user login
  const handleLoginSuccess = useCallback(async (user) => {
    // ✅ CRASH FIX: Early return if unmounted
    if (!isMountedRef.current) return;
    
    try {
      devLog('🔐 Processing login success...');
      
      if (!user) {
        throw new Error('No user data provided');
      }

      dispatch({ type: AUTH_ACTIONS.LOGIN_START });
      
      // Store user
      await setStoredUser(user);
      
      // ✅ CRASH FIX: Check mounted before dispatching after async
      if (isMountedRef.current) {
        dispatch({ 
          type: AUTH_ACTIONS.LOGIN_SUCCESS, 
          payload: { user } 
        });
        logger.info('✅ Login successful');
      }
    } catch (error) {
      logger.error('Login processing failed:', error);
      // ✅ CRASH FIX: Check mounted and serialize error
      if (isMountedRef.current) {
        dispatch({ 
          type: AUTH_ACTIONS.LOGIN_ERROR, 
          // ✅ FIX: Serialize error message instead of full error object
          payload: { error: error?.message || 'Login failed' } 
        });
      }
    }
  }, [setStoredUser]); // ✅ FIX: Remove logger from deps - it's a stable module import

  // ✅ LOGOUT: Handle user logout
  const handleLogout = useCallback(async () => {
    try {
      devLog('🔐 Processing logout...');
      
      // Clear stored user
      await setStoredUser(null);
      
      // ✅ CRASH FIX: Check mounted before dispatching after async
      if (isMountedRef.current) {
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
        logger.info('✅ Logout successful');
      }
    } catch (error) {
      logger.error('Logout failed:', error);
      // Still dispatch logout even if storage clear fails
      // ✅ CRASH FIX: Check mounted before dispatching
      if (isMountedRef.current) {
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    }
  }, [setStoredUser]); // ✅ FIX: Remove logger from deps - it's a stable module import

  // ✅ UTILITY: Clear auth errors
  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  // ✅ UTILITY: Set user directly (for external auth flows)
  const setUser = useCallback((user) => {
    dispatch({ 
      type: AUTH_ACTIONS.SET_USER, 
      payload: { user } 
    });
  }, []);

  // ✅ MEMOIZED DISPATCH ACTIONS: Prevent unnecessary re-renders
  const dispatchActions = React.useMemo(() => ({
    initializeAuth,
    handleLoginSuccess,
    handleLogout,
    clearError,
    setUser
  }), [initializeAuth, handleLoginSuccess, handleLogout, clearError, setUser]);

  // ✅ AUTO-INITIALIZE: Initialize auth on mount
  useEffect(() => {
    initializeAuth();
    
    // ✅ MEMORY LEAK FIX: Cleanup on unmount
    return () => {
      isMountedRef.current = false;
    };
  }, [initializeAuth]);

  devLog('🔐 AuthProvider rendering, state:', {
    hasUser: !!state.user,
    loading: state.loading,
    isInitialized: state.isInitialized,
    hasError: !!state.error
  });

  return (
    <AuthStateContext.Provider value={state}>
      <AuthDispatchContext.Provider value={dispatchActions}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthStateContext.Provider>
  );
};

// ✅ DEVELOPMENT: Display name for debugging
AuthProvider.displayName = 'AuthProvider';

// ✅ EXPORTS: All auth functionality
export default AuthProvider;
export { AUTH_ACTIONS };
