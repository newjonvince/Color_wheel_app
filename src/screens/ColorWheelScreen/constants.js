// screens/ColorWheelScreen/constants.js - Constants and utilities
// Scheme list and display helpers are derived from the single source of truth.
import {
  SCHEME_KEYS,
  getSchemeDisplayName as _getSchemeDisplayName,
  getAccessibilityLabel as _getAccessibilityLabel,
} from '../../constants/colorSchemes';

export const SCHEMES = SCHEME_KEYS;

export const DEFAULT_COLOR = '#FF6B6B';
export const DEFAULT_SCHEME = 'complementary';

// HSL validation and utilities
export const mod = (a, n) => ((a % n) + n) % n;

// EDGE CASE FIX: Comprehensive validation with all edge cases handled
export const validateHSL = (h, s, l) => {
  const parseComponent = (value, defaultValue = 0) => {
    // EDGE CASE FIX: Strict type checking first
    if (typeof value === 'number') {
      // Handle all number edge cases
      if (isNaN(value) || !isFinite(value) || value === Infinity || value === -Infinity) {
        return defaultValue;
      }
      return value;
    }
    
    // EDGE CASE FIX: Enhanced string validation
    if (typeof value === 'string') {
      const trimmed = value.trim();
      
      // Reject empty strings and whitespace-only strings
      if (trimmed === '' || trimmed.length === 0) {
        return defaultValue;
      }
      
      // Rejects anything that isn't an optional minus, optional digits, optional dot, required digits.
      // This single check covers scientific notation, non-numeric chars, lone dots/dashes, etc.
      if (!/^-?\d*\.?\d+$/.test(trimmed)) {
        return defaultValue;
      }
      
      const parsed = parseFloat(trimmed);
      
      // EDGE CASE FIX: Comprehensive number validation after parsing
      if (isNaN(parsed) || !isFinite(parsed) || parsed === Infinity || parsed === -Infinity) {
        return defaultValue;
      }
      
      return parsed;
    }
    
    // EDGE CASE FIX: Reject all other types (arrays, objects, booleans, null, undefined)
    return defaultValue;
  };
  
  const hueValue = parseComponent(h, 0);
  const satValue = parseComponent(s, 0);
  const lightValue = parseComponent(l, 0);
  
  // EDGE CASE FIX: Safe modulo operation with validation
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

export const getAccessibilityLabel = _getAccessibilityLabel;
export const getSchemeDisplayName = _getSchemeDisplayName;
