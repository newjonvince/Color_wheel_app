// screens/LoginScreen/constants.js - Constants and validation utilities

export const VALIDATION_RULES = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address',
  },
  password: {
    required: true,
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
};

export const TIMEOUTS = {
  login: 10000,
  demoLogin: 10000,
  sessionSave: 5000,
};

export const STORAGE_KEYS = {
  userData: 'userData',
  isLoggedIn: 'isLoggedIn',
  authToken: 'fashion_color_wheel_auth_token',
  legacyAuthToken: 'authToken',
};

// Validation utilities
export const validateEmail = (email) => {
  if (!email?.trim()) {
    return { isValid: false, message: 'Email is required' };
  }
  
  const isValid = VALIDATION_RULES.email.pattern.test(email.trim());
  return {
    isValid,
    message: isValid ? '' : VALIDATION_RULES.email.message,
  };
};

export const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }
  
  const isValid = password.length >= VALIDATION_RULES.password.minLength;
  return {
    isValid,
    message: isValid ? '' : VALIDATION_RULES.password.message,
  };
};

export const validateForm = (email, password) => {
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);
  
  return {
    isValid: emailValidation.isValid && passwordValidation.isValid,
    errors: {
      email: emailValidation.message,
      password: passwordValidation.message,
    },
  };
};

// Timeout utility
export const withTimeout = (promise, ms = 10000) => Promise.race([
  promise,
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timed out')), ms)
  ),
]);

// Response parsing utilities
export const parseLoginResponse = (response) => {
  // Handle new standardized API response format
  if (response?.success && response?.data) {
    const user = response.data.user;
    const token = response.data.token || response.data.accessToken;
    return { user, token };
  }
  
  // Handle legacy response format
  const user = response?.user || response?.data?.user;
  const token = response?.token || response?.data?.token || response?.accessToken;
  
  return { user, token };
};

export const getErrorMessage = (error) => {
  // Handle new standardized API error format
  if (error?.response?.data?.success === false) {
    return error.response.data.message || 'Request failed';
  }
  
  // Handle legacy error formats
  return error?.response?.data?.message ||
         error?.response?.data?.error ||
         error?.message ||
         'Something went wrong. Please try again.';
};
