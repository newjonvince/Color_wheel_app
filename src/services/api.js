// services/api.js — fixed & compatible
// - Supports both new session endpoints and legacy ones
// - Correct payloads for /images/sample-color and /images/close-session
// - Provides color match + validate helpers

import axios from 'axios';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api';

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

// ---- Compat helpers for images endpoints (support both server styles) ----
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

// ---------------- Images: session-based extractor ----------------
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

export const createColorMatch = async (body) => {
  const { data } = await api.post('/colors/matches', body, withAuthHeaders());
  return data;
};

export const validateHex = async (hex) => {
  const { data } = await api.post('/colors/validate', { hex }, withAuthHeaders());
  return data;
};

export const getCommunityFeed = async () => {
  const { data } = await api.get('/community/posts/community', withAuthHeaders());
  return data;
};

const ApiService = {
  setToken, getToken,
  startImageExtractSession, sampleImageColor, closeImageExtractSession, extractColorsFromImage,
  createColorMatch, validateHex, getCommunityFeed,
};

export default ApiService;
