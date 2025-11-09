// constants/colorWheelConstants.js - Color wheel constants without Skia dependencies
// Extracted from FullColorWheel.js to avoid import issues

export const SCHEME_OFFSETS = {
  complementary: [0, 180],
  analogous: [0, 30, -30],
  triadic: [0, 120, 240],
  tetradic: [0, 90, 180, 270],
  splitComplementary: [0, 150, 210],
  monochromatic: [0, 0, 0],
  compound: [0, 30, 180, 210],
  shades: [0, 0, 0, 0, 0],
  tints: [0, 0, 0, 0, 0],
};

export const SCHEME_COUNTS = {
  complementary: 2,
  analogous: 3,
  triadic: 3,
  tetradic: 4,
  splitComplementary: 3,
  monochromatic: 3,
  compound: 4,
  shades: 5,
  tints: 5,
};
