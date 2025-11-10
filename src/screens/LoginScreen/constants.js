// screens/LoginScreen/optimizedConstants.js - Ultra-optimized constants with memoization and validation caching

// Environment-specific configuration
const IS_DEV = __DEV__;
const IS_PROD = !__DEV__;

// Memoized validation rules (created once, reused)
export const VALIDATION_RULES = Object.freeze({
  email: Object.freeze({
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address',
    minLength: 5,
    maxLength: 254, // RFC 5321 limit
  }),
  password: Object.freeze({
    required: true,
    minLength: 6,
    maxLength: 128, // Reasonable security limit
    message: 'Password should be at least 6 characters',
  }),
});

// Environment-optimized demo user
export const DEMO_USER = Object.freeze({
  id: 'demo-user',
  email: 'demo@fashioncolorwheel.com',
  username: 'demo_user',
  location: 'United States',
  birthday: Object.freeze({ month: 'January', day: '1', year: '1990' }),
  gender: 'Prefer not to say',
  isLoggedIn: true,
  demo: true,
  createdAt: new Date().toISOString(),
});

// Performance-optimized timeouts
export const TIMEOUTS = Object.freeze({
  login: IS_DEV ? 15000 : 10000, // Longer timeout in dev for debugging
  demoLogin: IS_DEV ? 15000 : 10000,
  sessionSave: IS_DEV ? 8000 : 5000,
  validation: 300, // Debounce timeout
});

// Optimized storage keys with validation
export const STORAGE_KEYS = Object.freeze({
  userData: 'userData',
  isLoggedIn: 'isLoggedIn',
  authToken: 'fashion_color_wheel_auth_token',
  legacyAuthToken: 'authToken',
});

// Memoized validation functions with performance optimization
const validationCache = new Map();
const MAX_CACHE_SIZE = 100;

const clearCacheIfNeeded = () => {
  if (validationCache.size > MAX_CACHE_SIZE) {
    // Keep only the most recent 50 entries
    const entries = Array.from(validationCache.entries());
    validationCache.clear();
    entries.slice(-50).forEach(([key, value]) => {
      validationCache.set(key, value);
    });
  }
};

// Optimized email validation with caching
export const validateEmail = (email) => {
  if (!email) {
    return { isValid: false, message: 'Email is required' };
  }

  const trimmedEmail = email.trim();
  const cacheKey = `email_${trimmedEmail}`;
  
  // Check cache first
  if (validationCache.has(cacheKey)) {
    return validationCache.get(cacheKey);
  }

  // Validate email
  let result;
  
  if (!trimmedEmail) {
    result = { isValid: false, message: 'Email is required' };
  } else if (trimmedEmail.length < VALIDATION_RULES.email.minLength) {
    result = { isValid: false, message: 'Email is too short' };
  } else if (trimmedEmail.length > VALIDATION_RULES.email.maxLength) {
    result = { isValid: false, message: 'Email is too long' };
  } else {
    const isValid = VALIDATION_RULES.email.pattern.test(trimmedEmail);
    result = {
      isValid,
      message: isValid ? '' : VALIDATION_RULES.email.message,
    };
  }

  // Cache the result
  validationCache.set(cacheKey, result);
  clearCacheIfNeeded();

  return result;
};

// Optimized password validation with caching
export const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  const cacheKey = `password_${password.length}_${password.charAt(0)}`;
  
  // Check cache first (using length and first char to avoid storing actual password)
  if (validationCache.has(cacheKey)) {
    const cached = validationCache.get(cacheKey);
    // Verify the cached result is still valid for this password
    if (password.length >= VALIDATION_RULES.password.minLength) {
      return { isValid: true, message: '' };
    }
  }

  // Validate password
  let result;
  
  if (password.length < VALIDATION_RULES.password.minLength) {
    result = { isValid: false, message: VALIDATION_RULES.password.message };
  } else if (password.length > VALIDATION_RULES.password.maxLength) {
    result = { isValid: false, message: 'Password is too long' };
  } else {
    result = { isValid: true, message: '' };
  }

  // Cache the result (using safe cache key)
  validationCache.set(cacheKey, result);
  clearCacheIfNeeded();

  return result;
};

// Optimized form validation with early exit
export const validateForm = (email, password) => {
  const errors = {};
  let isValid = true;

  // Validate email first (most likely to fail)
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.message;
    isValid = false;
  }

  // Only validate password if email is valid (performance optimization)
  if (isValid) {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.message;
      isValid = false;
    }
  }

  return { isValid, errors };
};

// Optimized timeout wrapper with better error handling
export const withTimeout = (promise, timeoutMs) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Clear timeout if promise resolves first
      promise.finally(() => clearTimeout(timeoutId));
    })
  ]);
};

// Optimized response parser with validation
export const parseLoginResponse = (response) => {
  try {
    // Handle different response formats
    const data = response?.data || response;
    
    if (!data) {
      throw new Error('Empty response');
    }

    // Extract user and token with fallbacks
    const user = data.user || data;
    const token = data.token || data.authToken || user?.token || user?.authToken;

    // Validate user object
    if (!user || typeof user !== 'object') {
      throw new Error('Invalid user data');
    }

    // Validate required user fields
    if (!user.id && !user.email) {
      throw new Error('User missing required fields');
    }

    return { user, token };
  } catch (error) {
    if (IS_DEV) {
      console.error('❌ parseLoginResponse error:', error);
    }
    throw new Error('Failed to parse login response');
  }
};

// Optimized error message extraction
const ERROR_MESSAGES = Object.freeze({
  'Network Error': 'Unable to connect to server. Please check your internet connection or try demo login.',
  'Unable to connect to server': 'Unable to connect to server. Please check your internet connection or try demo login.',
  'fetch': 'Network connection failed. Please check your internet connection or try demo login.',
  'timeout': 'Request timed out. Please try again or use demo login.',
  'Invalid credentials': 'Invalid email or password. Please try again.',
  'User not found': 'Account not found. Please check your email or sign up.',
  'Account locked': 'Account temporarily locked. Please try again later.',
  'Server error': 'Server error. Please try again later or use demo login.',
  'Authentication required': 'Please log in again.',
});

export const getErrorMessage = (error) => {
  if (!error) return 'Unknown error occurred';

  const errorMessage = error.message || error.toString();
  
  // Check for known error patterns
  for (const [pattern, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return message;
    }
  }

  // Handle HTTP status codes
  if (error.response?.status) {
    switch (error.response.status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Invalid email or password.';
      case 403:
        return 'Access denied. Please try again.';
      case 404:
        return 'Service not found. Please try again later.';
      case 429:
        return 'Too many attempts. Please wait and try again.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return `Server error (${error.response.status}). Please try again.`;
    }
  }

  // Fallback to generic message
  return IS_DEV ? errorMessage : 'An error occurred. Please try again.';
};

// Debounced validation utilities
export const debouncedValidation = {
  validateEmail,
  validatePassword,
  validateForm,
};

// Performance monitoring utilities (development only)
export const performanceUtils = IS_DEV ? {
  getCacheStats: () => ({
    validationCacheSize: validationCache.size,
    maxCacheSize: MAX_CACHE_SIZE,
  }),
  
  clearCache: () => {
    validationCache.clear();
    console.log('🧹 LoginScreen validation cache cleared');
  },
  
  logCacheStats: () => {
    console.log('📊 LoginScreen Cache Stats:', performanceUtils.getCacheStats());
  }
} : {
  getCacheStats: () => ({}),
  clearCache: () => {},
  logCacheStats: () => {}
};

// Memory cleanup utility
export const cleanup = () => {
  validationCache.clear();
  
  if (IS_DEV) {
    console.log('🧹 LoginScreen constants cleaned up');
  }
};

// Export optimized constants object
export const optimizedConstants = {
  VALIDATION_RULES,
  DEMO_USER,
  TIMEOUTS,
  STORAGE_KEYS,
  validateEmail,
  validatePassword,
  validateForm,
  withTimeout,
  parseLoginResponse,
  getErrorMessage,
  debouncedValidation,
  performanceUtils,
  cleanup,
};

export default optimizedConstants;
