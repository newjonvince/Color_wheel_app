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
  // Parse and validate hue - reject scientific notation and invalid strings
  let hueValue = 0;
  if (typeof h === 'string' && h.trim() !== '') {
    // Reject scientific notation (contains 'e' or 'E')
    if (!/^-?\d*\.?\d+$/.test(h.trim())) {
      hueValue = 0;
    } else {
      hueValue = parseFloat(h);
      if (isNaN(hueValue)) {
        hueValue = 0;
      }
    }
  } else if (typeof h === 'number') {
    hueValue = isNaN(h) ? 0 : h;
  }
  
  // Parse and validate saturation
  let satValue = 0;
  if (typeof s === 'string' && s.trim() !== '') {
    if (!/^-?\d*\.?\d+$/.test(s.trim())) {
      satValue = 0;
    } else {
      satValue = parseFloat(s);
      if (isNaN(satValue)) {
        satValue = 0;
      }
    }
  } else if (typeof s === 'number') {
    satValue = isNaN(s) ? 0 : s;
  }
  
  // Parse and validate lightness
  let lightValue = 0;
  if (typeof l === 'string' && l.trim() !== '') {
    if (!/^-?\d*\.?\d+$/.test(l.trim())) {
      lightValue = 0;
    } else {
      lightValue = parseFloat(l);
      if (isNaN(lightValue)) {
        lightValue = 0;
      }
    }
  } else if (typeof l === 'number') {
    lightValue = isNaN(l) ? 0 : l;
  }
  
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
