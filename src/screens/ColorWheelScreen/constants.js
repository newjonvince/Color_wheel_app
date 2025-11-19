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

// ✅ SAFER: Enhanced validation with stricter checks
export const validateHSL = (h, s, l) => {
  const parseComponent = (value, defaultValue = 0) => {
    if (typeof value === 'number') {
      return isNaN(value) || !isFinite(value) ? defaultValue : value; // ✅ Reject Infinity
    }
    
    if (typeof value === 'string' && value.trim() !== '') {
      // Reject scientific notation
      if (!/^-?\d*\.?\d+$/.test(value.trim())) {
        return defaultValue;
      }
      
      const parsed = parseFloat(value);
      if (isNaN(parsed) || !isFinite(parsed)) { // ✅ Reject Infinity/NaN
        return defaultValue;
      }
      return parsed;
    }
    
    return defaultValue;
  };
  
  const hueValue = parseComponent(h, 0);
  const satValue = parseComponent(s, 0);
  const lightValue = parseComponent(l, 0);
  
  return {
    h: mod(hueValue, 360),
    s: Math.max(0, Math.min(100, satValue)),
    l: Math.max(0, Math.min(100, lightValue)),
  };
};

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
