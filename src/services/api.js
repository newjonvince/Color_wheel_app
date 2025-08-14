// services/api.js — updated for session-based image extraction
// - Uses EXPO_PUBLIC_API_BASE_URL (falls back to API_BASE_URL), appends /api if missing
// - Adds session-based image extractor helpers
// - Correct payloads for backend endpoints

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const HOST = (process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '').replace(/\/+$/, '');
const API_ROOT = /\/api$/.test(HOST) ? HOST : `${HOST}/api`;
let _token = null;
export function setAuthToken(t){ _token = t; }
function auth(){ const h={Accept:'application/json'}; if(_token)h.Authorization=`Bearer ${_token}`; return h; }



export async function sampleColorAt(imageId, nx, ny, radius=0.02){
  const res = await fetch(`${API_ROOT}/images/sample-color`, {
    method:'POST',
    headers:{ ...auth(), 'Content-Type':'application/json' },
    body: JSON.stringify({ imageId, x:nx, y:ny, units:'norm', radius })
  });
  if(!res.ok) throw new Error(`sample-color ${res.status}`);
  return res.json(); // { hex }
}

export async function closeImageSession(imageId){
  try{
    await fetch(`${API_ROOT}/images/close-session`, {
      method:'POST', headers:{ ...auth(), 'Content-Type':'application/json' },
      body: JSON.stringify({ imageId })
    });
  } catch(_) {}
}

const api = axios.create({
  baseURL: API_ROOT,
  timeout: 20000,
});

const TOKEN_KEY = 'fashion_color_wheel_auth_token';
const LEGACY_TOKEN_KEY = 'authToken'; // App.js legacy key

let authToken = null;

// Initialize token from secure storage on app start - read both keys, prefer new one
const initializeToken = async () => {
  try {
    // Try new key first
    let storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!storedToken) {
      // Fallback to legacy key from App.js
      storedToken = await SecureStore.getItemAsync(LEGACY_TOKEN_KEY);
      if (storedToken) {
        // Migrate to new key
        await SecureStore.setItemAsync(TOKEN_KEY, storedToken);
        await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
      }
    }
    if (storedToken) {
      authToken = storedToken;
    }
  } catch (error) {
    if (__DEV__) console.warn('Failed to load stored auth token:', error);
  }
};

// Initialize token on module load
initializeToken();

export const setToken = async (t) => { 
  authToken = t; 
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

function withAuthHeaders(extra = {}) {
  const headers = { ...(extra.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return { ...extra, headers };
}

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
    () => _postMultipart('/api/images/extract-session', form, uploadCfg),
    () => _postMultipart('/api/images/extract-colors', form, uploadCfg),
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
  const doA = () => api.post('/api/images/extract-sample', bodyA, withAuthHeaders());

  const bodyB = { imageId: sessionToken, x: sx, y: sy, units: useNormalized ? 'normalized' : 'px' };
  const doB = () => api.post('/api/images/sample-color', bodyB, withAuthHeaders());

  const { data } = await _try(doA, doB);
  return data;
};

export const closeImageExtractSession = async (sessionId) => {
  if (!sessionId) return { ok: true };
  const doA = () => api.post(`/api/images/extract-session/${encodeURIComponent(sessionId)}/close`, {}, withAuthHeaders());
  const doB = () => api.post('/api/images/close-session', { imageId: sessionId }, withAuthHeaders());
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
  const queryString = new URLSearchParams(params).toString();
  const url = `/colors/matches${queryString ? `?${queryString}` : ''}`;
  const { data } = await api.get(url, withAuthHeaders());
  return data;
};

// App.js expects an array; provide a thin alias that unwraps { ok, data }
export const getUserColorMatches = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
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

// ---- Feature health check ----
export const ping = async () => {
  try {
    // Quick health check: test auth profile + colors endpoint
    const healthPromises = [
      api.get('/health', withAuthHeaders()).catch(() => ({ data: { status: 'offline' } })),
      api.get('/colors/validate', { hex: '#FF0000' }, withAuthHeaders()).catch(() => ({ data: { valid: false } }))
    ];
    
    const [healthResult] = await Promise.allSettled(healthPromises);
    return {
      online: healthResult.status === 'fulfilled' && healthResult.value?.data?.status !== 'offline',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { online: false, error: error.message, timestamp: new Date().toISOString() };
  }
};

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
  await setToken(null);
};

export const getUserProfile = async () => {
  const { data } = await api.get('/auth/profile', withAuthHeaders());
  return data;
};

export const clearToken = async () => {
  await setToken(null);
};

// ---- Export default object ----
const ApiService = {
  // env
  baseURL: API_ROOT, setToken, getToken, clearToken,
  // auth token management
  setAuthToken,
  // generic
  get, post, put, delete: del, _delete,
  // health
  ping,
  // auth
  login, register, demoLogin, logout, getUserProfile,
  // session-based image extraction (new)
  extractColorsFromImage, sampleColorAt, closeImageSession,
  // legacy image methods (preserved)
  startImageExtractSession, sampleImageColor, closeImageExtractSession,
  // colors
  createColorMatch, getColorMatches, getUserColorMatches, getColorMatch, updateColorMatch, deleteColorMatch, validateHex,
  // community
  getCommunityFeed,
};

// getUserColorMatches is now defined above with proper parameter support

export default ApiService;
