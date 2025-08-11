// api.js (optimized)
//
// - Stable base URL + optional API prefix
// - Single axios instance
// - Token helpers
// - Better errors & logging
// - Image extraction upload with progress + friendlier fallbacks
//
// NOTE: Set these in your app config (.env / app.json):
//   EXPO_PUBLIC_API_BASE_URL="https://your-domain.onrender.com"
//   EXPO_PUBLIC_API_PREFIX="/api"   // optional; defaults to "/api"
//
import axios from 'axios';

// ---------- Base URL & axios -------------------------------------------------
const RAW_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const API_BASE_URL = RAW_BASE || 'https://colorwheelapp-production.up.railway.app';
const API_PREFIX = (process.env.EXPO_PUBLIC_API_PREFIX || '/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ---------- Token management -------------------------------------------------
let authToken = null;
export const setToken = (token) => {
  authToken = token || null;
  if (authToken) api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  else delete api.defaults.headers.common['Authorization'];
};
export const getToken = () => authToken;
export const clearToken = () => setToken(null);

// ---------- Interceptors -----------------------------------------------------
api.interceptors.request.use(
  (config) => {
    const method = (config.method || 'get').toUpperCase();
    console.log(`📤 ${method} ${config.baseURL}${config.url}`);
    return config;
  },
  (err) => {
    console.error('❌ Request setup error:', err?.message);
    return Promise.reject(err);
  }
);

api.interceptors.response.use(
  (res) => {
    console.log('✅', res.status, res.config?.url);
    return res;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      console.error('❌ API error:', status, data);
    } else if (error.request) {
      console.error('❌ No response from API (network/timeout)');
    } else {
      console.error('❌ Client error:', error.message);
    }
    return Promise.reject(error);
  }
);

// ---------- Auth -------------------------------------------------------------
export const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

export const register = async (user) => {
  const { data } = await api.post('/auth/register', user);
  return data;
};

export const demoLogin = async () => {
  const { data } = await api.post('/auth/demo-login');
  return data;
};

// ---------- User -------------------------------------------------------------
export const getUserProfile = async () => {
  const { data } = await api.get('/users/profile');
  return data;
};

export const updateUserProfile = async (profileData) => {
  const { data } = await api.put('/users/profile', profileData);
  return data;
};

// ---------- Colors (align with /colors router in backend) --------------------
// GET /colors?privacy=&scheme=&limit=&offset=
export const getUserColorMatches = async (params = {}) => {
  const { data } = await api.get('/colors', { params });
  return data;
};

// POST /colors  { base_color, scheme, colors, privacy?, is_locked?, locked_color? }
export const createColorMatch = async (payload) => {
  const { data } = await api.post('/colors', payload);
  return data;
};

// GET /colors/public?scheme=&limit=&offset=
export const getPublicColorMatches = async (params = {}) => {
  const { data } = await api.get('/colors/public', { params });
  return data;
};

// PUT /colors/:id { privacy }
export const updateColorMatch = async (id, payload) => {
  const { data } = await api.put(`/colors/${id}`, payload);
  return data;
};

// DELETE /colors/:id
export const deleteColorMatch = async (id) => {
  const { data } = await api.delete(`/colors/${id}`);
  return data;
};

// POST /colors/:id/like  (toggle handler exists server-side; if you split, also create DELETE)
export const toggleLikeColorMatch = async (id) => {
  const { data } = await api.post(`/colors/${id}/like`);
  return data;
};

// ---------- Community --------------------------------------------------------
export const getCommunityPosts = async (cursor = null) => {
  const params = cursor ? { cursor } : {};
  const { data } = await api.get('/community/posts', { params });
  return data;
};

export const followUser = async (userId) => {
  const { data } = await api.post(`/community/users/${userId}/follow`);
  return data;
};
export const unfollowUser = async (userId) => {
  const { data } = await api.delete(`/community/users/${userId}/follow`);
  return data;
};

export const likePost = async (postId) => {
  const { data } = await api.post(`/community/posts/${postId}/like`);
  return data;
};
export const unlikePost = async (postId) => {
  const { data } = await api.delete(`/community/posts/${postId}/like`);
  return data;
};

// ---------- Images: Server-side color extraction ----------------------------
/**
 * Upload an image for palette extraction.
 * @param {string} imageUri - local file:// or asset uri
 * @param {Object} [opts]
 * @param {string} [opts.mime='image/jpeg']
 * @param {string} [opts.fileName='upload.jpg']
 * @param {(progress: number)=>void} [opts.onProgress]
 * @returns {Promise<{ dominant: string, palette: string[] }>}
 */
export const extractColorsFromImage = async (imageUri, opts = {}) => {
  if (!imageUri) throw new Error('imageUri is required');

  const {
    mime = 'image/jpeg',
    fileName = 'upload.jpg',
    onProgress,
  } = opts;

  const form = new FormData();
  form.append('image', { uri: imageUri, name: fileName, type: mime });

  const headers = { 'Content-Type': 'multipart/form-data' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  try {
    const { data } = await api.post('/images/extract-colors', form, {
      headers,
      onUploadProgress: (evt) => {
        if (!onProgress || !evt.total) return;
        const pct = Math.round((evt.loaded / evt.total) * 100);
        onProgress(pct);
      },
    });
    // Expect: { dominant, palette }
    if (!data || !Array.isArray(data.palette)) {
      throw new Error('Unexpected response from extractor');
    }
    return data;
  } catch (err) {
    // Friendly messages for common cases
    const status = err?.response?.status;
    if (status === 413) {
      err.message = 'Image is too large (413). Try a smaller image or lower quality.';
    } else if (status === 415) {
      err.message = 'Unsupported media type (415). Please upload JPG/PNG.';
    } else if (err.code === 'ECONNABORTED') {
      err.message = 'Upload timed out. Check your connection and try again.';
    }
    throw err;
  }
};

// ---------- Generic helpers -------------------------------------------------
export const ping = async () => {
  try {
    const { data } = await api.get('/health');
    return data;
  } catch (e) {
    return { ok: false, error: e?.message || 'unknown' };
  }
};

// ---------- Default export (service object) ---------------------------------
const ApiService = {
  // token
  setToken, getToken, clearToken,
  // auth
  login, register, demoLogin,
  // user
  getUserProfile, updateUserProfile,
  // colors
  getUserColorMatches, getPublicColorMatches, createColorMatch, updateColorMatch, deleteColorMatch, toggleLikeColorMatch,
  // community
  getCommunityPosts, followUser, unfollowUser, likePost, unlikePost,
  // images
  extractColorsFromImage,
  // misc
  ping,
  // raw axios shortcuts
  get: (url, config) => api.get(url, config),
  post: (url, data, config) => api.post(url, data, config),
  put: (url, data, config) => api.put(url, data, config),
  delete: (url, config) => api.delete(url, config),
  patch: (url, data, config) => api.patch(url, data, config),
};

export default ApiService;
