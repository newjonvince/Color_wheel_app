// services/api.js — updated for session-based image extraction
// - Uses EXPO_PUBLIC_API_BASE_URL (falls back to API_BASE_URL), appends /api if missing
// - Adds session-based image extractor helpers
// - Correct payloads for backend endpoints

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const HOST = (process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '').replace(/\/+$/, '');
const API_ROOT = /\/api$/.test(HOST) ? HOST : `${HOST}/api`;

// Log API base URL at startup for debugging
if (__DEV__) {
  console.log('🌐 API Configuration:');
  console.log('  EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL);
  console.log('  API_BASE_URL:', process.env.API_BASE_URL);
  console.log('  Final API_ROOT:', API_ROOT);
}

// Fix: Use unified token system (authToken, not _token)
function auth(){ const h={Accept:'application/json'}; if(authToken)h.Authorization=`Bearer ${authToken}`; return h; }



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
  try{
    await fetch(`${API_ROOT}/images/close-session`, {
      method:'POST', headers:{ ...auth(), 'Content-Type':'application/json' },
      body: JSON.stringify({ imageId })
    });
  } catch(e) { console.warn('close-session error:', e); }
}

const api = axios.create({
  baseURL: API_ROOT,
  timeout: 20000,
});

// Add response interceptor for 401 handling
api.interceptors.response.use(
  r => r,
  async (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      // clear tokens so app sees "logged out"
      await setToken(null);
      // attach a recognizable error message
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
    console.log('🔄 ApiService: Initializing token from SecureStore...');
    // Try new key first
    let storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!storedToken) {
      // Fallback to legacy key from App.js
      storedToken = await SecureStore.getItemAsync(LEGACY_TOKEN_KEY);
      if (storedToken) {
        console.log('🔄 ApiService: Migrating token from legacy key');
        // Migrate to new key
        await SecureStore.setItemAsync(TOKEN_KEY, storedToken);
        await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
      }
    }
    if (storedToken) {
      authToken = storedToken;
      api.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
      try { require('axios').defaults.headers.common.Authorization = `Bearer ${storedToken}`; } catch {}
      console.log('✅ ApiService: Token loaded successfully');
    } else {
      console.log('⚠️ ApiService: No stored token found');
    }
  } catch (error) {
    console.error('❌ ApiService: Failed to load stored auth token:', error);
  }
};

// Initialize token on module load and export a readiness promise
export const ready = initializeToken();

export const setToken = async (t) => { 
  authToken = t; 
  api.defaults.headers.common.Authorization = t ? `Bearer ${t}` : undefined;
  try { require('axios').defaults.headers.common.Authorization = t ? `Bearer ${t}` : undefined; } catch {}
  try {
    if (t) {
      await SecureStore.setItemAsync(TOKEN_KEY, t);
    } else {
      // Clear both keys on logout to prevent silent logout state
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
    }
  } catch (error) {
    if (__DEV__) console.warn('Failed to store auth token:', error);
  }
};

export const getToken = () => authToken;

// Legacy function - now aliases setToken for backward compatibility (moved below setToken to avoid TDZ)
export const setAuthToken = async (t) => {
  console.warn('⚠️ setAuthToken is deprecated, use setToken instead');
  await setToken(t);
};

function withAuthHeaders(extra = {}) {
  const headers = { ...(extra.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return { ...extra, headers };
}

// Add request interceptor to include auth token
api.interceptors.request.use(
  async (config) => {
    // Ensure token is loaded before making any request
    await ready;
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
      console.log('✅ ApiService: Added Authorization header to request');
    } else {
      console.log('⚠️ ApiService: No token available for request to', config.url);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---- Generic HTTP helpers (used by Community screens) ----
export const get = async (url, config = {}) => {
  const { data } = await api.get(url, withAuthHeaders(config));
  return data;
};
export const post = async (url, body = {}, config = {}) => {
  const { data } = await api.post(url, body, withAuthHeaders(config));
  return data;
};
export const put = async (url, body = {}, config = {}) => {
  const { data } = await api.put(url, body, withAuthHeaders(config));
  return data;
};
export const del = async (url, config = {}) => {
  const { data } = await api.delete(url, withAuthHeaders(config));
  return data;
};

// Back-compat aliases (some code may call ApiService.delete)
export const _delete = del;

// ---- Multipart helper & dual-endpoint try/fallback ----
async function _postMultipart(url, form, cfg) {
  return api.post(url, form, {
    headers: { 'Content-Type': 'multipart/form-data', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
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
  if (!sessionId) return { ok: true };
  const doA = () => api.post(`/images/extract-session/${encodeURIComponent(sessionId)}/close`, {}, withAuthHeaders());
  const doB = () => api.post('/images/close-session', { imageId: sessionId }, withAuthHeaders());
  const { data } = await _try(doA, doB);
  return data;
};

export const extractColorsFromImage = async (imageUri, opts = {}) => {
  const form = new FormData();
  form.append('image', { uri: imageUri, name: 'upload.jpg', type: 'image/jpeg' });
  if (opts.maxWidth) form.append('maxWidth', String(opts.maxWidth));
  if (opts.maxHeight) form.append('maxHeight', String(opts.maxHeight));
  const { data } = await _postMultipart('/images/extract-colors', form);
  return data;
};

// ---- Colors endpoints ----
export const createColorMatch = async (body) => {
  const { data } = await api.post('/colors/matches', body, withAuthHeaders());
  return data;
};

export const getColorMatches = async (params = {}) => {
  // Filter out undefined/empty params to avoid sending them to server
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => value !== undefined && value !== '' && value !== null)
  );
  const queryString = new URLSearchParams(cleanParams).toString();
  const url = `/colors/matches${queryString ? `?${queryString}` : ''}`;
  const { data } = await api.get(url, withAuthHeaders());
  return data;
};

// App.js expects an array; provide a thin alias that unwraps { ok, data }
export const getUserColorMatches = async (params = {}) => {
  // Filter out undefined/empty params to avoid sending them to server
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => value !== undefined && value !== '' && value !== null)
  );
  const queryString = new URLSearchParams(cleanParams).toString();
  const url = `/colors/matches${queryString ? `?${queryString}` : ''}`;
  const { data } = await api.get(url, withAuthHeaders());
  return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
};

export const getColorMatch = async (id) => {
  const { data } = await api.get(`/colors/matches/${id}`, withAuthHeaders());
  return data;
};

export const updateColorMatch = async (id, body) => {
  const { data } = await api.put(`/colors/matches/${id}`, body, withAuthHeaders());
  return data;
};

export const deleteColorMatch = async (id) => {
  const { data } = await api.delete(`/colors/matches/${id}`, withAuthHeaders());
  return data;
};

export const validateHex = async (hex) => {
  const { data } = await api.post('/colors/validate', { hex }, withAuthHeaders());
  return data;
};

// ---- Community convenience (optional) ----
export const getCommunityFeed = async (cursor = null) => {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { data } = await api.get(`/community/posts/community${qs}`, withAuthHeaders());
  return data;
};

// ---- Feature health check ---- (removed duplicate, keeping better implementation below)

// ---- Authentication endpoints ----
export const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  if (data.token) {
    await setToken(data.token);
  }
  return data;
};

export const register = async (userData) => {
  const { data } = await api.post('/auth/register', userData);
  if (data.token) {
    await setToken(data.token);
  }
  return data;
};

export const demoLogin = async () => {
  const { data } = await api.post('/auth/demo-login');
  if (data.token) {
    await setToken(data.token);
  }
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

export const getUserProfile = async () => {
  const { data } = await api.get('/auth/profile', withAuthHeaders());
  return data;
};

// Missing function that's referenced in default export
export const updateUserProfile = async (profileData) => {
  const { data } = await api.put('/auth/profile', profileData, withAuthHeaders());
  return data;
};

export const clearToken = async () => {
  await setToken(null);
};

// Feature health check function
export const ping = async () => {
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
  // auth
  setToken, getToken, clearToken, login, register, demoLogin, getUserProfile, updateUserProfile,
  // image extraction
  extractColorsFromImage,
  // session-based image methods (fixed exports)
  startImageExtractSession, sampleColorAt, closeImageExtractSession,
  // legacy image methods (preserved)
  sampleImageColor,
  // colors
  createColorMatch, getColorMatches, getUserColorMatches, getColorMatch, updateColorMatch, deleteColorMatch, validateHex,
  // community
  getCommunityFeed,
  // health check
  ping,
};

// getUserColorMatches is now defined above with proper parameter support

export default ApiService;
