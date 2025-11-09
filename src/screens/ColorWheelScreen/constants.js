// screens/ColorWheelScreen/constants.js - Constants and utilities
export const SCHEMES = [
  'complementary',
  'analogous', 
  'split-complementary',
  'triadic',
  'tetradic',
  'monochromatic',
  'compound',
  'shades',
  'tints'
];

export const DEFAULT_COLOR = '#FF6B6B';
export const DEFAULT_SCHEME = 'complementary';

// HSL validation and utilities
export const mod = (a, n) => ((a % n) + n) % n;

export const validateHSL = (h, s, l) => ({
  h: mod(parseFloat(h) || 0, 360),
  s: Math.max(0, Math.min(100, parseFloat(s) || 0)),
  l: Math.max(0, Math.min(100, parseFloat(l) || 0)),
});

export const generateRandomColor = () => {
  const h = Math.floor(Math.random() * 360);
  const s = 60 + Math.floor(Math.random() * 40); // 60-100%
  const l = 45 + Math.floor(Math.random() * 10); // 45-55%
  return { h, s, l };
};

// Accessibility helpers
export const getAccessibilityLabel = (scheme) => {
  const labels = {
    complementary: 'Complementary color scheme with 2 opposite colors',
    analogous: 'Analogous color scheme with 3 adjacent colors',
    'split-complementary': 'Split complementary color scheme with 3 colors',
    triadic: 'Triadic color scheme with 3 evenly spaced colors',
    tetradic: 'Tetradic color scheme with 4 colors forming a rectangle',
    monochromatic: 'Monochromatic color scheme with variations of one color',
    compound: 'Compound color scheme with split-complementary and complementary colors',
    shades: 'Shades color scheme with darker variations of the base color',
    tints: 'Tints color scheme with lighter variations of the base color',
  };
  return labels[scheme] || 'Color scheme selector';
};

export const getSchemeDisplayName = (scheme) => {
  return scheme ? scheme[0].toUpperCase() + scheme.slice(1) : 'Scheme';
};
