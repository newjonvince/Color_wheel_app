// components/palettes/theme.js - Shared look for Boards, Community and the Guide
export const ui = {
  bg: '#F6F7F9',
  card: '#FFFFFF',
  text: '#1F2328',
  muted: '#6B7280',
  faint: '#9CA3AF',
  line: '#E5E7EB',
  pill: '#F3F4F6',
  primary: '#1F2328',
  accent: '#E74C3C',
  danger: '#DC2626',
  radius: 18,
  gutter: 12,
};

// Black or white, whichever reads on the given hex
export const inkFor = (hex) => {
  const n = parseInt(String(hex || '#888888').slice(1), 16) || 0;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#111827' : '#FFFFFF';
};

// 'custom' covers both photo palettes and palettes built by hand on the unlocked wheel
export const schemeLabel = (scheme, hasImage = false) => {
  if (!scheme || scheme === 'custom') return hasImage ? 'From a photo' : 'Custom';
  return scheme.charAt(0).toUpperCase() + scheme.slice(1);
};
