// Simple validation rules and constants for LoginScreen
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

// Simple response parser
export const parseLoginResponse = (response) => {
  const data = response?.data || response;
  
  if (!data) {
    throw new Error('Empty response');
  }

  const user = data.user || data;
  const token = data.token || data.authToken || user?.token || user?.authToken;

  if (!user || typeof user !== 'object') {
    throw new Error('Invalid user data');
  }

  if (!user.id && !user.email) {
    throw new Error('User missing required fields');
  }

  return { user, token };
};

// Simple error message extraction
export const getErrorMessage = (error) => {
  if (!error) return 'Unknown error occurred';

  const errorMessage = error.message || error.toString();
  
  if (errorMessage.toLowerCase().includes('network')) {
    return 'Unable to connect to server. Please check your internet connection or try demo login.';
  }
  
  if (errorMessage.toLowerCase().includes('timeout')) {
    return 'Request timed out. Please try again or use demo login.';
  }

  // Handle authentication errors (string match for safeApiService errors)
  if (errorMessage.includes('Authentication required')) {
    return 'Invalid email or password.';
  }

  // Handle HTTP status codes (for direct axios errors)
  if (error.response?.status === 401) {
    return 'Invalid email or password.';
  }
  
  if (error.response?.status >= 500) {
    return 'Server error. Please try again later.';
  }

  return __DEV__ ? errorMessage : 'An error occurred. Please try again.';
};
