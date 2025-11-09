// utils/colorUtils.js - Enhanced color utility functions
// Comprehensive color management system for Fashion Color Wheel

/**
 * Color validation and normalization
 */
export const validateHexColor = (hex) => {
  if (!hex || typeof hex !== 'string') return false;
  
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Check if valid hex format (3 or 6 characters)
  const hexRegex = /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/;
  return hexRegex.test(cleanHex);
};

export const normalizeHexColor = (hex) => {
  if (!validateHexColor(hex)) return '#000000';
  
  let cleanHex = hex.replace('#', '').toUpperCase();
  
  // Convert 3-digit hex to 6-digit
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }
  
  return `#${cleanHex}`;
};

/**
 * Advanced color space conversions
 */
export const hexToRgb = (hex) => {
  const normalizedHex = normalizeHexColor(hex);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalizedHex);
  
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

export const rgbToHex = (r, g, b) => {
  const toHex = (n) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

export const hexToHsl = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / d + 2; break;
      case bNorm: h = (rNorm - gNorm) / d + 4; break;
    }
    h /= 6;
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

export const hslToHex = (h, s, l) => {
  // Normalize values
  h = ((h % 360) + 360) % 360; // Ensure 0-359
  s = Math.max(0, Math.min(100, s)) / 100; // 0-1
  l = Math.max(0, Math.min(100, l)) / 100; // 0-1
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r, g, b;
  
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
  } else {
    r = c; g = 0; b = x;
  }
  
  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  );
};

/**
 * Advanced color scheme generation
 */
export const COLOR_SCHEMES = {
  COMPLEMENTARY: 'complementary',
  ANALOGOUS: 'analogous',
  SPLIT_COMPLEMENTARY: 'split-complementary',
  TRIADIC: 'triadic',
  TETRADIC: 'tetradic',
  MONOCHROMATIC: 'monochromatic',
  COMPOUND: 'compound',
  SHADES: 'shades',
  TINTS: 'tints'
};

export const generateColorScheme = (baseColor, scheme, options = {}) => {
  const normalizedBase = normalizeHexColor(baseColor);
  const { h, s, l } = hexToHsl(normalizedBase);
  const { count = 5, variation = 1 } = options;
  
  switch (scheme) {
    case COLOR_SCHEMES.COMPLEMENTARY:
      return [
        normalizedBase,
        hslToHex((h + 180) % 360, s, l)
      ];
    
    case COLOR_SCHEMES.ANALOGOUS:
      return [
        hslToHex((h - 30 * variation + 360) % 360, s, l),
        normalizedBase,
        hslToHex((h + 30 * variation) % 360, s, l)
      ];
    
    case COLOR_SCHEMES.SPLIT_COMPLEMENTARY:
      return [
        normalizedBase,
        hslToHex((h + 150) % 360, s, l),
        hslToHex((h + 210) % 360, s, l)
      ];
    
    case COLOR_SCHEMES.TRIADIC:
      return [
        normalizedBase,
        hslToHex((h + 120) % 360, s, l),
        hslToHex((h + 240) % 360, s, l)
      ];
    
    case COLOR_SCHEMES.TETRADIC:
      return [
        normalizedBase,
        hslToHex((h + 90) % 360, s, l),
        hslToHex((h + 180) % 360, s, l),
        hslToHex((h + 270) % 360, s, l)
      ];
    
    case COLOR_SCHEMES.MONOCHROMATIC:
      const colors = [];
      const step = 20;
      for (let i = 0; i < count; i++) {
        const newL = Math.max(10, Math.min(90, l + (i - Math.floor(count/2)) * step));
        colors.push(hslToHex(h, s, newL));
      }
      return colors;
    
    case COLOR_SCHEMES.COMPOUND:
      return [
        normalizedBase,
        hslToHex((h + 30) % 360, s, l),
        hslToHex((h + 180) % 360, s, l),
        hslToHex((h + 210) % 360, s, l)
      ];
    
    case COLOR_SCHEMES.SHADES:
      const shades = [];
      for (let i = 0; i < count; i++) {
        const newL = Math.max(5, l - (i * 15));
        shades.push(hslToHex(h, s, newL));
      }
      return shades;
    
    case COLOR_SCHEMES.TINTS:
      const tints = [];
      for (let i = 0; i < count; i++) {
        const newL = Math.min(95, l + (i * 15));
        tints.push(hslToHex(h, s, newL));
      }
      return tints;
    
    default:
      return [normalizedBase];
  }
};

/**
 * Color accessibility and contrast
 */
export const getLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  
  const [rNorm, gNorm, bNorm] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm;
};

export const getContrastRatio = (color1, color2) => {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
};

export const isAccessible = (foreground, background, level = 'AA') => {
  const ratio = getContrastRatio(foreground, background);
  
  switch (level) {
    case 'AAA': return ratio >= 7;
    case 'AA_LARGE': return ratio >= 3;
    case 'AA':
    default: return ratio >= 4.5;
  }
};

export const findAccessibleColor = (background, preferredColor, level = 'AA') => {
  if (isAccessible(preferredColor, background, level)) {
    return preferredColor;
  }
  
  const { h, s } = hexToHsl(preferredColor);
  const bgLuminance = getLuminance(background);
  
  // Try darker first, then lighter
  for (let l = 10; l <= 90; l += 5) {
    const testColor = hslToHex(h, s, l);
    if (isAccessible(testColor, background, level)) {
      return testColor;
    }
  }
  
  // Fallback to high contrast
  return bgLuminance > 0.5 ? '#000000' : '#FFFFFF';
};

/**
 * Color analysis and properties
 */
export const getColorTemperature = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  
  // Simplified color temperature calculation
  const temperature = (r - b) / (r + g + b);
  
  if (temperature > 0.1) return 'warm';
  if (temperature < -0.1) return 'cool';
  return 'neutral';
};

export const getColorBrightness = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  if (brightness > 186) return 'light';
  if (brightness < 70) return 'dark';
  return 'medium';
};

export const getColorSaturation = (hex) => {
  const { s } = hexToHsl(hex);
  
  if (s > 75) return 'vibrant';
  if (s > 40) return 'moderate';
  if (s > 15) return 'muted';
  return 'grayscale';
};

export const analyzeColor = (hex) => {
  const normalizedHex = normalizeHexColor(hex);
  const { h, s, l } = hexToHsl(normalizedHex);
  const { r, g, b } = hexToRgb(normalizedHex);
  
  return {
    hex: normalizedHex,
    rgb: { r, g, b },
    hsl: { h, s, l },
    temperature: getColorTemperature(normalizedHex),
    brightness: getColorBrightness(normalizedHex),
    saturation: getColorSaturation(normalizedHex),
    luminance: getLuminance(normalizedHex),
    isLight: getColorBrightness(normalizedHex) === 'light',
    isDark: getColorBrightness(normalizedHex) === 'dark'
  };
};

/**
 * Color palette utilities
 */
export const sortColorsByHue = (colors) => {
  return colors
    .map(color => ({ color: normalizeHexColor(color), hue: hexToHsl(color).h }))
    .sort((a, b) => a.hue - b.hue)
    .map(item => item.color);
};

export const sortColorsByLightness = (colors) => {
  return colors
    .map(color => ({ color: normalizeHexColor(color), lightness: hexToHsl(color).l }))
    .sort((a, b) => a.lightness - b.lightness)
    .map(item => item.color);
};

export const removeDuplicateColors = (colors, threshold = 10) => {
  const unique = [];
  
  for (const color of colors) {
    const normalizedColor = normalizeHexColor(color);
    const isDuplicate = unique.some(existingColor => {
      const distance = getColorDistance(normalizedColor, existingColor);
      return distance < threshold;
    });
    
    if (!isDuplicate) {
      unique.push(normalizedColor);
    }
  }
  
  return unique;
};

export const getColorDistance = (color1, color2) => {
  const { r: r1, g: g1, b: b1 } = hexToRgb(color1);
  const { r: r2, g: g2, b: b2 } = hexToRgb(color2);
  
  return Math.sqrt(
    Math.pow(r2 - r1, 2) +
    Math.pow(g2 - g1, 2) +
    Math.pow(b2 - b1, 2)
  );
};

/**
 * Fashion-specific color utilities
 */
export const FASHION_SEASONS = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter'
};

export const getFashionSeason = (hex) => {
  const { h, s, l } = hexToHsl(hex);
  const temperature = getColorTemperature(hex);
  
  if (temperature === 'warm') {
    return s > 50 && l > 40 ? FASHION_SEASONS.SPRING : FASHION_SEASONS.AUTUMN;
  } else {
    return l > 50 ? FASHION_SEASONS.SUMMER : FASHION_SEASONS.WINTER;
  }
};

export const getComplementaryOutfitColors = (baseColor) => {
  const schemes = [
    generateColorScheme(baseColor, COLOR_SCHEMES.COMPLEMENTARY),
    generateColorScheme(baseColor, COLOR_SCHEMES.ANALOGOUS),
    generateColorScheme(baseColor, COLOR_SCHEMES.SPLIT_COMPLEMENTARY)
  ];
  
  return {
    primary: baseColor,
    complementary: schemes[0][1],
    analogous: schemes[1].slice(1),
    splitComplementary: schemes[2].slice(1),
    neutral: ['#FFFFFF', '#F5F5F5', '#E0E0E0', '#CCCCCC', '#999999', '#666666', '#333333', '#000000']
  };
};

/**
 * Color name utilities
 */
export const getColorName = (hex) => {
  const { h, s, l } = hexToHsl(hex);
  
  // Basic color names based on hue
  const hueNames = [
    { min: 0, max: 15, name: 'Red' },
    { min: 15, max: 45, name: 'Orange' },
    { min: 45, max: 75, name: 'Yellow' },
    { min: 75, max: 150, name: 'Green' },
    { min: 150, max: 210, name: 'Cyan' },
    { min: 210, max: 270, name: 'Blue' },
    { min: 270, max: 330, name: 'Purple' },
    { min: 330, max: 360, name: 'Red' }
  ];
  
  let baseName = 'Gray';
  
  if (s > 10) {
    const hueRange = hueNames.find(range => h >= range.min && h < range.max);
    baseName = hueRange ? hueRange.name : 'Red';
  }
  
  // Add lightness modifiers
  if (l < 20) return `Dark ${baseName}`;
  if (l > 80) return `Light ${baseName}`;
  if (s < 30) return `Muted ${baseName}`;
  if (s > 80) return `Vibrant ${baseName}`;
  
  return baseName;
};

export default {
  // Validation
  validateHexColor,
  normalizeHexColor,
  
  // Conversions
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  
  // Schemes
  COLOR_SCHEMES,
  generateColorScheme,
  
  // Accessibility
  getLuminance,
  getContrastRatio,
  isAccessible,
  findAccessibleColor,
  
  // Analysis
  analyzeColor,
  getColorTemperature,
  getColorBrightness,
  getColorSaturation,
  
  // Utilities
  sortColorsByHue,
  sortColorsByLightness,
  removeDuplicateColors,
  getColorDistance,
  getColorName,
  
  // Fashion
  FASHION_SEASONS,
  getFashionSeason,
  getComplementaryOutfitColors
};
