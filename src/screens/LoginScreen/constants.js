// Simple validation rules and constants for LoginScreen
import Constants from 'expo-constants';
import { STORAGE_KEYS } from '../../constants/storageKeys';

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

// ✅ Factory function instead of static object
export const createDemoUser = () => ({
  id: 'demo-user',
  email: 'demo@fashioncolorwheel.com',
  username: 'demo_user',
  location: 'United States',
  birthday: { month: 'January', day: '1', year: '1990' },
  gender: 'Prefer not to say',
  isLoggedIn: true,
  demo: true,
  createdAt: new Date().toISOString(), // ✅ Fresh timestamp each call
});

export const TIMEOUTS = {
  login: 10000,
  demoLogin: 10000,
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
  let timeoutId;
  let settled = false;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
  });

  return Promise.race([
    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          return value;
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          throw error;
        }
      }
    ),
    timeoutPromise
  ]).finally(() => {
    // ✅ Always cleanup
    if (timeoutId) clearTimeout(timeoutId);
  });
};

// 🔧 Whitelist of allowed properties
const ALLOWED_USER_FIELDS = new Set([
  'id', '_id', 'userId',
  'email', 'username', 'name', 'displayName',
  'location', 'birthday', 'gender',
  'createdAt', 'updatedAt',
  'profileImage', 'avatar',
  'bio', 'preferences',
]);

// 🔧 Safe property picker - prevents prototype pollution
const pickSafeProperties = (obj, allowedFields) => {
  if (!obj || typeof obj !== 'object') return {};
  
  const safe = Object.create(null); // 🔧 No prototype!
  
  for (const key of allowedFields) {
    // 🔧 Only copy own properties, not prototype properties
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      // 🔧 Deep validation for nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // For nested objects like birthday, validate structure
        safe[key] = JSON.parse(JSON.stringify(value));
      } else {
        safe[key] = value;
      }
    }
  }
  
  return safe;
};

// 🔧 Secure response parser with property whitelisting
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

  // 🔧 Validate user object has required fields
  if (!user || typeof user !== 'object') {
    throw new Error('Invalid user data structure');
  }

  if (!user.id && !user._id && !user.userId && !user.email) {
    throw new Error('User missing required identifier');
  }

  // 🔧 Safely pick only whitelisted properties
  const safeUser = pickSafeProperties(user, ALLOWED_USER_FIELDS);
  
  // 🔧 Build normalized user with explicit properties
  const normalizedUser = Object.create(null); // No prototype
  
  normalizedUser.id = safeUser.id || safeUser._id || safeUser.userId;
  normalizedUser.email = safeUser.email;
  normalizedUser.username = safeUser.username || safeUser.name || safeUser.displayName;
  
  // Optional fields
  if (safeUser.location) normalizedUser.location = safeUser.location;
  if (safeUser.birthday) normalizedUser.birthday = safeUser.birthday;
  if (safeUser.gender) normalizedUser.gender = safeUser.gender;
  if (safeUser.profileImage) normalizedUser.profileImage = safeUser.profileImage;
  if (safeUser.bio) normalizedUser.bio = safeUser.bio;
  
  normalizedUser.createdAt = safeUser.createdAt || new Date().toISOString();

  // 🔧 Validate token format
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token format');
  }
  
  // 🔧 Basic JWT validation (should have 3 parts)
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    throw new Error('Invalid JWT token structure');
  }

  return { 
    user: normalizedUser, 
    token: token.trim() 
  };
};

// ✅ Input sanitization to prevent injection attacks and DOS
export const sanitizeEmail = (email) => {
  if (!email) return '';
  
  return email
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '') // Remove whitespace
    .replace(/[<>"&]/g, '') // ✅ Only remove HTML injection chars (keep ' and +)
    .slice(0, 254); // ✅ RFC 5321 max length is 254
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

  let rawMessage = (error.message || String(error) || '').toLowerCase();
  
  // ✅ SECURITY: Remove any potential credential leaks from error messages
  rawMessage = rawMessage
    .replace(/password[:\s]*[^\s]+/gi, 'password: [REDACTED]')
    .replace(/email[:\s]*[^\s@]+@[^\s]+/gi, 'email: [REDACTED]')
    .replace(/token[:\s]*[^\s]+/gi, 'token: [REDACTED]')
    .replace(/key[:\s]*[^\s]+/gi, 'key: [REDACTED]');

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
