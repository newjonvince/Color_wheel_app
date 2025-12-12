// constants/colorSchemes.js - Centralized color scheme definitions

/**
 * Color scheme definitions with display names and descriptions
 */
export const COLOR_SCHEMES = {
  complementary: {
    key: 'complementary',
    name: 'Complementary',
    description: 'Colors opposite on the color wheel',
    colorCount: 2,
  },
  analogous: {
    key: 'analogous',
    name: 'Analogous',
    description: 'Colors adjacent on the color wheel',
    colorCount: 3,
  },
  'split-complementary': {
    key: 'split-complementary',
    name: 'Split Complementary',
    description: 'Base color plus two colors adjacent to its complement',
    colorCount: 3,
  },
  triadic: {
    key: 'triadic',
    name: 'Triadic',
    description: 'Three colors evenly spaced on the color wheel',
    colorCount: 3,
  },
  tetradic: {
    key: 'tetradic',
    name: 'Tetradic',
    description: 'Four colors forming a rectangle on the color wheel',
    colorCount: 4,
  },
  monochromatic: {
    key: 'monochromatic',
    name: 'Monochromatic',
    description: 'Variations of a single hue',
    colorCount: 5,
  },
  compound: {
    key: 'compound',
    name: 'Compound',
    description: 'Combination of complementary and analogous',
    colorCount: 4,
  },
  shades: {
    key: 'shades',
    name: 'Shades',
    description: 'Darker variations of a color',
    colorCount: 5,
  },
  tints: {
    key: 'tints',
    name: 'Tints',
    description: 'Lighter variations of a color',
    colorCount: 5,
  },
};

/**
 * Get all available color schemes as an array
 * @returns {Array<{key: string, name: string, description: string, colorCount: number}>}
 */
export const getAllSchemes = () => {
  return Object.values(COLOR_SCHEMES);
};

/**
 * Get a specific scheme by key
 * @param {string} key - The scheme key
 * @returns {Object|null} The scheme object or null if not found
 */
export const getSchemeByKey = (key) => {
  return COLOR_SCHEMES[key] || null;
};

/**
 * Get scheme display name
 * @param {string} key - The scheme key
 * @returns {string} The display name or the key if not found
 */
export const getSchemeDisplayName = (key) => {
  const scheme = COLOR_SCHEMES[key];
  return scheme?.name || key;
};

/**
 * List of scheme keys for iteration
 */
export const SCHEME_KEYS = Object.keys(COLOR_SCHEMES);

export default {
  COLOR_SCHEMES,
  getAllSchemes,
  getSchemeByKey,
  getSchemeDisplayName,
  SCHEME_KEYS,
};
