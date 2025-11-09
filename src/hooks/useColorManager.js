// hooks/useColorManager.js - Comprehensive color management hook
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  normalizeHexColor, 
  generateColorScheme, 
  analyzeColor, 
  getComplementaryOutfitColors,
  COLOR_SCHEMES 
} from '../utils/colorUtils';
import { 
  validateSingleColor, 
  validateColorPalette, 
  validateColorScheme 
} from '../utils/colorValidation';

/**
 * Enhanced color management hook with validation, schemes, and analysis
 */
export const useColorManager = (initialColor = '#FF6B6B', initialScheme = 'complementary') => {
  // Core state
  const [baseColor, setBaseColor] = useState(() => normalizeHexColor(initialColor));
  const [currentScheme, setCurrentScheme] = useState(initialScheme);
  const [customColors, setCustomColors] = useState([]);
  const [colorHistory, setColorHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  
  // Performance optimization
  const validationCache = useRef(new Map());
  const schemeCache = useRef(new Map());
  
  // Clear caches when base color changes
  useEffect(() => {
    validationCache.current.clear();
    schemeCache.current.clear();
  }, [baseColor]);
  
  /**
   * Memoized color analysis
   */
  const colorAnalysis = useMemo(() => {
    try {
      return analyzeColor(baseColor);
    } catch (error) {
      console.error('Color analysis error:', error);
      return null;
    }
  }, [baseColor]);
  
  /**
   * Memoized color scheme generation
   */
  const generatedScheme = useMemo(() => {
    const cacheKey = `${baseColor}-${currentScheme}`;
    
    if (schemeCache.current.has(cacheKey)) {
      return schemeCache.current.get(cacheKey);
    }
    
    try {
      const scheme = generateColorScheme(baseColor, currentScheme);
      schemeCache.current.set(cacheKey, scheme);
      return scheme;
    } catch (error) {
      console.error('Scheme generation error:', error);
      return [baseColor];
    }
  }, [baseColor, currentScheme]);
  
  /**
   * Memoized fashion recommendations
   */
  const fashionRecommendations = useMemo(() => {
    try {
      return getComplementaryOutfitColors(baseColor);
    } catch (error) {
      console.error('Fashion recommendations error:', error);
      return { primary: baseColor, neutral: [] };
    }
  }, [baseColor]);
  
  /**
   * Validate and update base color
   */
  const updateBaseColor = useCallback((newColor, options = {}) => {
    setIsLoading(true);
    setErrors([]);
    setWarnings([]);
    setSuggestions([]);
    
    try {
      // Validate color
      const validation = validateSingleColor(newColor, {
        checkAccessibility: options.checkAccessibility,
        fashionContext: true,
        backgroundColor: options.backgroundColor
      });
      
      if (!validation.isValid) {
        setErrors(validation.errors);
        setIsLoading(false);
        return false;
      }
      
      // Set warnings and suggestions
      setWarnings(validation.warnings);
      setSuggestions(validation.suggestions);
      
      // Normalize and update color
      const normalizedColor = normalizeHexColor(newColor);
      
      // Add to history if different from current
      if (normalizedColor !== baseColor) {
        setColorHistory(prev => {
          const newHistory = [normalizedColor, ...prev.filter(c => c !== normalizedColor)];
          return newHistory.slice(0, 20); // Keep last 20 colors
        });
      }
      
      setBaseColor(normalizedColor);
      setIsLoading(false);
      return true;
      
    } catch (error) {
      console.error('Update base color error:', error);
      setErrors(['Failed to update color']);
      setIsLoading(false);
      return false;
    }
  }, [baseColor]);
  
  /**
   * Update color scheme with validation
   */
  const updateColorScheme = useCallback((newScheme) => {
    try {
      if (!Object.values(COLOR_SCHEMES).includes(newScheme)) {
        setErrors([`Invalid color scheme: ${newScheme}`]);
        return false;
      }
      
      // Validate the scheme with current base color
      const testScheme = generateColorScheme(baseColor, newScheme);
      const validation = validateColorScheme(baseColor, newScheme, testScheme);
      
      setWarnings(validation.warnings);
      setSuggestions(validation.suggestions);
      
      setCurrentScheme(newScheme);
      return true;
      
    } catch (error) {
      console.error('Update color scheme error:', error);
      setErrors(['Failed to update color scheme']);
      return false;
    }
  }, [baseColor]);
  
  /**
   * Add custom color to palette
   */
  const addCustomColor = useCallback((color) => {
    try {
      const validation = validateSingleColor(color, { fashionContext: true });
      
      if (!validation.isValid) {
        setErrors(validation.errors);
        return false;
      }
      
      const normalizedColor = normalizeHexColor(color);
      
      setCustomColors(prev => {
        if (prev.includes(normalizedColor)) {
          return prev; // Don't add duplicates
        }
        return [...prev, normalizedColor].slice(0, 10); // Limit to 10 custom colors
      });
      
      return true;
      
    } catch (error) {
      console.error('Add custom color error:', error);
      setErrors(['Failed to add custom color']);
      return false;
    }
  }, []);
  
  /**
   * Remove custom color
   */
  const removeCustomColor = useCallback((color) => {
    const normalizedColor = normalizeHexColor(color);
    setCustomColors(prev => prev.filter(c => c !== normalizedColor));
  }, []);
  
  /**
   * Add color to favorites
   */
  const addToFavorites = useCallback((color) => {
    try {
      const normalizedColor = normalizeHexColor(color);
      
      setFavorites(prev => {
        if (prev.includes(normalizedColor)) {
          return prev; // Don't add duplicates
        }
        return [...prev, normalizedColor].slice(0, 20); // Limit to 20 favorites
      });
      
      return true;
      
    } catch (error) {
      console.error('Add to favorites error:', error);
      return false;
    }
  }, []);
  
  /**
   * Remove from favorites
   */
  const removeFromFavorites = useCallback((color) => {
    const normalizedColor = normalizeHexColor(color);
    setFavorites(prev => prev.filter(c => c !== normalizedColor));
  }, []);
  
  /**
   * Generate random color
   */
  const generateRandomColor = useCallback(() => {
    const h = Math.floor(Math.random() * 360);
    const s = 60 + Math.floor(Math.random() * 40); // 60-100%
    const l = 45 + Math.floor(Math.random() * 20); // 45-65%
    
    // Convert HSL to hex
    const hslToHex = (h, s, l) => {
      l /= 100;
      const a = s * Math.min(l, 1 - l) / 100;
      const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };
    
    const randomColor = hslToHex(h, s, l);
    updateBaseColor(randomColor);
  }, [updateBaseColor]);
  
  /**
   * Get color from history
   */
  const selectFromHistory = useCallback((index) => {
    if (index >= 0 && index < colorHistory.length) {
      updateBaseColor(colorHistory[index]);
    }
  }, [colorHistory, updateBaseColor]);
  
  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    setColorHistory([]);
  }, []);
  
  /**
   * Validate current palette
   */
  const validateCurrentPalette = useCallback(() => {
    const allColors = [baseColor, ...generatedScheme, ...customColors];
    return validateColorPalette(allColors, {
      checkHarmony: true,
      checkContrast: true,
      fashionContext: true
    });
  }, [baseColor, generatedScheme, customColors]);
  
  /**
   * Export color data
   */
  const exportColorData = useCallback(() => {
    return {
      baseColor,
      scheme: currentScheme,
      generatedColors: generatedScheme,
      customColors,
      favorites,
      history: colorHistory,
      analysis: colorAnalysis,
      fashionRecommendations,
      timestamp: new Date().toISOString()
    };
  }, [
    baseColor, 
    currentScheme, 
    generatedScheme, 
    customColors, 
    favorites, 
    colorHistory, 
    colorAnalysis, 
    fashionRecommendations
  ]);
  
  /**
   * Import color data
   */
  const importColorData = useCallback((data) => {
    try {
      if (data.baseColor) {
        updateBaseColor(data.baseColor);
      }
      if (data.scheme) {
        updateColorScheme(data.scheme);
      }
      if (Array.isArray(data.customColors)) {
        setCustomColors(data.customColors.slice(0, 10));
      }
      if (Array.isArray(data.favorites)) {
        setFavorites(data.favorites.slice(0, 20));
      }
      if (Array.isArray(data.history)) {
        setColorHistory(data.history.slice(0, 20));
      }
      return true;
    } catch (error) {
      console.error('Import color data error:', error);
      setErrors(['Failed to import color data']);
      return false;
    }
  }, [updateBaseColor, updateColorScheme]);
  
  /**
   * Reset to defaults
   */
  const resetToDefaults = useCallback(() => {
    setBaseColor(normalizeHexColor(initialColor));
    setCurrentScheme(initialScheme);
    setCustomColors([]);
    setErrors([]);
    setWarnings([]);
    setSuggestions([]);
  }, [initialColor, initialScheme]);
  
  return {
    // Core state
    baseColor,
    currentScheme,
    generatedScheme,
    customColors,
    favorites,
    colorHistory,
    
    // Analysis and recommendations
    colorAnalysis,
    fashionRecommendations,
    
    // UI state
    isLoading,
    errors,
    warnings,
    suggestions,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    hasSuggestions: suggestions.length > 0,
    
    // Actions
    updateBaseColor,
    updateColorScheme,
    addCustomColor,
    removeCustomColor,
    addToFavorites,
    removeFromFavorites,
    generateRandomColor,
    selectFromHistory,
    clearHistory,
    
    // Utilities
    validateCurrentPalette,
    exportColorData,
    importColorData,
    resetToDefaults,
    
    // Available schemes
    availableSchemes: Object.values(COLOR_SCHEMES)
  };
};

export default useColorManager;
