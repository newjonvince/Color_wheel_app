// Simple validation rules and constants for LoginScreen
import Constants from 'expo-constants';
export const VALIDATION_RULES = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address',
  },
  password: {
    minLength: 6,
    message: 'Password should be at least 6 characters',
  },
};

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@fashioncolorwheel.com',
  username: 'demo_user',
  location: 'United States',
  birthday: { month: 'January', day: '1', year: '1990' },
  gender: 'Prefer not to say',
  isLoggedIn: true,
  demo: true,
  createdAt: new Date().toISOString(),
};

export const TIMEOUTS = {
  login: 10000,
  demoLogin: 10000,
};

export const STORAGE_KEYS = {
  userData: 'userData',
  isLoggedIn: 'isLoggedIn',
  authToken: 'fashion_color_wheel_auth_token',
};

// Simple validation functions
export const validateEmail = (email) => {
  if (!email || !email.trim()) {
    return { isValid: false, message: 'Email is required' };
  }

  const trimmedEmail = email.trim();
  const isValid = VALIDATION_RULES.email.pattern.test(trimmedEmail);
  
  return {
    isValid,
    message: isValid ? '' : VALIDATION_RULES.email.message,
  };
};

export const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < VALIDATION_RULES.password.minLength) {
    return { isValid: false, message: VALIDATION_RULES.password.message };
  }

  return { isValid: true, message: '' };
};

// Simple form validation
export const validateForm = (email, password) => {
  const errors = {};
  let isValid = true;

  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.message;
    isValid = false;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.message;
    isValid = false;
  }

  return { isValid, errors };
};

// Safe timeout wrapper that prevents unhandled rejections
export const withTimeout = (maybePromise, timeoutMs) => {
  const promise = Promise.resolve(maybePromise);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
};

// ✅ Enhanced response parser to handle all response shapes
export const parseLoginResponse = (response) => {
  // Handle various response structures
  let data;
  
  if (!response) {
    throw new Error('Empty response');
  }
  
  // Try different response structures
  if (response.data) {
    data = response.data;
  } else if (response.body) {
    data = response.body;
  } else if (response.result) {
    data = response.result;
  } else {
    data = response;
  }
  
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response format');
  }

  // Extract user from various possible locations
  let user;
  if (data.user && typeof data.user === 'object') {
    user = data.user;
  } else if (data.profile && typeof data.profile === 'object') {
    user = data.profile;
  } else if (data.account && typeof data.account === 'object') {
    user = data.account;
  } else if (data.id || data.email) {
    // User data is at root level
    user = data;
  } else {
    throw new Error('User data not found in response');
  }

  // Extract token from various possible locations
  const token = data.token || 
                data.authToken || 
                data.accessToken || 
                data.jwt || 
                data.access_token ||
                user?.token || 
                user?.authToken ||
                user?.accessToken ||
                user?.jwt;

  // Validate user object
  if (!user || typeof user !== 'object') {
    throw new Error('Invalid user data structure');
  }

  // Ensure user has required fields
  if (!user.id && !user._id && !user.userId && !user.email) {
    throw new Error('User missing required identifier (id, _id, userId, or email)');
  }

  // Normalize user object
  const normalizedUser = {
    id: user.id || user._id || user.userId,
    email: user.email,
    username: user.username || user.name || user.displayName,
    ...user // Include all other user properties
  };

  return { user: normalizedUser, token };
};

// ✅ Input sanitization to prevent injection attacks and DOS
export const sanitizeEmail = (email) => {
  if (!email) return '';
  
  return email
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .slice(0, 255); // Prevent extremely long inputs
};

export const sanitizePassword = (password) => {
  if (!password) return '';
  
  // Don't trim password (spaces might be intentional)
  // But limit length to prevent DOS attacks
  return password.slice(0, 128);
};

export const sanitizeInput = (input, maxLength = 255) => {
  if (!input) return '';
  
  return input
    .trim()
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .slice(0, maxLength);
};

// ✅ PRODUCTION-READY: Error message handling with debug mode support
const extra = Constants.expoConfig?.extra || {};
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

export const getErrorMessage = (error) => {
  if (!error) return 'An error occurred. Please try again.';

  const rawMessage = (error.message || String(error) || '').toLowerCase();

  // Network / offline
  if (rawMessage.includes('network')) {
    return 'Unable to connect. Check your internet and try again.';
  }

  // Timeout
  if (rawMessage.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Auth
  if (rawMessage.includes('authentication required')) {
    return 'Invalid email or password.';
  }

  if (error.response?.status === 401) {
    return 'Invalid email or password.';
  }

  if (error.response?.status >= 500) {
    return 'Server error. Please try again later.';
  }

  // Debug-only: show full message if you *explicitly* turn on debug mode
  if (IS_DEBUG_MODE) {
    return error.message || String(error) || 'An error occurred. Please try again.';
  }

  // Default safe fallback
  return 'An error occurred. Please try again.';
};
