// utils/optimizedColor.js - Performance-optimized color utilities
// Eliminates redundant calculations and provides efficient batch operations

/**
 * Color data cache to avoid redundant conversions
 * Structure: { hex: { rgb, hsl, luminance, brightness, analysis } }
 * SAFER: Use LRU cache with size limit to prevent memory leaks
 */
import { LRUCache } from './LRUCache';
import { reportError, ERROR_EVENTS } from './errorTelemetry';

// Industry-standard LRU cache configuration
const MAX_CACHE_SIZE = 1000;
const colorCache = new LRUCache({
  maxSize: MAX_CACHE_SIZE,
  ttl: 1800000, // 30 minutes TTL for color data
  cleanupInterval: 300000, // 5 minutes cleanup
  updateAgeOnGet: true // Update access time on get
});

/**
 * Normalize and validate hex color input
 * ✅ ENHANCED: Supports alpha channels and CSS color names
 */
function normalizeHex(hex) {
  if (typeof hex !== 'string') return null;
  
  // ✅ CSS COLOR NAMES: Handle basic CSS color names
  const cssColors = {
    'red': '#ff0000', 'green': '#008000', 'blue': '#0000ff',
    'white': '#ffffff', 'black': '#000000', 'yellow': '#ffff00',
    'cyan': '#00ffff', 'magenta': '#ff00ff', 'silver': '#c0c0c0',
    'gray': '#808080', 'maroon': '#800000', 'olive': '#808000',
    'lime': '#00ff00', 'aqua': '#00ffff', 'teal': '#008080',
    'navy': '#000080', 'fuchsia': '#ff00ff', 'purple': '#800080',
    'orange': '#ffa500', 'pink': '#ffc0cb', 'brown': '#a52a2a'
  };
  
  const lowerHex = hex.trim().toLowerCase();
  if (cssColors[lowerHex]) {
    return cssColors[lowerHex];
  }
  
  const clean = lowerHex.replace(/^#/, '');
  
  // ✅ ALPHA SUPPORT: Handle 8-char hex with alpha (strip alpha)
  if (/^[0-9a-f]{8}$/.test(clean)) {
    return `#${clean.slice(0, 6)}`;
  }
  
  // ✅ ALPHA SUPPORT: Handle 4-char hex with alpha (strip alpha and expand)
  if (/^[0-9a-f]{4}$/.test(clean)) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`;
  }
  
  // ✅ STANDARD: Handle 3 or 6 char hex
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(clean)) return null;
  
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  return `#${full}`;
}

/**
 * Get or compute cached color data with proper validation
 */
function getCachedColorData(hex) {
  // Validate and normalize hex input
  const normalizedHex = normalizeHex(hex);
  if (!normalizedHex) {
    // ✅ Report invalid colors to analytics
    // ✅ CRASH FIX: Use typeof check to prevent ReferenceError in production
    if ((typeof __DEV__ === 'undefined' || !__DEV__) && global.Analytics) {
      global.Analytics.track('invalid_color_input', {
        input: hex,
        source: 'getCachedColorData'
      });
    }
    
    // Return safe fallback for invalid colors
    return {
      hex: '#000000',
      r: 0, g: 0, b: 0,
      h: 0, s: 0, l: 0,
      luminance: 0,
      brightnessWeighted: 0,
      isLight: false,
      category: 'dark',
      temperature: 'neutral',
      lastUsed: Date.now(),
      isInvalid: true // Flag to indicate this was a fallback
    };
  }

  // Check LRU cache with automatic TTL and access tracking
  const existing = colorCache.get(normalizedHex);
  if (existing) {
    // ✅ Advanced LRU cache handles access tracking and TTL automatically
    return existing;
  }

  // Compute all color data at once
  const colorData = computeColorData(normalizedHex);
  
  // LRU cache automatically handles size limits and eviction
  colorCache.set(normalizedHex, colorData);
  
  return colorData;
}

/**
 * Compute all color data in one pass to avoid redundant calculations
 */
function computeColorData(hex) {
  // Parse RGB once
  const rgb = hexToRgbOptimized(hex);
  
  // Compute HSL from RGB (more efficient than separate conversion)
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  
  // Compute luminance once (used for brightness and contrast)
  const luminance = computeLuminance(rgb.r, rgb.g, rgb.b);
  
  // Compute brightness metrics once
  const brightness = computeBrightness(rgb.r, rgb.g, rgb.b, luminance);
  
  // Compute color analysis once
  const analysis = computeColorAnalysis(rgb, hsl, brightness);

  // ✅ Use flat structure to reduce object depth and property count
  return {
    hex,
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    h: hsl.h,
    s: hsl.s,
    l: hsl.l,
    luminance,
    brightnessWeighted: brightness.weighted,
    isLight: brightness.isLight,
    category: analysis.category,
    temperature: analysis.temperature,
    lastUsed: Date.now()
  };
}

/**
 * Optimized hex to RGB conversion with validation
 */
function hexToRgbOptimized(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return { r: 0, g: 0, b: 0 }; // Safe fallback
  }
  
  const cleanHex = normalized.slice(1); // Remove #
  
  return {
    r: parseInt(cleanHex.substring(0, 2), 16), // ✅ Use substring
    g: parseInt(cleanHex.substring(2, 4), 16), // ✅ Also: note end index changed to 4 (clearer)
    b: parseInt(cleanHex.substring(4, 6), 16)
  };
}

/**
 * Convert RGB to HSL efficiently
 */
function rgbToHsl(r, g, b) {
  // ✅ Guard against NaN, undefined, Infinity
  if (!isFinite(r) || !isFinite(g) || !isFinite(b)) {
    console.warn('Invalid RGB values:', { r, g, b });
    reportError(ERROR_EVENTS.COLOR_VALIDATION_FAILED, new Error('Invalid RGB values'), { r, g, b });
    return { h: 0, s: 0, l: 0 }; // Safe fallback
  }
  
  // ✅ Clamp to valid RGB range
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // ✅ Final validation of results
  const hResult = Math.round(h * 360);
  const sResult = Math.round(s * 100);
  const lResult = Math.round(l * 100);
  
  return {
    h: isFinite(hResult) ? hResult : 0,
    s: isFinite(sResult) ? sResult : 0,
    l: isFinite(lResult) ? lResult : 0
  };
}

/**
 * Compute luminance for contrast calculations
 */
function computeLuminance(r, g, b) {
  // ✅ Validate inputs
  if (!isFinite(r) || !isFinite(g) || !isFinite(b)) {
    console.warn('Invalid RGB for luminance:', { r, g, b });
    return 0;
  }
  
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = Math.max(0, Math.min(255, c)) / 255; // ✅ Clamp first
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  const luminance = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  
  // ✅ Final validation
  return isFinite(luminance) ? Math.max(0, Math.min(1, luminance)) : 0;
}

/**
 * Compute brightness metrics
 */
function computeBrightness(r, g, b, luminance) {
  // Multiple brightness calculation methods
  const perceived = Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b);
  const average = (r + g + b) / 3;
  const weighted = 0.299 * r + 0.587 * g + 0.114 * b;
  
  return {
    perceived: Math.round(perceived),
    average: Math.round(average),
    weighted: Math.round(weighted),
    luminance: Math.round(luminance * 255),
    isLight: luminance > 0.5,
    isDark: luminance <= 0.5,
    label: getBrightnessLabel(luminance)
  };
}

/**
 * Get brightness label
 */
function getBrightnessLabel(luminance) {
  if (luminance > 0.8) return 'very light';
  if (luminance > 0.6) return 'light';
  if (luminance > 0.4) return 'medium';
  if (luminance > 0.2) return 'dark';
  return 'very dark';
}

/**
 * Compute comprehensive color analysis
 */
function computeColorAnalysis(rgb, hsl, brightness) {
  const { r, g, b } = rgb;
  const { h, s, l } = hsl;
  
  // Color temperature
  const temperature = getColorTemperature(r, g, b);
  
  // Color category
  const category = getColorCategory(h, s, l);
  
  // Accessibility info
  const accessibility = {
    isHighContrast: brightness.luminance > 200 || brightness.luminance < 55,
    recommendedTextColor: brightness.isLight ? '#000000' : '#FFFFFF',
    wcagLevel: brightness.isLight ? 'AA' : 'AAA'
  };
  
  // Color harmony info
  const harmony = {
    isNeutral: s < 10,
    isVibrant: s > 70 && l > 30 && l < 70,
    isPastel: s < 50 && l > 70,
    isMuted: s < 30 && l > 20 && l < 80
  };

  return {
    temperature,
    category,
    accessibility,
    harmony,
    dominantChannel: getDominantChannel(r, g, b),
    saturationLevel: getSaturationLevel(s),
    lightnessLevel: getLightnessLevel(l)
  };
}

/**
 * Get color temperature classification
 */
function getColorTemperature(r, g, b) {
  const ratio = (r + g * 0.5) / (b + 1);
  if (ratio > 1.5) return 'warm';
  if (ratio < 0.8) return 'cool';
  return 'neutral';
}

/**
 * Get color category based on hue
 */
function getColorCategory(h, s, l) {
  if (s < 10) return 'grayscale';
  
  if (h >= 0 && h < 30) return 'red';
  if (h >= 30 && h < 60) return 'orange';
  if (h >= 60 && h < 90) return 'yellow';
  if (h >= 90 && h < 150) return 'green';
  if (h >= 150 && h < 210) return 'cyan';
  if (h >= 210 && h < 270) return 'blue';
  if (h >= 270 && h < 330) return 'purple';
  return 'red'; // 330-360
}

/**
 * Get dominant RGB channel
 */
function getDominantChannel(r, g, b) {
  if (r >= g && r >= b) return 'red';
  if (g >= r && g >= b) return 'green';
  return 'blue';
}

/**
 * Get saturation level
 */
function getSaturationLevel(s) {
  if (s < 20) return 'desaturated';
  if (s < 40) return 'muted';
  if (s < 70) return 'moderate';
  return 'vibrant';
}

/**
 * Get lightness level
 */
function getLightnessLevel(l) {
  if (l < 20) return 'very dark';
  if (l < 40) return 'dark';
  if (l < 60) return 'medium';
  if (l < 80) return 'light';
  return 'very light';
}

// ============================================================================
// PUBLIC API - Optimized versions of common functions
// ============================================================================

/**
 * Optimized color analysis - computes everything once
 */
export function analyzeColor(hex) {
  // ✅ Run validation on first color operation
  runValidationOnce();
  
  const colorData = getCachedColorData(hex);
  
  return {
    hex: colorData.hex,
    rgb: { r: colorData.r, g: colorData.g, b: colorData.b },
    hsl: { h: colorData.h, s: colorData.s, l: colorData.l },
    brightness: colorData.brightnessWeighted,
    brightnessLabel: colorData.isLight ? 'light' : 'dark',
    isLight: colorData.isLight,
    isDark: !colorData.isLight,
    luminance: colorData.luminance,
    analysis: { category: colorData.category, temperature: colorData.temperature }
  };
}

/**
 * Optimized brightness calculation - uses cached data
 */
export function getColorBrightness(hex) {
  runValidationOnce();
  const colorData = getCachedColorData(hex);
  return colorData.brightnessWeighted;
}

/**
 * Optimized luminance calculation - uses cached data
 */
export function getColorLuminance(hex) {
  const colorData = getCachedColorData(hex);
  return colorData.luminance;
}

/**
 * Optimized contrast ratio calculation - uses cached luminance
 */
export function getContrastRatio(color1, color2) {
  runValidationOnce();
  const lum1 = getColorLuminance(color1);
  const lum2 = getColorLuminance(color2);
  
  // ✅ Validate luminance values
  if (!isFinite(lum1) || !isFinite(lum2) || lum1 < 0 || lum2 < 0) {
    console.warn('Invalid luminance values for contrast:', { color1, color2, lum1, lum2 });
    return 1; // Safe fallback - no contrast
  }
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  // ✅ Prevent division by zero (though mathematically impossible with +0.05)
  const denominator = darkest + 0.05;
  if (denominator <= 0) {
    console.warn('Division by zero prevented in contrast calculation');
    return 1;
  }
  
  const ratio = (brightest + 0.05) / denominator;
  
  // ✅ Validate result
  return isFinite(ratio) && ratio > 0 ? ratio : 1;
}

/**
 * Batch contrast ratio calculation - highly optimized for O(N^2) operations
 */
export function getBatchContrastRatios(colors) {
  // Pre-compute luminance for all colors
  const luminanceMap = new Map();
  colors.forEach(color => {
    luminanceMap.set(color, getColorLuminance(color));
  });
  
  // Compute contrast matrix
  const contrastMatrix = {};
  
  for (let i = 0; i < colors.length; i++) {
    const color1 = colors[i];
    const lum1 = luminanceMap.get(color1);
    contrastMatrix[color1] = {};
    
    for (let j = 0; j < colors.length; j++) {
      const color2 = colors[j];
      
      if (i === j) {
        contrastMatrix[color1][color2] = 1;
        continue;
      }
      
      // Check if we already computed this pair
      if (contrastMatrix[color2] && contrastMatrix[color2][color1]) {
        contrastMatrix[color1][color2] = contrastMatrix[color2][color1];
        continue;
      }
      
      const lum2 = luminanceMap.get(color2);
      
      // ✅ Validate luminance values
      if (!isFinite(lum1) || !isFinite(lum2) || lum1 < 0 || lum2 < 0) {
        contrastMatrix[color1][color2] = 1; // Safe fallback
        continue;
      }
      
      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);
      const denominator = darkest + 0.05;
      
      // ✅ Prevent division by zero and validate result
      const ratio = denominator > 0 ? (brightest + 0.05) / denominator : 1;
      contrastMatrix[color1][color2] = isFinite(ratio) && ratio > 0 ? ratio : 1;
    }
  }
  
  return contrastMatrix;
}

/**
 * Optimized palette validation - O(N^2) → O(N) for luminance calculations
 */
export function validateColorPalette(colors, minContrast = 4.5) {
  if (!colors || colors.length < 2) {
    return { isValid: true, issues: [] };
  }
  
  const issues = [];
  const contrastMatrix = getBatchContrastRatios(colors);
  
  // Check all pairs for contrast issues
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const color1 = colors[i];
      const color2 = colors[j];
      const contrast = contrastMatrix[color1][color2];
      
      if (contrast < minContrast) {
        issues.push({
          type: 'low_contrast',
          colors: [color1, color2],
          contrast: Math.round(contrast * 100) / 100,
          minRequired: minContrast,
          suggestion: `Increase contrast between ${color1} and ${color2}`
        });
      }
    }
  }
  
  // Check for color similarity
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const analysis1 = analyzeColor(colors[i]);
      const analysis2 = analyzeColor(colors[j]);
      
      const hueDiff = Math.abs(analysis1.hsl.h - analysis2.hsl.h);
      const satDiff = Math.abs(analysis1.hsl.s - analysis2.hsl.s);
      const lightDiff = Math.abs(analysis1.hsl.l - analysis2.hsl.l);
      
      if (hueDiff < 15 && satDiff < 20 && lightDiff < 20) {
        issues.push({
          type: 'similar_colors',
          colors: [colors[i], colors[j]],
          differences: { hue: hueDiff, saturation: satDiff, lightness: lightDiff },
          suggestion: `Colors ${colors[i]} and ${colors[j]} are very similar`
        });
      }
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    stats: {
      totalColors: colors.length,
      totalComparisons: (colors.length * (colors.length - 1)) / 2,
      averageContrast: calculateAverageContrast(contrastMatrix, colors),
      colorDistribution: analyzeColorDistribution(colors)
    }
  };
}

/**
 * Calculate average contrast across all color pairs
 */
function calculateAverageContrast(contrastMatrix, colors) {
  let total = 0;
  let count = 0;
  
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      total += contrastMatrix[colors[i]][colors[j]];
      count++;
    }
  }
  
  return count > 0 ? Math.round((total / count) * 100) / 100 : 0;
}

/**
 * Analyze color distribution in palette
 */
function analyzeColorDistribution(colors) {
  const categories = {};
  const temperatures = { warm: 0, cool: 0, neutral: 0 };
  const brightness = { light: 0, dark: 0 };
  
  colors.forEach(color => {
    const analysis = analyzeColor(color);
    
    // Count categories
    categories[analysis.analysis.category] = (categories[analysis.analysis.category] || 0) + 1;
    
    // Count temperatures
    temperatures[analysis.analysis.temperature]++;
    
    // Count brightness
    if (analysis.isLight) brightness.light++;
    else brightness.dark++;
  });
  
  return {
    categories,
    temperatures,
    brightness,
    diversity: Object.keys(categories).length / colors.length
  };
}

/**
 * Batch color analysis - optimized for multiple colors
 */
export function analyzePalette(colors) {
  runValidationOnce();
  return colors.map(color => analyzeColor(color));
}

/**
 * Find colors with insufficient contrast
 */
export function findContrastIssues(colors, minContrast = 4.5) {
  const validation = validateColorPalette(colors, minContrast);
  return validation.issues.filter(issue => issue.type === 'low_contrast');
}

/**
 * Suggest accessible alternatives for low contrast pairs
 */
export function suggestAccessibleAlternatives(color1, color2, minContrast = 4.5) {
  const currentContrast = getContrastRatio(color1, color2);
  
  if (currentContrast >= minContrast) {
    return { needsImprovement: false, currentContrast };
  }
  
  const analysis1 = analyzeColor(color1);
  const analysis2 = analyzeColor(color2);
  
  const suggestions = [];
  
  // Suggest lightening the lighter color
  if (analysis1.brightness > analysis2.brightness) {
    const lighterVersion = adjustColorLightness(color1, 20);
    const newContrast = getContrastRatio(lighterVersion, color2);
    if (newContrast >= minContrast) {
      suggestions.push({
        type: 'lighten',
        originalColor: color1,
        suggestedColor: lighterVersion,
        newContrast
      });
    }
  } else {
    const lighterVersion = adjustColorLightness(color2, 20);
    const newContrast = getContrastRatio(color1, lighterVersion);
    if (newContrast >= minContrast) {
      suggestions.push({
        type: 'lighten',
        originalColor: color2,
        suggestedColor: lighterVersion,
        newContrast
      });
    }
  }
  
  // Suggest darkening the darker color
  if (analysis1.brightness < analysis2.brightness) {
    const darkerVersion = adjustColorLightness(color1, -20);
    const newContrast = getContrastRatio(darkerVersion, color2);
    if (newContrast >= minContrast) {
      suggestions.push({
        type: 'darken',
        originalColor: color1,
        suggestedColor: darkerVersion,
        newContrast
      });
    }
  } else {
    const darkerVersion = adjustColorLightness(color2, -20);
    const newContrast = getContrastRatio(color1, darkerVersion);
    if (newContrast >= minContrast) {
      suggestions.push({
        type: 'darken',
        originalColor: color2,
        suggestedColor: darkerVersion,
        newContrast
      });
    }
  }
  
  return {
    needsImprovement: true,
    currentContrast,
    minRequired: minContrast,
    suggestions
  };
}

/**
 * Adjust color lightness
 * ✅ CRITICAL FIX: colorData has flat structure, not nested .hsl property
 */
function adjustColorLightness(hex, adjustment) {
  const colorData = getCachedColorData(hex);
  // ✅ FIX: Access h, s, l directly from flat structure
  const { h, s, l } = colorData;
  
  const newL = Math.max(0, Math.min(100, l + adjustment));
  return hslToHex(h, s, newL);
}

/**
 * Convert HSL to Hex (optimized version)
 */
export function hslToHex(h, s, l) {
  runValidationOnce();
  // ✅ Validate inputs
  if (!isFinite(h) || !isFinite(s) || !isFinite(l)) {
    console.warn('Invalid HSL values:', { h, s, l });
    reportError(ERROR_EVENTS.COLOR_VALIDATION_FAILED, new Error('Invalid HSL values'), { h, s, l });
    return '#000000'; // Explicit fallback with warning
  }
  
  // ✅ Clamp to valid ranges
  h = ((h % 360) + 360) % 360; // Normalize to 0-360
  s = Math.max(0, Math.min(100, s));
  l = Math.max(0, Math.min(100, l));
  
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    const component = Math.round(255 * color);
    
    // ✅ Validate component
    if (!isFinite(component) || component < 0 || component > 255) {
      return '00';
    }
    
    return component.toString(16).padStart(2, '0');
  };
  
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Get comprehensive cache statistics (for debugging/monitoring)
 */
export function getColorCache() {
  const stats = colorCache.getStats();
  return {
    ...stats,
    colors: colorCache.keys(), // Use public API method
    recentColors: colorCache.keys().slice(-10) // Last 10 accessed colors
  };
}

/**
 * Clear color cache and reset statistics
 */
export function clearColorCache() {
  colorCache.clear();
}

/**
 * Get detailed cache entry information for debugging
 * @param {string} hex - Hex color to inspect
 * @returns {object|null} Entry metadata or null if not found
 */
export function getColorCacheEntry(hex) {
  const normalizedHex = normalizeHex(hex);
  if (!normalizedHex) return null;
  
  return colorCache.getEntryInfo(normalizedHex);
}

/**
 * Prune expired entries from cache
 * @returns {number} Number of entries removed
 */
export function pruneColorCache() {
  return colorCache.prune();
}

// Re-export optimized versions of common functions for backward compatibility
export { hexToRgbOptimized as hexToRgb };

// Proper hexToHsl function that takes hex input
export function hexToHsl(hex) {
  const colorData = getCachedColorData(hex);
  // ✅ FIX: colorData has flat structure, construct hsl object
  return { h: colorData.h, s: colorData.s, l: colorData.l };
}

/**
 * Get color scheme colors based on base color and scheme type (optimized with caching)
 */
export function getColorScheme(baseColor, scheme) {
  const { h, s, l } = hexToHsl(baseColor);
  
  // ✅ VALIDATION: Ensure HSL values are valid before calculations
  // Protects against corrupted cache data or invalid input
  const safeH = isFinite(h) ? ((h % 360) + 360) % 360 : 0;  // Normalize to 0-360
  const safeS = isFinite(s) ? Math.max(0, Math.min(100, s)) : 50;  // Clamp to 0-100
  const safeL = isFinite(l) ? Math.max(0, Math.min(100, l)) : 50;  // Clamp to 0-100
  
  // ✅ Helper function for safe hue calculations
  const safeHue = (hueOffset) => ((safeH + hueOffset) % 360 + 360) % 360;
  
  switch (scheme) {
    case 'analogous':
      return [
        baseColor,
        hslToHex(safeHue(30), safeS, safeL),
        hslToHex(safeHue(-30), safeS, safeL)
      ];
    
    case 'complementary':
      return [
        baseColor,
        hslToHex(safeHue(180), safeS, safeL)
      ];
    
    case 'split-complementary':
      return [
        baseColor,
        hslToHex(safeHue(150), safeS, safeL),
        hslToHex(safeHue(210), safeS, safeL)
      ];
    
    case 'triadic':
      return [
        baseColor,
        hslToHex(safeHue(120), safeS, safeL),
        hslToHex(safeHue(240), safeS, safeL)
      ];
    
    case 'tetradic':
      return [
        baseColor,
        hslToHex(safeHue(90), safeS, safeL),
        hslToHex(safeHue(180), safeS, safeL),
        hslToHex(safeHue(270), safeS, safeL)
      ];
    
    case 'monochromatic':
      return [
        hslToHex(safeH, safeS, Math.max(10, safeL - 30)),
        hslToHex(safeH, safeS, Math.max(10, safeL - 15)),
        baseColor,
        hslToHex(safeH, safeS, Math.min(90, safeL + 15)),
        hslToHex(safeH, safeS, Math.min(90, safeL + 30))
      ];
    
    case 'compound':
      return [
        baseColor,
        hslToHex(safeHue(150), safeS, safeL),
        hslToHex(safeHue(180), safeS, safeL),
        hslToHex(safeHue(210), safeS, safeL)
      ];
    
    case 'shades':
      return [
        hslToHex(safeH, Math.min(100, safeS + 5), Math.max(5, safeL - 40)),
        hslToHex(safeH, Math.min(100, safeS + 3), Math.max(10, safeL - 25)),
        baseColor,
        hslToHex(safeH, Math.min(100, safeS + 1), Math.max(15, safeL - 10)),
        hslToHex(safeH, safeS, Math.max(20, safeL - 5))
      ];
    
    case 'tints':
      return [
        hslToHex(safeH, Math.max(10, safeS - 15), Math.min(95, safeL + 40)),
        hslToHex(safeH, Math.max(10, safeS - 10), Math.min(90, safeL + 25)),
        baseColor,
        hslToHex(safeH, Math.max(10, safeS - 5), Math.min(85, safeL + 10)),
        hslToHex(safeH, Math.max(10, safeS - 2), Math.min(80, safeL + 5))
      ];
    
    default:
      return [baseColor];
  }
}

/**
 * Calculate contrast ratio between two colors (optimized with caching)
 */
export function contrastRatio(color1, color2) {
  return getContrastRatio(color1, color2);
}

/**
 * Find nearest accessible color with sufficient contrast (optimized)
 */
export function nearestAccessible(background, target, minRatio = 4.5) {
  const ratio = contrastRatio(background, target);
  if (ratio >= minRatio) return target;
  
  // Simple fallback - return high contrast color
  const bgLum = contrastRatio(background, '#000000');
  return bgLum > 3 ? '#000000' : '#FFFFFF';
}

/**
 * Export hex validation function for use by other modules
 */
export { normalizeHex };

// ✅ MODULE LOADING FIX: Defer validation to first use to prevent import-time crashes
let validationRun = false;

const runValidationOnce = () => {
  if (validationRun) return;
  validationRun = true;
  
  try {
    // Test critical hex validation patterns
    const criticalTests = [
      '#123abc',        // Valid 6-char
      '#ABC',           // Valid 3-char
      '#ffffff',        // Valid lowercase
      '#FFFFFF',        // Valid uppercase
    ];
    
    // Validate that critical patterns work correctly
    const allValid = criticalTests.every(test => {
      const result = normalizeHex(test);
      return result && result.length === 7 && result.startsWith('#');
    });
    
    if (!allValid && typeof reportError === 'function') {
      reportError(ERROR_EVENTS.COLOR_VALIDATION_FAILED, 
        new Error('Critical hex validation failed'), 
        { context: 'hex_validation_test' }
      );
    }
  } catch (validationError) {
    // ✅ Safe fallback if reportError isn't available yet
    if (typeof reportError === 'function') {
      reportError(ERROR_EVENTS.COLOR_VALIDATION_FAILED, validationError, {
        context: 'hex_validation_test_exception'
      });
    } else {
      console.error('Color validation error:', validationError);
    }
  }
};
