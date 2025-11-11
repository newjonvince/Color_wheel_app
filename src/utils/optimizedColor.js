// utils/optimizedColor.js - Performance-optimized color utilities
// Eliminates redundant calculations and provides efficient batch operations

/**
 * Color data cache to avoid redundant conversions
 * Structure: { hex: { rgb, hsl, luminance, brightness, analysis } }
 */
const colorCache = new Map();
const MAX_CACHE_SIZE = 1000;

/**
 * Clear cache when it gets too large
 */
function clearCacheIfNeeded() {
  if (colorCache.size > MAX_CACHE_SIZE) {
    // Keep only the most recently used 500 entries
    const entries = Array.from(colorCache.entries());
    colorCache.clear();
    entries.slice(-500).forEach(([key, value]) => {
      colorCache.set(key, value);
    });
  }
}

/**
 * Get or compute cached color data
 */
function getCachedColorData(hex) {
  // Normalize hex format
  const normalizedHex = hex.toLowerCase().replace(/^#/, '');
  const fullHex = normalizedHex.length === 3 
    ? normalizedHex.split('').map(c => c + c).join('')
    : normalizedHex;
  const hexKey = `#${fullHex}`;

  if (colorCache.has(hexKey)) {
    const existing = colorCache.get(hexKey);
    existing.lastUsed = Date.now();
    colorCache.set(hexKey, existing); // update insertion order
    return existing;
  }

  // Compute all color data at once
  const colorData = computeColorData(hexKey);
  
  clearCacheIfNeeded();
  colorCache.set(hexKey, colorData);
  
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

  return {
    hex,
    rgb,
    hsl,
    luminance,
    brightness,
    analysis,
    // Add timestamp for cache management
    lastUsed: Date.now()
  };
}

/**
 * Optimized hex to RGB conversion
 */
function hexToRgbOptimized(hex) {
  const cleanHex = hex.replace('#', '');
  
  if (cleanHex.length === 3) {
    return {
      r: parseInt(cleanHex[0] + cleanHex[0], 16),
      g: parseInt(cleanHex[1] + cleanHex[1], 16),
      b: parseInt(cleanHex[2] + cleanHex[2], 16)
    };
  }
  
  return {
    r: parseInt(cleanHex.substr(0, 2), 16),
    g: parseInt(cleanHex.substr(2, 2), 16),
    b: parseInt(cleanHex.substr(4, 2), 16)
  };
}

/**
 * Convert RGB to HSL efficiently
 */
function rgbToHsl(r, g, b) {
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

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Compute luminance for contrast calculations
 */
function computeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
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
  const colorData = getCachedColorData(hex);
  
  return {
    hex: colorData.hex,
    rgb: colorData.rgb,
    hsl: colorData.hsl,
    brightness: colorData.brightness.weighted,
    brightnessLabel: colorData.brightness.label,
    isLight: colorData.brightness.isLight,
    isDark: colorData.brightness.isDark,
    luminance: colorData.luminance,
    analysis: colorData.analysis
  };
}

/**
 * Optimized brightness calculation - uses cached data
 */
export function getColorBrightness(hex) {
  const colorData = getCachedColorData(hex);
  return colorData.brightness.weighted;
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
  const lum1 = getColorLuminance(color1);
  const lum2 = getColorLuminance(color2);
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
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
      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);
      
      contrastMatrix[color1][color2] = (brightest + 0.05) / (darkest + 0.05);
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
 */
function adjustColorLightness(hex, adjustment) {
  const colorData = getCachedColorData(hex);
  const { h, s, l } = colorData.hsl;
  
  const newL = Math.max(0, Math.min(100, l + adjustment));
  return hslToHex(h, s, newL);
}

/**
 * Convert HSL to Hex (optimized version)
 */
export function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Get cached color data (for debugging/inspection)
 */
export function getColorCache() {
  return {
    size: colorCache.size,
    maxSize: MAX_CACHE_SIZE,
    colors: Array.from(colorCache.keys())
  };
}

/**
 * Clear color cache
 */
export function clearColorCache() {
  colorCache.clear();
}

// Re-export optimized versions of common functions for backward compatibility
export { hexToRgbOptimized as hexToRgb };

// Proper hexToHsl function that takes hex input
export function hexToHsl(hex) {
  const colorData = getCachedColorData(hex);
  return colorData.hsl;
}

/**
 * Get color scheme colors based on base color and scheme type (optimized with caching)
 */
export function getColorScheme(baseColor, scheme) {
  const { h, s, l } = hexToHsl(baseColor);
  
  switch (scheme) {
    case 'analogous':
      return [
        baseColor,
        hslToHex((h + 30) % 360, s, l),
        hslToHex((h - 30 + 360) % 360, s, l)
      ];
    
    case 'complementary':
      return [
        baseColor,
        hslToHex((h + 180) % 360, s, l)
      ];
    
    case 'split-complementary':
      return [
        baseColor,
        hslToHex((h + 150) % 360, s, l),
        hslToHex((h + 210) % 360, s, l)
      ];
    
    case 'triadic':
      return [
        baseColor,
        hslToHex((h + 120) % 360, s, l),
        hslToHex((h + 240) % 360, s, l)
      ];
    
    case 'tetradic':
      return [
        baseColor,
        hslToHex((h + 90) % 360, s, l),
        hslToHex((h + 180) % 360, s, l),
        hslToHex((h + 270) % 360, s, l)
      ];
    
    case 'monochromatic':
      return [
        hslToHex(h, s, Math.max(10, l - 30)),
        hslToHex(h, s, Math.max(10, l - 15)),
        baseColor,
        hslToHex(h, s, Math.min(90, l + 15)),
        hslToHex(h, s, Math.min(90, l + 30))
      ];
    
    case 'compound':
      return [
        baseColor,
        hslToHex((h + 150) % 360, s, l),
        hslToHex((h + 180) % 360, s, l),
        hslToHex((h + 210) % 360, s, l)
      ];
    
    case 'shades':
      return [
        hslToHex(h, Math.min(100, s + 5), Math.max(5, l - 40)),
        hslToHex(h, Math.min(100, s + 3), Math.max(10, l - 25)),
        baseColor,
        hslToHex(h, Math.min(100, s + 1), Math.max(15, l - 10)),
        hslToHex(h, s, Math.max(20, l - 5))
      ];
    
    case 'tints':
      return [
        hslToHex(h, Math.max(10, s - 15), Math.min(95, l + 40)),
        hslToHex(h, Math.max(10, s - 10), Math.min(90, l + 25)),
        baseColor,
        hslToHex(h, Math.max(10, s - 5), Math.min(85, l + 10)),
        hslToHex(h, Math.max(10, s - 2), Math.min(80, l + 5))
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
