// hooks/useOptimizedColorProcessing.js - Practical caching implementation
// Demonstrates your exact optimization strategy with reuse and caching

import { useCallback, useRef } from 'react';

let _optimizedColorModule = null;
let _optimizedColorLoadAttempted = false;
const getOptimizedColorModule = () => {
  if (_optimizedColorLoadAttempted) return _optimizedColorModule;
  _optimizedColorLoadAttempted = true;
  try {
    _optimizedColorModule = require('../utils/optimizedColor');
  } catch (e) {
    console.warn('useOptimizedColorProcessing: optimizedColor load failed', e?.message || e);
    _optimizedColorModule = null;
  }
  return _optimizedColorModule;
};

const clampNumber = (value, min, max) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

const parseHexToRgbFallback = (hex) => {
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const rgbToHslFallback = ({ r, g, b }) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h,
    s: s * 100,
    l: l * 100,
  };
};

const hslToHexFallback = (h, s, l) => {
  const hh = ((clampNumber(h, 0, 360) % 360) + 360) % 360;
  const ss = clampNumber(s, 0, 100) / 100;
  const ll = clampNumber(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hh < 60) {
    r1 = c;
    g1 = x;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
  } else if (hh < 180) {
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const to255 = (v) => Math.round((v + m) * 255);
  const r = clampNumber(to255(r1), 0, 255);
  const g = clampNumber(to255(g1), 0, 255);
  const b = clampNumber(to255(b1), 0, 255);

  const toHex2 = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`.toUpperCase();
};

const hexToRgbSafe = (hex) => {
  const mod = getOptimizedColorModule();
  const fn = mod?.hexToRgb;
  if (typeof fn === 'function') {
    try {
      return fn(hex);
    } catch (_e) {
      return parseHexToRgbFallback(hex);
    }
  }
  return parseHexToRgbFallback(hex);
};

const hexToHslSafe = (hex) => {
  const mod = getOptimizedColorModule();
  const fn = mod?.hexToHsl;
  if (typeof fn === 'function') {
    try {
      return fn(hex);
    } catch (_e) {
      const rgb = parseHexToRgbFallback(hex);
      return rgb ? rgbToHslFallback(rgb) : null;
    }
  }
  const rgb = parseHexToRgbFallback(hex);
  return rgb ? rgbToHslFallback(rgb) : null;
};

const hslToHexSafe = (h, s, l) => {
  const mod = getOptimizedColorModule();
  const fn = mod?.hslToHex;
  if (typeof fn === 'function') {
    try {
      return fn(h, s, l);
    } catch (_e) {
      return hslToHexFallback(h, s, l);
    }
  }
  return hslToHexFallback(h, s, l);
};

class FallbackLRUCache {
  constructor(options = {}) {
    this.maxSize = typeof options.maxSize === 'number' ? options.maxSize : 1000;
    this.ttl = typeof options.ttl === 'number' ? options.ttl : 0;
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expired = 0;
  }
  _now() {
    return Date.now();
  }
  _isExpired(entry) {
    if (!entry) return true;
    if (!this.ttl) return false;
    return typeof entry.expiresAt === 'number' && entry.expiresAt <= this._now();
  }
  has(key) {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (this._isExpired(entry)) {
      this.map.delete(key);
      this.expired += 1;
      return false;
    }
    return true;
  }
  get(key) {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (this._isExpired(entry)) {
      this.map.delete(key);
      this.expired += 1;
      this.misses += 1;
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits += 1;
    return entry.value;
  }
  set(key, value) {
    const expiresAt = this.ttl ? this._now() + this.ttl : null;
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt });
    while (this.map.size > this.maxSize) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
      this.evictions += 1;
    }
  }
  clear() {
    this.map.clear();
  }
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total ? this.hits / total : 0;
    return {
      size: this.map.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      evictions: this.evictions,
      expired: this.expired,
    };
  }
}

let _lruCacheCtor = null;
let _lruCacheLoadAttempted = false;
const getLRUCacheCtor = () => {
  if (_lruCacheLoadAttempted) return _lruCacheCtor;
  _lruCacheLoadAttempted = true;
  try {
    const mod = require('../utils/LRUCache');
    _lruCacheCtor = mod?.LRUCache || mod?.default || mod;
  } catch (e) {
    console.warn('useOptimizedColorProcessing: LRUCache load failed', e?.message || e);
    _lruCacheCtor = null;
  }
  if (typeof _lruCacheCtor !== 'function') {
    _lruCacheCtor = FallbackLRUCache;
  }
  return _lruCacheCtor;
};

/**
 * Custom hook that implements optimized caching strategy
 * - Reuses calculation results within functions
 * - Caches across calls with industry-standard LRU implementation
 * - Eliminates redundant HEX→RGB conversions
 * - Uses centralized cache with TTL and performance monitoring
 */

export const useOptimizedColorProcessing = () => {
  // Use optimized LRU caches with TTL and performance monitoring
  const LRUCacheCtor = getLRUCacheCtor();
  const colorCache = useRef(new LRUCacheCtor({ 
    maxSize: 500, 
    ttl: 300000, // 5 minutes TTL for color analysis
    cleanupInterval: 60000 // 1 minute cleanup
  }));
  const contrastCache = useRef(new LRUCacheCtor({ 
    maxSize: 1000, // More contrast pairs than colors
    ttl: 600000, // 10 minutes TTL for contrast calculations
    cleanupInterval: 120000 // 2 minute cleanup
  }));
  
  /**
   * Optimized analyzeColor - implements your exact strategy
   * Computes brightness once, derives all flags from it
   */
  const analyzeColor = useCallback((hex) => {
    const cacheKey = hex.toLowerCase();
    
    // LRU cache handles staleness automatically
    const cached = colorCache.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Single HEX→RGB conversion (not three!)
    const rgb = hexToRgbSafe(hex);
    if (!rgb) {
      return {
        hex,
        rgb: { r: 0, g: 0, b: 0 },
        hsl: { h: 0, s: 0, l: 0 },
        brightness: 0,
        brightnessLabel: 'very dark',
        isLight: false,
        isDark: true,
        luminance: 0,
        temperature: 'neutral',
        category: 'grayscale',
        accessibility: {
          recommendedTextColor: '#FFFFFF',
          contrastLevel: 'low'
        }
      };
    }
    
    // Calculate brightness once and reuse (your exact suggestion)
    const brightnessValue = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    
    // Derive all brightness-related properties from single calculation
    const brightnessLabel = getBrightnessLabel(brightnessValue);
    const isLight = brightnessValue > 128;
    const isDark = !isLight;
    
    // Calculate other properties while we have RGB
    const hsl = hexToHslSafe(hex) || { h: 0, s: 0, l: 0 };
    const luminance = calculateLuminance(rgb.r, rgb.g, rgb.b);
    
    const result = {
      hex,
      rgb,
      hsl,
      brightness: Math.round(brightnessValue),
      brightnessLabel,
      isLight,
      isDark,
      luminance,
      // Additional analysis
      temperature: getColorTemperature(rgb),
      category: getColorCategory(hsl.h, hsl.s),
      accessibility: {
        recommendedTextColor: isLight ? '#000000' : '#FFFFFF',
        contrastLevel: isLight ? 'high' : 'low'
      }
    };
    
    // Cache with automatic eviction
    colorCache.current.set(cacheKey, result);
    
    return result;
  }, []);

  /**
   * Optimized palette contrast analysis - implements your caching strategy
   * Computes luminance once per color, reuses for all pairs
   */
  const analyzePaletteContrast = useCallback((colors, minContrast = 4.5) => {
    if (!colors || colors.length < 2) {
      return { isValid: true, issues: [], stats: {} };
    }

    // Step 1: Compute luminance once for each unique color (your suggestion)
    const luminanceMap = new Map();
    const uniqueColors = [...new Set(colors)];
    
    uniqueColors.forEach(color => {
      const cacheKey = `luminance_${color.toLowerCase()}`;
      
      if (contrastCache.current.has(cacheKey)) {
        luminanceMap.set(color, contrastCache.current.get(cacheKey));
      } else {
        const analysis = analyzeColor(color);
        luminanceMap.set(color, analysis.luminance);
        contrastCache.current.set(cacheKey, analysis.luminance);
      }
    });

    // Step 2: Use cached luminance values for all contrast calculations
    const issues = [];
    const contrastPairs = [];
    
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const color1 = colors[i];
        const color2 = colors[j];
        
        // Use cached luminance (no recalculation!)
        const lum1 = luminanceMap.get(color1);
        const lum2 = luminanceMap.get(color2);
        
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        const contrast = (brightest + 0.05) / (darkest + 0.05);
        
        contrastPairs.push({ color1, color2, contrast });
        
        if (contrast < minContrast) {
          issues.push({
            type: 'low_contrast',
            colors: [color1, color2],
            contrast: Math.round(contrast * 100) / 100,
            required: minContrast,
            suggestion: generateContrastSuggestion(color1, color2, contrast, minContrast)
          });
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      stats: {
        totalColors: colors.length,
        uniqueColors: uniqueColors.length,
        totalComparisons: contrastPairs.length,
        averageContrast: contrastPairs.reduce((sum, pair) => sum + pair.contrast, 0) / contrastPairs.length,
        passedComparisons: contrastPairs.filter(pair => pair.contrast >= minContrast).length
      },
      contrastPairs
    };
  }, [analyzeColor]);

  /**
   * Batch color analysis with intelligent caching
   */
  const analyzePalette = useCallback((colors) => {
    return colors.map(color => analyzeColor(color));
  }, [analyzeColor]);

  /**
   * Optimized color scheme validation
   * Reuses calculations within the function scope
   */
  const validateColorScheme = useCallback((colors, scheme) => {
    if (!colors || colors.length === 0) {
      return { isValid: false, reason: 'No colors provided' };
    }

    // Analyze all colors once (cached)
    const analyses = analyzePalette(colors);
    
    // Reuse analyses for multiple validations
    const harmony = analyzeColorHarmony(analyses, scheme);
    const contrast = analyzePaletteContrast(colors);
    const distribution = analyzeColorDistribution(analyses);
    
    return {
      isValid: harmony.isValid && contrast.isValid && distribution.isBalanced,
      harmony,
      contrast,
      distribution,
      recommendations: generateRecommendations(analyses, scheme)
    };
  }, [analyzePalette, analyzePaletteContrast]);

  /**
   * Get comprehensive cache statistics for monitoring
   */
  const getCacheStats = useCallback(() => {
    const colorStats = colorCache.current.getStats();
    const contrastStats = contrastCache.current.getStats();
    
    return {
      colorCache: colorStats,
      contrastCache: contrastStats,
      combined: {
        totalSize: colorStats.size + contrastStats.size,
        totalMaxSize: colorStats.maxSize + contrastStats.maxSize,
        averageHitRate: ((colorStats.hitRate + contrastStats.hitRate) / 2).toFixed(2),
        totalEvictions: colorStats.evictions + contrastStats.evictions,
        totalExpired: colorStats.expired + contrastStats.expired
      }
    };
  }, []);

  /**
   * Clear all caches (useful for testing or memory management)
   */
  const clearAllCaches = useCallback(() => {
    colorCache.current.clear();
    contrastCache.current.clear();
  }, []);

  return {
    // Optimized functions
    analyzeColor,
    analyzePalette,
    analyzePaletteContrast,
    validateColorScheme,
    
    // Cache management
    getCacheStats,
    clearAllCaches
  };
};

// ============================================================================
// Helper Functions - Optimized implementations
// ============================================================================


/**
 * Calculate luminance (reuses RGB values)
 */
function calculateLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Get brightness label from numeric value (reuses calculation)
 */
function getBrightnessLabel(brightness) {
  if (brightness > 200) return 'very light';
  if (brightness > 150) return 'light';
  if (brightness > 100) return 'medium';
  if (brightness > 50) return 'dark';
  return 'very dark';
}

/**
 * Get color temperature (reuses RGB values)
 */
function getColorTemperature(rgb) {
  const { r, g, b } = rgb;
  const ratio = (r + g * 0.5) / (b + 1);
  
  if (ratio > 1.5) return 'warm';
  if (ratio < 0.8) return 'cool';
  return 'neutral';
}

/**
 * Get color category (reuses HSL values)
 */
function getColorCategory(h, s) {
  if (s < 10) return 'grayscale';
  
  if (h >= 0 && h < 30) return 'red';
  if (h >= 30 && h < 60) return 'orange';
  if (h >= 60 && h < 90) return 'yellow';
  if (h >= 90 && h < 150) return 'green';
  if (h >= 150 && h < 210) return 'cyan';
  if (h >= 210 && h < 270) return 'blue';
  if (h >= 270 && h < 330) return 'purple';
  return 'red';
}

/**
 * Analyze color harmony (reuses analyses)
 */
function analyzeColorHarmony(analyses, scheme) {
  const categories = analyses.map(a => a.category);
  const temperatures = analyses.map(a => a.temperature);
  
  // Scheme-specific validation
  switch (scheme) {
    case 'monochromatic':
      const uniqueCategories = new Set(categories);
      return {
        isValid: uniqueCategories.size === 1,
        reason: uniqueCategories.size === 1 ? 'All colors from same hue family' : 'Colors should be from same hue family'
      };
      
    case 'complementary':
      return {
        isValid: categories.length === 2,
        reason: 'Complementary schemes should have exactly 2 colors'
      };
      
    default:
      return { isValid: true, reason: 'No specific harmony rules for this scheme' };
  }
}

/**
 * Analyze color distribution (reuses analyses)
 */
function analyzeColorDistribution(analyses) {
  const lightColors = analyses.filter(a => a.isLight).length;
  const darkColors = analyses.filter(a => a.isDark).length;
  const total = analyses.length;
  
  const lightRatio = lightColors / total;
  const isBalanced = lightRatio >= 0.3 && lightRatio <= 0.7;
  
  return {
    isBalanced,
    lightColors,
    darkColors,
    lightRatio: Math.round(lightRatio * 100),
    recommendation: isBalanced ? 'Good balance' : 
      lightRatio < 0.3 ? 'Consider adding lighter colors' : 'Consider adding darker colors'
  };
}

/**
 * Generate contrast improvement suggestions
 */
function generateContrastSuggestion(color1, color2, currentContrast, minContrast) {
  const needed = minContrast - currentContrast;
  
  if (needed < 1) {
    return 'Slightly adjust lightness of one color';
  } else if (needed < 2) {
    return 'Significantly adjust lightness or choose different colors';
  } else {
    return 'Colors are too similar - choose colors with greater lightness difference';
  }
}

/**
 * Generate recommendations (reuses analyses)
 */
function generateRecommendations(analyses, scheme) {
  const recommendations = [];
  
  // Check brightness distribution
  const lightCount = analyses.filter(a => a.isLight).length;
  const darkCount = analyses.filter(a => a.isDark).length;
  
  if (lightCount === 0) {
    recommendations.push('Add some lighter colors for better balance');
  }
  if (darkCount === 0) {
    recommendations.push('Add some darker colors for better contrast');
  }
  
  // Check color diversity
  const categories = new Set(analyses.map(a => a.category));
  if (categories.size === 1 && scheme !== 'monochromatic') {
    recommendations.push('Consider adding colors from different hue families');
  }
  
  return recommendations;
}

