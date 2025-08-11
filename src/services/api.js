/**
 * api.js
 * - Single-source exports (no duplicate re-exports to avoid runtime issues)
 * - Base URL from env with Railway fallback
 * - Axios instance with logging + robust error handling
 */

import axios from 'axios';

// Prefer env value; fallback to Railway
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  'https://colorwheelapp-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ---- Token management -----------------------------------------------------
let authToken = null;

const setToken = (token) => {
  authToken = token || null;
  if (authToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

const getToken = () => authToken;
const clearToken = () => setToken(null);

// ---- Interceptors ---------------------------------------------------------
api.interceptors.request.use(
  (config) => {
    console.log('📤', (config.method || 'get').toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error?.message);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (res) => {
    console.log('✅', res.status, res.config?.url);
    return res;
  },
  (error) => {
    if (error.response) {
      console.error('❌ API error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ No response from API');
    } else {
      console.error('❌ Setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

// ---- Auth -----------------------------------------------------------------
const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

const register = async (userData) => {
  const { data } = await api.post('/auth/register', userData);
  return data;
};

const demoLogin = async () => {
  const { data } = await api.post('/auth/demo-login');
  return data;
};

// ---- User -----------------------------------------------------------------
const getUserProfile = async () => {
  const { data } = await api.get('/users/profile');
  return data;
};

const updateUserProfile = async (profileData) => {
  const { data } = await api.put('/users/profile', profileData);
  return data;
};

// ---- Colors ---------------------------------------------------------------
const getColorMatches = async () => {
  const { data } = await api.get('/colors');
  return data;
};

const createColorMatch = async (colorData) => {
  const { data } = await api.post('/colors/matches', colorData);
  return data.data; // Return the actual color match data
};

const getUserColorMatches = async (limit = 50, offset = 0) => {
  const { data } = await api.get('/colors/matches', { 
    params: { limit, offset } 
  });
  return data.data; // Return the array of color matches
};

// ---- Community ------------------------------------------------------------
const getCommunityPosts = async (cursor = null) => {
  const params = cursor ? { cursor } : {};
  const { data } = await api.get('/community/posts/community', { params });
  return data;
};

const followUser = async (userId) => {
  const { data } = await api.post(`/community/users/${userId}/follow`);
  return data;
};

const unfollowUser = async (userId) => {
  const { data } = await api.delete(`/community/users/${userId}/follow`);
  return data;
};

const likePost = async (postId) => {
  const { data } = await api.post(`/community/posts/${postId}/like`);
  return data;
};

const unlikePost = async (postId) => {
  const { data } = await api.delete(`/community/posts/${postId}/like`);
  return data;
};

// ---- Images ---------------------------------------------------------------
const extractColorsFromImage = async (imageUri) => {
  const formData = new FormData();
  formData.append('image', { uri: imageUri, type: 'image/jpeg', name: 'upload.jpg' });
  const { data } = await api.post('/images/extract-colors', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

// ---- Default service object ----------------------------------------------
const ApiService = {
  // token
  setToken, getToken, clearToken,
  // auth
  login, register, demoLogin,
  // user
  getUserProfile, updateUserProfile,
  // colors
  getColorMatches, createColorMatch, getUserColorMatches,
  // community
  getCommunityPosts, followUser, unfollowUser, likePost, unlikePost,
  // images
  extractColorsFromImage,
  // generic
  get: (url, config) => api.get(url, config),
  post: (url, data, config) => api.post(url, data, config),
  put: (url, data, config) => api.put(url, data, config),
  delete: (url, config) => api.delete(url, config),
  patch: (url, data, config) => api.patch(url, data, config),
};

export default ApiService;

// Named exports for direct import compatibility
export {
  setToken,
  getToken,
  clearToken,
  login,
  register,
  demoLogin,
  getUserProfile,
  updateUserProfile,
  getColorMatches,
  createColorMatch,
  getUserColorMatches,
  getCommunityPosts,
  followUser,
  unfollowUser,
  likePost,
  unlikePost,
  extractColorsFromImage,
};
