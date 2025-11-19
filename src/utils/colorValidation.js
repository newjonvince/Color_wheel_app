// utils/colorValidation.js - Centralized color validation utilities
// Prevents duplicate validation logic and ensures consistency

/**
 * Regular expressions for color validation
 */
const COLOR_PATTERNS = {
  // Standard 6-digit hex color (#RRGGBB)
  HEX_6: /^#[0-9A-Fa-f]{6}$/,
  
  // 3-digit hex color (#RGB)
  HEX_3: /^#[0-9A-Fa-f]{3}$/,
  
  // Any valid hex color (3 or 6 digits)
  HEX_ANY: /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/,
  
  // RGB function format
  RGB: /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/,
  
  // RGBA function format
  RGBA: /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/,
  
  // HSL function format
  HSL: /^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/,
  
  // HSLA function format
  HSLA: /^hsla\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*(0|1|0?\.\d+)\s*\)$/,
};

/**
 * Validates if a string is a valid 6-digit hex color
 * @param {string} color - Color string to validate
 * @returns {boolean} - True if valid 6-digit hex color
 */
export const isValidHex6 = (color) => {
  return typeof color === 'string' && COLOR_PATTERNS.HEX_6.test(color);
};

/**
 * Validates if a string is a valid 3-digit hex color
 * @param {string} color - Color string to validate
 * @returns {boolean} - True if valid 3-digit hex color
 */
export const isValidHex3 = (color) => {
  return typeof color === 'string' && COLOR_PATTERNS.HEX_3.test(color);
};

/**
 * Validates if a string is a valid hex color (3 or 6 digits)
 * @param {string} color - Color string to validate
 * @returns {boolean} - True if valid hex color
 */
export const isValidHex = (color) => {
  return typeof color === 'string' && COLOR_PATTERNS.HEX_ANY.test(color);
};

/**
 * Validates if a string is a valid RGB color
 * @param {string} color - Color string to validate
 * @returns {boolean} - True if valid RGB color
 */
export const isValidRgb = (color) => {
  if (typeof color !== 'string') return false;
  
  const match = COLOR_PATTERNS.RGB.exec(color);
  if (!match) return false;
  
  // Check if RGB values are in valid range (0-255)
  const [, r, g, b] = match;
  return [r, g, b].every(val => {
    const num = parseInt(val, 10);
    return num >= 0 && num <= 255;
  });
};

/**
 * Validates if a string is a valid RGBA color
 * @param {string} color - Color string to validate
 * @returns {boolean} - True if valid RGBA color
 */
export const isValidRgba = (color) => {
  if (typeof color !== 'string') return false;
  
  const match = COLOR_PATTERNS.RGBA.exec(color);
  if (!match) return false;
  
  // Check if RGB values are in valid range (0-255) and alpha is 0-1
  const [, r, g, b, a] = match;
  const rgbValid = [r, g, b].every(val => {
    const num = parseInt(val, 10);
    return num >= 0 && num <= 255;
  });
  
  const alphaValid = parseFloat(a) >= 0 && parseFloat(a) <= 1;
  
  return rgbValid && alphaValid;
};

/**
 * Validates if a string is a valid HSL color
 * @param {string} color - Color string to validate
 * @returns {boolean} - True if valid HSL color
 */
export const isValidHsl = (color) => {
  if (typeof color !== 'string') return false;
  
  const match = COLOR_PATTERNS.HSL.exec(color);
  if (!match) return false;
  
  // Check if HSL values are in valid ranges
  const [, h, s, l] = match;
  const hue = parseInt(h, 10);
  const sat = parseInt(s, 10);
  const light = parseInt(l, 10);
  
  return hue >= 0 && hue <= 360 && 
         sat >= 0 && sat <= 100 && 
         light >= 0 && light <= 100;
};

/**
 * Validates if a string is any valid color format
 * @param {string} color - Color string to validate
 * @returns {boolean} - True if valid color in any supported format
 */
export const isValidColor = (color) => {
  return isValidHex(color) || 
         isValidRgb(color) || 
         isValidRgba(color) || 
         isValidHsl(color);
};

/**
 * Filters an array to only include valid hex colors
 * @param {Array} colors - Array of color strings
 * @param {boolean} requireHex6 - If true, only accept 6-digit hex colors
 * @returns {Array} - Array of valid hex colors
 */
export const filterValidHexColors = (colors, requireHex6 = true) => {
  if (!Array.isArray(colors)) return [];
  
  const validator = requireHex6 ? isValidHex6 : isValidHex;
  return colors.filter(validator);
};

/**
 * Validates and sanitizes a hex color
 * @param {string} color - Color string to validate
 * @param {string} fallback - Fallback color if invalid
 * @returns {string} - Valid hex color or fallback
 */
export const sanitizeHexColor = (color, fallback = '#000000') => {
  if (isValidHex6(color)) {
    return color.toUpperCase();
  }
  
  if (isValidHex3(color)) {
    // Convert 3-digit to 6-digit hex
    const hex = color.slice(1);
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
  }
  
  return fallback;
};

/**
 * Converts a 3-digit hex to 6-digit hex
 * @param {string} hex3 - 3-digit hex color
 * @returns {string} - 6-digit hex color
 */
export const expandHex3To6 = (hex3) => {
  if (!isValidHex3(hex3)) return hex3;
  
  const hex = hex3.slice(1);
  return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
};

/**
 * Gets the appropriate validation function for a color format
 * @param {string} format - Color format ('hex', 'hex6', 'hex3', 'rgb', 'rgba', 'hsl')
 * @returns {Function} - Validation function
 */
export const getColorValidator = (format) => {
  const validators = {
    hex: isValidHex,
    hex6: isValidHex6,
    hex3: isValidHex3,
    rgb: isValidRgb,
    rgba: isValidRgba,
    hsl: isValidHsl,
  };
  
  return validators[format] || isValidColor;
};

/**
 * Validation error messages
 */
export const COLOR_VALIDATION_ERRORS = {
  INVALID_HEX: 'Invalid hex color format. Expected #RRGGBB or #RGB',
  INVALID_HEX6: 'Invalid hex color format. Expected #RRGGBB',
  INVALID_HEX3: 'Invalid hex color format. Expected #RGB',
  INVALID_RGB: 'Invalid RGB color format. Expected rgb(r, g, b)',
  INVALID_RGBA: 'Invalid RGBA color format. Expected rgba(r, g, b, a)',
  INVALID_HSL: 'Invalid HSL color format. Expected hsl(h, s%, l%)',
  INVALID_COLOR: 'Invalid color format',
  NOT_STRING: 'Color must be a string',
};

/**
 * Validates color with detailed error information
 * @param {string} color - Color to validate
 * @param {string} format - Expected format
 * @returns {Object} - Validation result with error details
 */
export const validateColorWithError = (color, format = 'hex6') => {
  if (typeof color !== 'string') {
    return {
      isValid: false,
      error: COLOR_VALIDATION_ERRORS.NOT_STRING,
      sanitized: null,
    };
  }
  
  const validator = getColorValidator(format);
  const isValid = validator(color);
  
  if (isValid) {
    return {
      isValid: true,
      error: null,
      sanitized: format === 'hex6' ? sanitizeHexColor(color) : color,
    };
  }
  
  const errorKey = `INVALID_${format.toUpperCase()}`;
  return {
    isValid: false,
    error: COLOR_VALIDATION_ERRORS[errorKey] || COLOR_VALIDATION_ERRORS.INVALID_COLOR,
    sanitized: null,
  };
};

// Export patterns for advanced use cases
export { COLOR_PATTERNS };

export default {
  isValidHex6,
  isValidHex3,
  isValidHex,
  isValidRgb,
  isValidRgba,
  isValidHsl,
  isValidColor,
  filterValidHexColors,
  sanitizeHexColor,
  expandHex3To6,
  getColorValidator,
  validateColorWithError,
  COLOR_PATTERNS,
  COLOR_VALIDATION_ERRORS,
};
