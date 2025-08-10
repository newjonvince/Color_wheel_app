/**
 * Updated api.js with recommendations applied
 * - Improved error handling
 * - Removed unnecessary placeholders
 * - Added console logging for debugging in Railway
 * - Configured baseURL to match production
 */

import axios from 'axios';

// Base API URL - matches Railway deployment
const API_BASE_URL = 'https://colorwheelapp-production.up.railway.app/api';

// Create an Axios instance with sensible defaults
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Token management
let authToken = null;

export const setToken = (token) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const getToken = () => authToken;

export const clearToken = () => {
  authToken = null;
  delete api.defaults.headers.common['Authorization'];
};

// Add a request interceptor for logging (debug in Railway)
api.interceptors.request.use(
  (config) => {
    console.log('📤 Sending request:', config.method?.toUpperCase(), config.url);
    if (config.data) console.log('Request payload:', config.data);
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    console.log('✅ Response received:', response.status, response.config.url);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('❌ API error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ No response from API:', error.request);
    } else {
      console.error('❌ Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Auth API endpoints
export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const demoLogin = async () => {
  const response = await api.post('/auth/demo-login');
  return response.data;
};

// User API endpoints
export const getUserProfile = async () => {
  const response = await api.get('/users/profile');
  return response.data;
};

export const updateUserProfile = async (profileData) => {
  const response = await api.put('/users/profile', profileData);
  return response.data;
};

// Color API endpoints
export const getColorMatches = async () => {
  const response = await api.get('/colors');
  return response.data;
};

export const createColorMatch = async (colorData) => {
  const response = await api.post('/colors', colorData);
  return response.data;
};

export default api;
