
// src/services/api.js
// Unified API client + image extraction session helpers
// Works with Railway-hosted backend. One-time upload -> token -> coordinate samples flow.

import axios from 'axios';

/** -----------------------------------------------------------------------
 * Base configuration
 * --------------------------------------------------------------------- */
const RAW_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const API_BASE_URL = RAW_BASE || 'https://colorwheelapp-production.up.railway.app';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// Attach token (JWT) if available
let authToken = null;
export const setToken = (token) => {
  authToken = token || null;
  if (authToken) api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  else delete api.defaults.headers.common['Authorization'];
};
export const clearToken = () => setToken(null);
export const getToken = () => authToken;

/** -----------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------- */
const withAuthHeaders = (extra = {}) => {
  const headers = { ...(extra || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return { headers };
};

const isFormData = (v) => typeof FormData !== 'undefined' && v instanceof FormData;

/** -----------------------------------------------------------------------
 * Colors (server-backed utilities)
 * Endpoints expected on backend: POST /colors/validate, POST /colors/scheme, POST /colors/blend
 * Palettes persistence: POST /colors, GET /colors/matches
 * --------------------------------------------------------------------- */
// Validates HEX format on backend (POST /colors/validate)
export const validateHex = async (hex) => {
  const { data } = await api.post('/colors/validate', { hex });
  return data; // { ok, hex, valid }
};

// Generates a scheme from baseColor + scheme type (POST /colors/scheme)
export const generateScheme = async (baseColor, scheme = 'analogous') => {
  const { data } = await api.post('/colors/scheme', { baseColor, scheme });
  return data; // { ok, baseHex, scheme, hues:[deg...], colors:[hex...] }
};

export const blend = async (color1, color2, weight = 0.5) => {
  const { data } = await api.post('/colors/blend', { color1, color2, weight });
  return data;
};

// Creates a new palette (POST /colors/matches)
// Requires authentication token set via setToken()
export const createColorMatch = async ({ base_color, scheme, colors, title, description, is_public }) => {
  const body = { base_color, scheme, colors, title, description, is_public };
  const { data } = await api.post('/colors/matches', body);
  return data; // { success, data: {...} }
};

export const listPalettes = async (params = {}) => {
  const { data } = await api.get('/colors/matches', { params });
  return data; // { ok, count, data }
};

/** -----------------------------------------------------------------------
 * Image extraction (two modes)
 *
 * A) Legacy single-call:
 *    POST /images/extract-colors (multipart: image)
 *    -> { dominant, palette }
 *
 * B) Session-based (recommended):
 *    1) POST /images/extract-session (multipart: image)
 *       -> { sessionId, token, width, height, dominant, palette }
 *    2) POST /images/extract-sample { sessionToken, x, y, normalized? }
 *       -> { hex, rgb, hsl, nearest?, updatedPalette? }
 *    3) POST /images/extract-session/:id/close  (optional)
 *       -> { ok: true }
 * --------------------------------------------------------------------- */

// A) One-off upload (kept for compatibility)
export const extractColorsFromImage = async (imageUri, { mime = 'image/jpeg', fileName = 'upload.jpg', onProgress } = {}) => {
  if (!imageUri) throw new Error('imageUri is required');
  const form = new FormData();
  form.append('image', { uri: imageUri, name: fileName, type: mime });

  const { data } = await api.post('/images/extract-colors', form, {
    headers: { 'Content-Type': 'multipart/form-data', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return data; // { dominant, palette }
};

// B-1) Start a session (one-time upload)
export const startImageExtractSession = async (imageUri, {
  mime = 'image/jpeg',
  fileName = 'upload.jpg',
  maxWidth = 900,
  maxHeight = 900,
  onProgress,
} = {}) => {
  if (!imageUri) throw new Error('imageUri is required');
  const form = new FormData();
  form.append('image', { uri: imageUri, name: fileName, type: mime });
  form.append('maxWidth', String(maxWidth));
  form.append('maxHeight', String(maxHeight));

  try {
    // Try new endpoint first
    const { data } = await api.post('/images/extract-session', form, {
      headers: { 'Content-Type': 'multipart/form-data', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
      },
    });
    return data;
  } catch (error) {
    // Fallback to backend endpoint
    const { data } = await api.post('/images/extract-colors', form, {
      headers: { 'Content-Type': 'multipart/form-data', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
      },
    });
    // Normalize response to expected format
    return {
      sessionId: data.sessionId || data.token,
      token: data.token || data.sessionId,
      width: data.width,
      height: data.height,
      dominant: data.dominant,
      palette: data.palette
    };
  }
};

// B-2) Sample a color at coordinates (accepts absolute or normalized)
export const sampleImageColor = async (sessionToken, {
  x = null, y = null, // absolute px in the server-sized image
  nx = null, ny = null, // normalized 0..1 (if given, server converts)
} = {}) => {
  if (!sessionToken) throw new Error('sessionToken is required');
  const body = { sessionToken };
  if (nx != null && ny != null) {
    body.normalized = true;
    body.x = nx;
    body.y = ny;
  } else if (x != null && y != null) {
    body.normalized = false;
    body.x = x;
    body.y = y;
  } else {
    throw new Error('Provide either {x,y} or normalized {nx,ny}');
  }

  try {
    // Try new endpoint first
    const { data } = await api.post('/images/extract-sample', body, withAuthHeaders());
    return data;
  } catch (error) {
    // Fallback to backend endpoint with normalized coordinates
    const { data } = await api.post('/images/sample-color', body, withAuthHeaders());
    return data;
  }
};

// B-3) Close a session (cleanup)
export const closeImageExtractSession = async (sessionId) => {
  if (!sessionId) return { ok: true };
  try {
    // Try new endpoint first
    const { data } = await api.post(`/images/extract-session/${encodeURIComponent(sessionId)}/close`, {}, withAuthHeaders());
    return data;
  } catch (error) {
    // Fallback to backend endpoint
    const { data } = await api.post('/images/close-session', { sessionId }, withAuthHeaders());
    return data;
  }
};

/** -----------------------------------------------------------------------
 * Auth / Users
 * --------------------------------------------------------------------- */
export const login = async (email, password) => (await api.post('/auth/login', { email, password })).data;
export const register = async (user) => (await api.post('/auth/register', user)).data;
export const getUserProfile = async () => (await api.get('/users/profile')).data;

/** -----------------------------------------------------------------------
 * Community API Methods
 * --------------------------------------------------------------------- */
export const getCommunityPosts = async (cursor, limit = 20) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  params.append('limit', limit.toString());
  const { data } = await api.get(`/community/posts/community?${params}`, withAuthHeaders());
  return data;
};

export const getSuggestedUsers = async (limit = 20, offset = 0) => {
  const { data } = await api.get(`/community/users/suggested?limit=${limit}&offset=${offset}`, withAuthHeaders());
  return data;
};

export const getFollowing = async (limit = 20, offset = 0) => {
  const { data } = await api.get(`/community/users/following?limit=${limit}&offset=${offset}`, withAuthHeaders());
  return data;
};

export const getFollowers = async (limit = 20, offset = 0) => {
  const { data } = await api.get(`/community/users/followers?limit=${limit}&offset=${offset}`, withAuthHeaders());
  return data;
};

export const followUser = async (userId) => {
  const { data } = await api.post(`/community/users/${userId}/follow`, {}, withAuthHeaders());
  return data;
};

export const unfollowUser = async (userId) => {
  const { data } = await api.delete(`/community/users/${userId}/follow`, withAuthHeaders());
  return data;
};

export const likePost = async (postId) => {
  const { data } = await api.post(`/community/posts/${postId}/like`, {}, withAuthHeaders());
  return data;
};

export const unlikePost = async (postId) => {
  const { data } = await api.delete(`/community/posts/${postId}/like`, withAuthHeaders());
  return data;
};

/** -----------------------------------------------------------------------
 * Low-level passthrough
 * --------------------------------------------------------------------- */
const ApiService = {
  // tokens
  setToken, clearToken, getToken,
  // colors
  validateHex, generateScheme, blend,
  createColorMatch, listPalettes,
  // images
  extractColorsFromImage,
  startImageExtractSession, sampleImageColor, closeImageExtractSession,
  // auth
  login, register, getUserProfile,
  // community
  getCommunityPosts, getSuggestedUsers, getFollowing, getFollowers,
  followUser, unfollowUser, likePost, unlikePost,
  // generic
  get: (url, cfg) => api.get(url, cfg),
  post: (url, body, cfg) => api.post(url, body, !isFormData(body) ? cfg : { ...(cfg||{}), headers: { ...(cfg?.headers||{}), 'Content-Type': 'multipart/form-data' } }),
  put: (url, body, cfg) => api.put(url, body, cfg),
  delete: (url, cfg) => api.delete(url, cfg),
};

export default ApiService;
