// services/api.js — fixed for community + extractor
// - Uses EXPO_PUBLIC_API_BASE_URL (falls back to API_BASE_URL), appends /api if missing
// - Adds generic http helpers: get/post/put/delete used by Community screens
// - Keeps session-based image extractor helpers
// - Correct payloads for legacy images endpoints

import axios from 'axios';
import * as ImageManipulator from 'expo-image-manipulator';

const base =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:3000';

export const API_BASE = base.endsWith('/api') ? base : `${base}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

let authToken = null;
export const setToken = (t) => { authToken = t; };
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
  
  // Normalize to JPEG to avoid HEIC/HEIF issues on backend
  const normalized = await ImageManipulator.manipulateAsync(
    imageUri,
    [],                                  // no transform, just re-encode
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );
  const normalizedUri = normalized.uri;
  
  const form = new FormData();
  form.append('image', { uri: normalizedUri, name: 'upload.jpg', type: 'image/jpeg' });
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
  // Normalize to JPEG to avoid HEIC/HEIF issues on backend
  const normalized = await ImageManipulator.manipulateAsync(
    imageUri,
    [],                                  // no transform, just re-encode
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );
  const normalizedUri = normalized.uri;
  
  const form = new FormData();
  form.append('image', { uri: normalizedUri, name: 'upload.jpg', type: 'image/jpeg' });
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

// ---- Export default object ----
const ApiService = {
  // env
  API_BASE, setToken, getToken,
  // generic
  get, post, put, delete: del, _delete,
  // images
  startImageExtractSession, sampleImageColor, closeImageExtractSession, extractColorsFromImage,
  // colors
  createColorMatch, validateHex,
  // community
  getCommunityFeed,
};

export default ApiService;

export const health = async () => {
  const { data } = await api.get('/health');
  return data;
};
