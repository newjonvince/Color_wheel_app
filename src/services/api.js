// services/api.js — REDIRECTS TO SAFE API SERVICE
// This file now redirects all imports to the safer safeApiService.js
// The original api.js has been archived as api.legacy.js

// MIGRATION NOTICE:
// All API calls now use the crash-safe version with better error handling
// Original API service archived in api.legacy.js for reference

import safeApiService from './safeApiService';

// Export the safe API service as default
export default safeApiService;

// Export individual methods for backward compatibility
export const {
  ready,
  getToken,
  setToken,
  login,
  demoLogin,
  getUserProfile,
  getUserColorMatches,
  logout,
  updateSettings,
  deleteAccount,
  requestDataExport,
  // Color match methods
  createColorMatch,
  getColorMatches,
  getColorMatch,
  updateColorMatch,
  deleteColorMatch,
  validateHex,
  // Community methods
  likeColorMatch,
  unlikeColorMatch,
  getColorMatchLikes
} = safeApiService;
