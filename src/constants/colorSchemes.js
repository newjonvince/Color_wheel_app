// constants/colorSchemes.js - Centralized color scheme definitions
// Single source of truth for all color scheme configurations

/**
 * Complete color scheme definitions with all properties
 * This replaces scattered definitions across components and utils
 */
export const COLOR_SCHEME_DEFINITIONS = {
  complementary: {
    name: 'Complementary',
    description: 'Colors opposite on the color wheel',
    count: 2,
    offsets: [0, 180],
    generator: (h, s, l, baseColor) => [
      baseColor,
      hslToHex((h + 180) % 360, s, l)
    ]
  },

  analogous: {
    name: 'Analogous',
    description: 'Adjacent colors on the color wheel',
    count: 3,
    offsets: [0, 30, -30],
    generator: (h, s, l, baseColor) => [
      baseColor,
      hslToHex((h + 30) % 360, s, l),
      hslToHex((h - 30 + 360) % 360, s, l)
    ]
  },

  'split-complementary': {
    name: 'Split Complementary',
    description: 'Base color plus two colors adjacent to its complement',
    count: 3,
    offsets: [0, 150, -150],
    generator: (h, s, l, baseColor) => [
      baseColor,
      hslToHex((h + 150) % 360, s, l),
      hslToHex((h + 210) % 360, s, l)
    ]
  },

  triadic: {
    name: 'Triadic',
    description: 'Three evenly spaced colors on the color wheel',
    count: 3,
    offsets: [0, 120, 240],
    generator: (h, s, l, baseColor) => [
      baseColor,
      hslToHex((h + 120) % 360, s, l),
      hslToHex((h + 240) % 360, s, l)
    ]
  },

  tetradic: {
    name: 'Tetradic',
    description: 'Four evenly spaced colors forming a square',
    count: 4,
    offsets: [0, 90, 180, 270],
    generator: (h, s, l, baseColor) => [
      baseColor,
      hslToHex((h + 90) % 360, s, l),
      hslToHex((h + 180) % 360, s, l),
      hslToHex((h + 270) % 360, s, l)
    ]
  },

  monochromatic: {
    name: 'Monochromatic',
    description: 'Variations in lightness and saturation of a single hue',
    count: 5,
    offsets: [0, 0, 0, 0, 0], // Same hue, different lightness/saturation
    lightnessOffsets: [-30, -15, 0, 15, 30], // Lightness variations
    saturationOffsets: [-10, -5, 0, 5, 10], // Subtle saturation variations
    generator: (h, s, l, baseColor) => [
      hslToHex(h, Math.max(10, s - 10), Math.max(10, l - 30)),
      hslToHex(h, Math.max(10, s - 5), Math.max(10, l - 15)),
      baseColor,
      hslToHex(h, Math.min(90, s + 5), Math.min(90, l + 15)),
      hslToHex(h, Math.min(90, s + 10), Math.min(90, l + 30))
    ]
  },

  compound: {
    name: 'Compound',
    description: 'Split-complementary with complementary accent',
    count: 4,
    offsets: [0, 150, 180, 210],
    generator: (h, s, l, baseColor) => [
      baseColor,
      hslToHex((h + 150) % 360, s, l),
      hslToHex((h + 180) % 360, s, l),
      hslToHex((h + 210) % 360, s, l)
    ]
  },

  shades: {
    name: 'Shades',
    description: 'Darker variations by reducing lightness',
    count: 5,
    offsets: [0, 0, 0, 0, 0], // Same hue, decreasing lightness
    lightnessOffsets: [-40, -25, 0, -10, -5], // Progressive darkening
    saturationOffsets: [5, 3, 0, 1, 0], // Slight saturation boost for darker shades
    generator: (h, s, l, baseColor) => [
      hslToHex(h, Math.min(100, s + 5), Math.max(5, l - 40)),
      hslToHex(h, Math.min(100, s + 3), Math.max(10, l - 25)),
      baseColor,
      hslToHex(h, Math.min(100, s + 1), Math.max(15, l - 10)),
      hslToHex(h, s, Math.max(20, l - 5))
    ]
  },

  tints: {
    name: 'Tints',
    description: 'Lighter variations by increasing lightness',
    count: 5,
    offsets: [0, 0, 0, 0, 0], // Same hue, increasing lightness
    lightnessOffsets: [40, 25, 0, 10, 5], // Progressive lightening
    saturationOffsets: [-15, -10, 0, -5, -2], // Reduce saturation for lighter tints
    generator: (h, s, l, baseColor) => [
      hslToHex(h, Math.max(10, s - 15), Math.min(95, l + 40)),
      hslToHex(h, Math.max(10, s - 10), Math.min(90, l + 25)),
      baseColor,
      hslToHex(h, Math.max(10, s - 5), Math.min(85, l + 10)),
      hslToHex(h, Math.max(10, s - 2), Math.min(80, l + 5))
    ]
  }
};

// Helper function to convert HSL to Hex (duplicated to avoid circular imports)
const hslToHex = (h, s, l) => {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * Derived constants for backward compatibility and convenience
 */
export const SCHEMES = Object.keys(COLOR_SCHEME_DEFINITIONS);

export const SCHEME_NAMES = Object.fromEntries(
  Object.entries(COLOR_SCHEME_DEFINITIONS).map(([key, def]) => [key, def.name])
);

export const SCHEME_DESCRIPTIONS = Object.fromEntries(
  Object.entries(COLOR_SCHEME_DEFINITIONS).map(([key, def]) => [key, def.description])
);

export const SCHEME_COUNTS = Object.fromEntries(
  Object.entries(COLOR_SCHEME_DEFINITIONS).map(([key, def]) => [key, def.count])
);

export const SCHEME_OFFSETS = Object.fromEntries(
  Object.entries(COLOR_SCHEME_DEFINITIONS).map(([key, def]) => [key, def.offsets])
);

/**
 * Generate colors for any scheme using centralized definitions
 * This replaces the getColorScheme function in utils/color.js
 */
export const generateColorScheme = (baseColor, scheme) => {
  const definition = COLOR_SCHEME_DEFINITIONS[scheme];
  
  if (!definition) {
    console.warn(`Unknown color scheme: ${scheme}`);
    return [baseColor];
  }

  // Import and use hexToHsl here to avoid circular imports
  const { hexToHsl } = require('../utils/optimizedColor');
  const { h, s, l } = hexToHsl(baseColor) || { h: 0, s: 100, l: 50 };
  
  return definition.generator(h, s, l, baseColor);
};

/**
 * Get scheme metadata
 */
export const getSchemeInfo = (scheme) => {
  const definition = COLOR_SCHEME_DEFINITIONS[scheme];
  if (!definition) return null;
  
  return {
    name: definition.name,
    description: definition.description,
    count: definition.count,
    offsets: definition.offsets
  };
};

/**
 * Validate if a scheme exists
 */
export const isValidScheme = (scheme) => {
  return scheme in COLOR_SCHEME_DEFINITIONS;
};

/**
 * Get all available schemes with metadata
 */
export const getAllSchemes = () => {
  return Object.entries(COLOR_SCHEME_DEFINITIONS).map(([key, def]) => ({
    key,
    name: def.name,
    description: def.description,
    count: def.count
  }));
};
