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

// ✅ EDGE CASE FIX: Comprehensive validation with all edge cases handled
export const validateHSL = (h, s, l) => {
  const parseComponent = (value, defaultValue = 0) => {
    // ✅ EDGE CASE FIX: Strict type checking first
    if (typeof value === 'number') {
      // Handle all number edge cases
      if (isNaN(value) || !isFinite(value) || value === Infinity || value === -Infinity) {
        return defaultValue;
      }
      return value;
    }
    
    // ✅ EDGE CASE FIX: Enhanced string validation
    if (typeof value === 'string') {
      const trimmed = value.trim();
      
      // Reject empty strings and whitespace-only strings
      if (trimmed === '' || trimmed.length === 0) {
        return defaultValue;
      }
      
      // ✅ EDGE CASE FIX: Reject scientific notation and invalid formats
      // More comprehensive regex to catch edge cases
      if (!/^-?\d*\.?\d+$/.test(trimmed) || 
          /[eE]/.test(trimmed) ||           // Reject scientific notation
          /[^\d\.\-]/.test(trimmed) ||      // Reject non-numeric characters
          trimmed === '.' ||                // Reject lone decimal point
          trimmed === '-' ||                // Reject lone minus sign
          trimmed === '-.' ||               // Reject minus with lone decimal
          /^-?\.?$/.test(trimmed)) {        // Reject incomplete numbers
        return defaultValue;
      }
      
      const parsed = parseFloat(trimmed);
      
      // ✅ EDGE CASE FIX: Comprehensive number validation after parsing
      if (isNaN(parsed) || !isFinite(parsed) || parsed === Infinity || parsed === -Infinity) {
        return defaultValue;
      }
      
      return parsed;
    }
    
    // ✅ EDGE CASE FIX: Reject all other types (arrays, objects, booleans, null, undefined)
    return defaultValue;
  };
  
  const hueValue = parseComponent(h, 0);
  const satValue = parseComponent(s, 0);
  const lightValue = parseComponent(l, 0);
  
  // ✅ EDGE CASE FIX: Safe modulo operation with validation
  const safeMod = (value, divisor) => {
    if (!isFinite(value) || !isFinite(divisor) || divisor === 0) {
      return 0;
    }
    return ((value % divisor) + divisor) % divisor;
  };
  
  return {
    h: safeMod(hueValue, 360),
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
