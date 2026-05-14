// constants/colorSchemes.js - Single source of truth for all color scheme data.
// colorCount is derived from offsets.length — never edit them independently.

const s = (key, name, description, offsets, accessibilityLabel) => ({
  key, name, description, offsets,
  colorCount: offsets.length,
  accessibilityLabel,
});

export const COLOR_SCHEMES = {
  complementary:       s('complementary',       'Complementary',       'Colors opposite on the color wheel',                     [0, 180],              'Complementary color scheme with 2 opposite colors'),
  analogous:           s('analogous',           'Analogous',           'Colors adjacent on the color wheel',                     [0, 30, -30],          'Analogous color scheme with 3 adjacent colors'),
  'split-complementary': s('split-complementary', 'Split Complementary', 'Base color plus two colors adjacent to its complement', [0, 150, 210],         'Split complementary color scheme with 3 colors'),
  triadic:             s('triadic',             'Triadic',             'Three colors evenly spaced on the color wheel',           [0, 120, 240],         'Triadic color scheme with 3 evenly spaced colors'),
  tetradic:            s('tetradic',            'Tetradic',            'Four colors forming a rectangle on the color wheel',      [0, 90, 180, 270],     'Tetradic color scheme with 4 colors forming a rectangle'),
  monochromatic:       s('monochromatic',       'Monochromatic',       'Variations of a single hue',                             [0, 0, 0],             'Monochromatic color scheme with variations of one color'),
  compound:            s('compound',            'Compound',            'Combination of complementary and analogous',              [0, 30, 180, 210],     'Compound color scheme with split-complementary and complementary colors'),
  shades:              s('shades',              'Shades',              'Darker variations of a color',                           [0, 0, 0, 0, 0],       'Shades color scheme with darker variations of the base color'),
  tints:               s('tints',              'Tints',               'Lighter variations of a color',                          [0, 0, 0, 0, 0],       'Tints color scheme with lighter variations of the base color'),
};

export const SCHEME_KEYS = Object.keys(COLOR_SCHEMES);

// Derived lookups — replaces the separate SCHEME_COUNTS / SCHEME_OFFSETS in colorWheelConstants.js
export const SCHEME_OFFSETS = Object.fromEntries(
  SCHEME_KEYS.map(k => [k, COLOR_SCHEMES[k].offsets])
);

export const SCHEME_COUNTS = Object.fromEntries(
  SCHEME_KEYS.map(k => [k, COLOR_SCHEMES[k].colorCount])
);

export const getAllSchemes = () => Object.values(COLOR_SCHEMES);
export const getSchemeByKey = (key) => COLOR_SCHEMES[key] || null;
export const getSchemeDisplayName = (key) =>
  COLOR_SCHEMES[key]?.name || (key ? key[0].toUpperCase() + key.slice(1) : 'Scheme');
export const getAccessibilityLabel = (key) =>
  COLOR_SCHEMES[key]?.accessibilityLabel || 'Color scheme selector';

export default {
  COLOR_SCHEMES,
  getAllSchemes,
  getSchemeByKey,
  getSchemeDisplayName,
  getAccessibilityLabel,
  SCHEME_KEYS,
  SCHEME_OFFSETS,
  SCHEME_COUNTS,
};
