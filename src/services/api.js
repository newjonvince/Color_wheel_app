// services/api.js — updated for session-based image extraction
// - Uses EXPO_PUBLIC_API_BASE_URL (falls back to API_BASE_URL), appends /api if missing
// - Adds session-based image extractor helpers
// - Correct payloads for backend endpoints

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Get API base URL from Expo config or environment
const getApiBaseUrl = () => {
  // Try Expo Constants first (app.json extra config)
  try {
    const Constants = require('expo-constants').default;
    if (Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL) {
      return Constants.expoConfig.extra.EXPO_PUBLIC_API_BASE_URL;
    }
  } catch {}
  
  // Fallback to process.env
  return process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '';
};

const HOST = getApiBaseUrl().replace(/\/+$/, '');
const API_ROOT = /\/api$/.test(HOST) ? HOST : `${HOST}/api`;

// Log API base URL at startup for debugging
if (__DEV__) {
  console.log('🌐 API Configuration:');
  console.log('  From app.json extra:', getApiBaseUrl());
  console.log('  EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL);
  console.log('  API_BASE_URL:', process.env.API_BASE_URL);
  console.log('  Final API_ROOT:', API_ROOT);
  
  if (!HOST) {
    console.warn('⚠️  WARNING: No API base URL configured! Requests will fail.');
    console.warn('   Set EXPO_PUBLIC_API_BASE_URL in app.json extra config or environment');
  }
}

// Helper used by fetch-based endpoints
const auth = () => {
  const h = { Accept: 'application/json' };
  if (authToken) h.Authorization = `Bearer ${authToken}`;
  return h;
};

// Helper for axios requests with auth headers
const withAuthHeaders = (config = {}) => ({
  ...config,
  headers: {
    ...config.headers,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
  }
});



export async function sampleColorAt(imageId, nx, ny, radius=0.02){
  await ready;
  const res = await fetch(`${API_ROOT}/images/sample-color`, {
    method:'POST',
    headers:{ ...auth(), 'Content-Type':'application/json' },
    body: JSON.stringify({ imageId, x:nx, y:ny, units:'norm', radius })
  });
  if(!res.ok) throw new Error(`sample-color ${res.status}`);
  return res.json(); // { hex }
}

export async function closeImageSession(imageId){
  await ready;
  const res = await fetch(`${API_ROOT}/images/extract-session`, {
    method:'DELETE',
    headers: auth()
  });
  if(!res.ok) throw new Error(`close-session ${res.status}`);
  return res.json();
}

export const api = axios.create({
  baseURL: API_ROOT,
  timeout: 20000,
  // Add retry configuration for better reliability
  validateStatus: (status) => {
    // Accept 2xx and 3xx status codes, but handle 401 specially
    return status < 400 || status === 401;
  },
});

// ---- Auth Functions ----
export const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

export const register = async (userData) => {
  const { data } = await api.post('/auth/register', userData);
  return data;
};

export const demoLogin = async () => {
  const { data } = await api.post('/auth/demo-login');
  return data;
};

export const getUserProfile = async () => {
  await ready;
  const { data } = await api.get('/auth/profile', withAuthHeaders());
  return data;
};

export const updateUserProfile = async (updates) => {
  await ready;
  const { data } = await api.put('/auth/profile', updates, withAuthHeaders());
  return data;
};

// ---- Image Functions ----
export const extractColorsFromImage = async (imageUri, options = {}) => {
  const form = new FormData();
  form.append('image', {
    uri: imageUri,
    name: options.fileName || 'upload.jpg',
    type: options.mime || 'image/jpeg'
  });
  
  const { data } = await _try(
    () => _postMultipart('/images/extract-colors', form),
    () => _postMultipart('/extract-colors', form)
  );
  return data;
};

// ---- Color Match Functions ----
export const createColorMatch = async (colorMatch) => {
  await ready;
  const { data } = await api.post('/color-matches', colorMatch, withAuthHeaders());
  return data;
};

export const getColorMatches = async (params = {}) => {
  const { data } = await api.get('/color-matches', { params });
  return data;
};

export const getUserColorMatches = async (userId) => {
  await ready;
  const url = userId ? `/color-matches/user/${userId}` : '/color-matches/user';
  const { data } = await api.get(url, withAuthHeaders());
  return data;
};

export const getColorMatch = async (id) => {
  const { data } = await api.get(`/color-matches/${id}`);
  return data;
};

export const updateColorMatch = async (id, updates) => {
  await ready;
  const { data } = await api.put(`/color-matches/${id}`, updates, withAuthHeaders());
  return data;
};

export const deleteColorMatch = async (id) => {
  await ready;
  const { data } = await api.delete(`/color-matches/${id}`, withAuthHeaders());
  return data;
};

// ---- Color Match Likes Functions ----
export const likeColorMatch = async (colorMatchId) => {
  await ready;
  const { data } = await api.post(`/likes/color-matches/${colorMatchId}`, {}, withAuthHeaders());
  return data;
};

export const unlikeColorMatch = async (colorMatchId) => {
  await ready;
  const { data } = await api.delete(`/likes/color-matches/${colorMatchId}`, withAuthHeaders());
  return data;
};

export const getColorMatchLikes = async (colorMatchId) => {
  const { data } = await api.get(`/likes/color-matches/${colorMatchId}`);
  return data;
};

export const getUserLikedColorMatches = async (params = {}) => {
  await ready;
  const { data } = await api.get('/likes/user/color-matches', { 
    params,
    ...withAuthHeaders() 
  });
  return data;
};

export const getPopularColorMatches = async (params = {}) => {
  const { data } = await api.get('/likes/popular/color-matches', { params });
  return data;
};

// ---- Community Functions ----
export const getCommunityFeed = async (params = {}) => {
  const { data } = await api.get('/community/feed', { params });
  return data;
};

// ---- Utility Functions ----
export const validateHexLocal = (hex) => {
  return /^#[0-9A-F]{6}$/i.test(hex);
};

// RESPONSE interceptor: normalize 401
api.interceptors.response.use(
  r => r,
  async (err) => {
    if (err?.response?.status === 401) {
      await setToken(null);
      err.isAuthError = true;
    }
    return Promise.reject(err);
  }
);

const TOKEN_KEY = 'fashion_color_wheel_auth_token';
const LEGACY_TOKEN_KEY = 'authToken'; // App.js legacy key

let authToken = null;

// Initialize token from secure storage on app start - read both keys, prefer new one
const initializeToken = async () => {
  try {
    if (__DEV__) console.log('🔄 ApiService: Initializing token from SecureStore...');
    // Try new key first
    let storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!storedToken) {
      // try legacy key (SecureStore) then legacy AsyncStorage fallback
      storedToken = await SecureStore.getItemAsync(LEGACY_TOKEN_KEY);
      if (!storedToken) storedToken = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
      if (storedToken) {
        if (__DEV__) console.log('🔄 ApiService: Migrating token from legacy key');
        // Migrate to new key
        await SecureStore.setItemAsync(TOKEN_KEY, storedToken);
        await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY).catch(()=>{});
        await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(()=>{});
      }
    }
    if (storedToken) {
      authToken = storedToken;
      // ensure *all* axios calls carry the header (instance + any stray usage)
      api.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
      try { 
        const globalAxios = require('axios');
        globalAxios.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
        if (__DEV__) console.log('🔧 Set global axios defaults with token');
      } catch {}
      if (__DEV__) console.log('✅ ApiService: Token loaded successfully, length:', storedToken.length);
      if (__DEV__) console.log('✅ ApiService: Axios defaults set with Authorization header');
    } else {
      if (__DEV__) console.log('⚠️ ApiService: No stored token found');
    }
  } catch (error) {
    console.error('❌ ApiService: Failed to load stored auth token:', error);
  }
};

// Initialize token on module load and export a readiness promise
export const ready = initializeToken();

// Last-resort guard: ensure ANY fetch carries Authorization when logged in
const _realFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  try {
    const headers = { ...(options.headers || {}) };
    const t = authToken;
    if (t) headers.Authorization = `Bearer ${t}`;
    return await _realFetch(url, { ...options, headers });
  } catch (error) {
    // Add context to fetch errors for better debugging
    if (typeof url === 'string' && url.includes(API_ROOT)) {
      error.isApiRequest = true;
      error.apiUrl = url;
    }
    throw error;
  }
};

export const setToken = async (t) => { 
  authToken = t; 
  // update axios defaults everywhere
  api.defaults.headers.common.Authorization = t ? `Bearer ${t}` : undefined;
  try { 
    const globalAxios = require('axios');
    globalAxios.defaults.headers.common.Authorization = t ? `Bearer ${t}` : undefined;
    if (__DEV__) console.log('🔧 Updated global axios defaults');
  } catch {}
  
  if (t) {
      if (__DEV__) console.log('🔧 ApiService: setToken called with token length:', t.length);
    if (__DEV__) console.log('🔧 ApiService: Updated axios defaults with new token');
  } else {
    if (__DEV__) console.log('🔧 ApiService: setToken called with null - clearing token');
  }
  
  try {
    if (t) {
      await SecureStore.setItemAsync(TOKEN_KEY, t);
    } else {
      // Clear both keys on logout to prevent silent logout state
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
      await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(()=>{});
    }
  } catch (error) {
    if (__DEV__) console.warn('Failed to store auth token:', error);
  }
};

export const clearToken = () => setToken(null);

// Back-compat setter if anything still calls it
export const setAuthToken = (t) => setToken(t);

export const getToken = () => authToken;


// Request interceptor: wait for bootstrap, inject Authorization unconditionally
api.interceptors.request.use(async (cfg) => {
  await ready;
  cfg.headers = cfg.headers || {};
  
  if (authToken) {
    cfg.headers.Authorization = `Bearer ${authToken}`;
    if (__DEV__) console.log('🔧 ApiService: Set Authorization header via interceptor');
  } else {
    if (__DEV__) console.warn('⚠️ ApiService: No authToken available for request to', cfg.url);
    if (__DEV__) console.warn('⚠️ This request will fail with 401');
  }
  
  return cfg;
}, (error) => {
  console.error('❌ Request interceptor error:', error);
  return Promise.reject(error);
});

// Remove temporary debug logging before production

// ---- Generic HTTP helpers (used by Community screens) ----
export const get = async (url, config = {}) => {
  await ready; // Ensure token is loaded before making request
  const { data } = await api.get(url, withAuthHeaders(config));
  return data;
};
export const post = async (url, body = {}, config = {}) => {
  await ready; // Ensure token is loaded before making request
  const { data } = await api.post(url, body, withAuthHeaders(config));
  return data;
};
export const put = async (url, body = {}, config = {}) => {
  await ready; // Ensure token is loaded before making request
  const { data } = await api.put(url, body, withAuthHeaders(config));
  return data;
};
export const del = async (url, config = {}) => {
  await ready; // Ensure token is loaded before making request
  const { data } = await api.delete(url, withAuthHeaders(config));
  return data;
};

// Back-compat aliases (some code may call ApiService.delete)
export const _delete = del;

// ---- Multipart helper & dual-endpoint try/fallback ----
async function _postMultipart(url, form, cfg) {
  return api.post(url, form, {
    headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    ...(cfg || {}),
  });
}
async function _try(primary, fallback) {
  try { return await primary(); }
  catch (e) {
    const status = e?.response?.status;
    if (status === 404 || status === 405) return await fallback();
    throw e;
  }
}

// ---- Image extractor (session flow) ----
export const startImageExtractSession = async (imageUri, {
  mime = 'image/jpeg',
  fileName = 'upload.jpg',
  maxWidth = 1200,
  maxHeight = 1200,
  onProgress,
} = {}) => {
  if (!imageUri) throw new Error('imageUri is required');
  const form = new FormData();
  form.append('image', { uri: imageUri, name: fileName, type: mime });
  form.append('maxWidth', String(maxWidth));
  form.append('maxHeight', String(maxHeight));

  const uploadCfg = {
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  };

  const { data } = await _try(
    () => _postMultipart('/images/extract-session', form, uploadCfg),
    () => _postMultipart('/images/extract-colors', form, uploadCfg),
  );

  const token = data.imageId || data.sessionId || data.token;
  return { ...data, sessionId: token, imageId: token, token };
};

export const sampleImageColor = async (sessionToken, {
  x = null, y = null, nx = null, ny = null,
} = {}) => {
  await ready; // Ensure token is loaded before making request
  if (!sessionToken) throw new Error('sessionToken is required');
  let useNormalized; let sx; let sy;
  if (nx != null && ny != null) { useNormalized = true; sx = nx; sy = ny; }
  else if (x != null && y != null) { useNormalized = false; sx = x; sy = y; }
  else { throw new Error('Provide either {x,y} or normalized {nx,ny}'); }

  const bodyA = { sessionToken, x: sx, y: sy, normalized: useNormalized };
  const doA = () => api.post('/images/extract-sample', bodyA, withAuthHeaders());

  const bodyB = { imageId: sessionToken, x: sx, y: sy, units: useNormalized ? 'normalized' : 'px' };
  const doB = () => api.post('/images/sample-color', bodyB, withAuthHeaders());

  const { data } = await _try(doA, doB);
  return data;
};

export const closeImageExtractSession = async (sessionId) => {
  await ready; // Ensure token is loaded before making request
  if (!sessionId) return { ok: true };
  const doA = () => api.post(`/images/extract-session/${encodeURIComponent(sessionId)}/close`, {}, withAuthHeaders());
  const doB = () => api.post('/images/close-session', { imageId: sessionId }, withAuthHeaders());
  const { data } = await _try(doA, doB);
  return data;
};

export const validateHex = async (hex) => {
  await ready; // Ensure token is loaded before making request
  const { data } = await api.post('/colors/validate', { hex }, withAuthHeaders());
  return data;
};

// ---- Community convenience (optional) ----

export const ping = async () => {
  await ready; // Ensure token is loaded before making request
  const { data } = await api.get('/health');
  return data;
};

export const logout = async () => {
  try {
    await api.post('/auth/logout', {}, withAuthHeaders());
  } catch (error) {
    console.warn('Logout API call failed:', error);
  }
  
  // Comprehensive token cleanup to prevent phantom login states
  await setToken(null); // This clears both SecureStore keys
  
  // Also clear any legacy AsyncStorage tokens
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userData');
    await AsyncStorage.removeItem('isLoggedIn');
  } catch (error) {
    console.warn('Failed to clear AsyncStorage tokens:', error);
  }
};




// Feature health check function (renamed to avoid duplicate)
export const healthCheck = async () => {
  await ready; // Ensure token is loaded before making request
  try {
    // Fix: Use POST for /colors/validate (backend supports POST)
    const { data } = await api.post('/colors/validate', { hex: '#FF0000' }, withAuthHeaders());
    return { success: true, data };
  } catch (error) {
    console.warn('Health check failed:', error);
    return { success: false, error: error.message };
  }
};

// ---- Export default object ----
const ApiService = {
  // API configuration
  baseURL: API_ROOT,
  ready, // Export the readiness promise
  // auth
  setToken, getToken, clearToken, login, register, demoLogin, getUserProfile, updateUserProfile,
  // image extraction
  extractColorsFromImage,
  // session-based image methods (fixed exports)
  startImageExtractSession, sampleColorAt, closeImageExtractSession,
  // legacy image methods (preserved)
  sampleImageColor, closeImageSession,
  // colors
  createColorMatch, getColorMatches, getUserColorMatches, getColorMatch, updateColorMatch, deleteColorMatch, validateHex, validateHexLocal,
  // community
  getCommunityFeed,
  // health check
  healthCheck, ping,
  // utilities
  logout,
};

// getUserColorMatches is now defined above with proper parameter support

export default ApiService;
