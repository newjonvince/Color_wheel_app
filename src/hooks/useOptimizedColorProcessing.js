// hooks/useOptimizedColorProcessing.js - Practical caching implementation
// Demonstrates your exact optimization strategy with reuse and caching

import { useState, useCallback, useMemo, useRef } from 'react';
import { hexToRgb, hexToHsl, hslToHex } from '../utils/optimizedColor';

/**
 * Custom hook that implements your exact caching strategy
 * - Reuses calculation results within functions
 * - Caches across calls with Map-based memoization
 * - Eliminates redundant HEX→RGB conversions
 */
export const useOptimizedColorProcessing = () => {
  // Module-level cache for frequently used conversions
  const colorCache = useRef(new Map());
  const contrastCache = useRef(new Map());
  
  // Clear cache when it gets too large (prevent memory leaks)
  const clearCacheIfNeeded = useCallback(() => {
    if (colorCache.current.size > 500) {
      // Keep only the most recent 250 entries
      const entries = Array.from(colorCache.current.entries());
      colorCache.current.clear();
      entries.slice(-250).forEach(([key, value]) => {
        colorCache.current.set(key, value);
      });
    }
  }, []);

  /**
   * Optimized analyzeColor - implements your exact strategy
   * Computes brightness once, derives all flags from it
   */
  const analyzeColor = useCallback((hex) => {
    // Check cache first
    const cacheKey = hex.toLowerCase();
    if (colorCache.current.has(cacheKey)) {
      return colorCache.current.get(cacheKey);
    }

    // Single HEX→RGB conversion (not three!)
    const rgb = hexToRgb(hex);
    
    // Calculate brightness once and reuse (your exact suggestion)
    const brightnessValue = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    
    // Derive all brightness-related properties from single calculation
    const brightnessLabel = getBrightnessLabel(brightnessValue);
    const isLight = brightnessValue > 128;
    const isDark = !isLight;
    
    // Calculate other properties while we have RGB
    const hsl = hexToHsl(hex);
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
    
    // Cache the result
    clearCacheIfNeeded();
    colorCache.current.set(cacheKey, result);
    
    return result;
  }, [clearCacheIfNeeded]);

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
   * Get cache statistics for monitoring
   */
  const getCacheStats = useCallback(() => {
    return {
      colorCacheSize: colorCache.current.size,
      contrastCacheSize: contrastCache.current.size,
      totalCacheSize: colorCache.current.size + contrastCache.current.size
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

export default useOptimizedColorProcessing;
