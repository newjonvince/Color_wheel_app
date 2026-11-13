// services/paletteApi.js - Palettes, boards (folders of palettes) and the community feed.
import ApiService, { getApiRoot } from './safeApiService';

// Backend responses are { success, data, ... }; callers only want the data
const unwrap = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const authHeader = () => {
  const token = ApiService.getToken?.();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

// ASCII-only text to bytes (the multipart headers below contain nothing else)
const utf8 = (text) => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
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

  // Attach the photo a palette was picked from.
  // source 'web' marks a picture captured from the web: the server keeps that palette private.
  //
  // The multipart body is built by hand from the file's bytes. Expo's fetch (the global fetch in
  // this SDK) rejects React Native's { uri, name, type } FormData parts with
  // "Unsupported FormDataPart implementation", so every upload failed before reaching the server.
  uploadImage: async (paletteId, uri, source = 'photo') => {
    const { File } = require('expo-file-system');
    const bytes = await new File(uri).bytes();
    if (!bytes || bytes.length === 0) throw new Error('The picture file is empty');

    const boundary = `----PaletteUpload${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const head = utf8(
      `--${boundary}\r\nContent-Disposition: form-data; name="source"\r\n\r\n${source === 'web' ? 'web' : 'photo'}\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="palette.jpg"\r\n` +
      'Content-Type: image/jpeg\r\n\r\n'
    );
    const tail = utf8(`\r\n--${boundary}--\r\n`);
    const body = new Uint8Array(head.length + bytes.length + tail.length);
    body.set(head, 0);
    body.set(bytes, head.length);
    body.set(tail, head.length + bytes.length);

    const res = await fetch(`${getApiRoot()}/colors/matches/${paletteId}/image`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        ...(authHeader() || {}),
      },
      body,
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
