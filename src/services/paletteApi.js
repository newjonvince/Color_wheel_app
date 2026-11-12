// services/paletteApi.js - Palettes, boards (folders of palettes) and the community feed.
import ApiService, { getApiRoot } from './safeApiService';

// Backend responses are { success, data, ... }; callers only want the data
const unwrap = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const authHeader = () => {
  const token = ApiService.getToken?.();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export const paletteApi = {
  // ----- boards -----
  listBoards: async () => unwrap(await ApiService.get('/boards')) || [],
  getBoard: async (boardId) => unwrap(await ApiService.get(`/boards/${boardId}`)),
  createBoard: async (name, description = '') => unwrap(await ApiService.post('/boards', { name, description })),
  updateBoard: async (boardId, changes) => unwrap(await ApiService.put(`/boards/${boardId}`, changes)),
  deleteBoard: async (boardId) => unwrap(await ApiService.delete(`/boards/${boardId}`)),
  addToBoard: async (boardId, paletteId) =>
    unwrap(await ApiService.post(`/boards/${boardId}/items`, { color_match_id: paletteId })),
  removeFromBoard: async (boardId, paletteId) =>
    unwrap(await ApiService.delete(`/boards/${boardId}/items/${paletteId}`)),

  // ----- palettes -----
  myPalettes: async () => unwrap(await ApiService.get('/colors/matches/user?limit=100')) || [],
  createPalette: async (palette) => unwrap(await ApiService.post('/colors/matches', palette)),
  updatePalette: async (paletteId, changes) => unwrap(await ApiService.put(`/colors/matches/${paletteId}`, changes)),
  deletePalette: async (paletteId) => unwrap(await ApiService.delete(`/colors/matches/${paletteId}`)),

  // Attach the photo a palette was picked from. fetch() sets the multipart boundary itself.
  // source 'web' marks a picture captured from the web: the server keeps that palette private.
  uploadImage: async (paletteId, uri, source = 'photo') => {
    const form = new FormData();
    form.append('source', source === 'web' ? 'web' : 'photo');
    form.append('image', { uri, name: 'palette.jpg', type: 'image/jpeg' });
    const res = await fetch(`${getApiRoot()}/colors/matches/${paletteId}/image`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...(authHeader() || {}) },
      body: form,
    });
    if (!res.ok) throw new Error(`Photo upload failed (${res.status})`);
    return unwrap(await res.json());
  },

  // <Image source> for a palette's photo; the header lets owners load private ones
  imageSource: (palette) => ({
    uri: `${getApiRoot()}/colors/matches/${palette.id}/image`,
    headers: authHeader(),
  }),

  // ----- community -----
  feed: async (offset = 0) => unwrap(await ApiService.get(`/community/feed?offset=${offset}`)),
  like: async (paletteId) => unwrap(await ApiService.post(`/likes/color-matches/${paletteId}`)),
  unlike: async (paletteId) => unwrap(await ApiService.delete(`/likes/color-matches/${paletteId}`)),
  report: async (paletteId, reason) =>
    unwrap(await ApiService.post('/community/reports', { color_match_id: paletteId, reason })),
  blockUser: async (userId) => unwrap(await ApiService.post(`/community/blocks/${userId}`)),
};

// Flip a palette's like locally; returns the updated copy for optimistic UI
export const withLikeToggled = (palette) => ({
  ...palette,
  is_liked: !palette.is_liked,
  like_count: Math.max(0, (palette.like_count || 0) + (palette.is_liked ? -1 : 1)),
});

export const sendLike = (palette) => (palette.is_liked ? paletteApi.unlike(palette.id) : paletteApi.like(palette.id));

export default paletteApi;
