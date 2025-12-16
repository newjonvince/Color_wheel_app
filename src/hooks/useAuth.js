// hooks/useAuth.js - Legacy compatibility layer for the new split context pattern
// DEPRECATED: This file is kept for backward compatibility only
// NEW: Use AuthProvider, useAuthState, and useAuthDispatch from contexts/AuthContext.js

// SMART DEPRECATION WARNING: Only warn in development, and only once
let hasWarned = false;

const warnOnce = () => {
  // CRASH FIX: Use typeof check to prevent ReferenceError in production
  if (!hasWarned && typeof __DEV__ !== 'undefined' && __DEV__) {
    hasWarned = true;
    console.warn('DEPRECATED: useAuth hook from hooks/useAuth.js is deprecated. Use AuthProvider, useAuthState, and useAuthDispatch from contexts/AuthContext.js instead.');
  }
};

// Re-export the new context-based hooks for backward compatibility
export { 
  useAuthState, 
  useAuthDispatch, 
  AuthProvider 
} from '../contexts/AuthContext';

// USAGE-BASED WARNING: Wrap useAuth to warn on first actual use
import { useAuth as _useAuth } from '../contexts/AuthContext';
const useAuth = (...args) => {
  warnOnce();
  return _useAuth(...args);
};

// Export wrapped useAuth for both named and default exports
export { useAuth };
export default useAuth;
