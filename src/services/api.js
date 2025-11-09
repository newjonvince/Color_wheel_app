// services/api.js — REDIRECTS TO SAFE API SERVICE
// This file now redirects all imports to the safer safeApiService.js
// The original api.js has been archived as api.legacy.js

// MIGRATION NOTICE:
// All API calls now use the crash-safe version with better error handling
// Original API service archived in api.legacy.js for reference

import safeApiService from './safeApiService';

// Export the safe API service as default
export default safeApiService;

// Export individual methods for backward compatibility if needed
// Note: Some legacy methods may not be available in the safe API
// Check safeApiService.js for available methods
