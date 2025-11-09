// screens/ColorWheelScreen/useOptimizedColorWheelState.js - Performance-enhanced state hook
// Drop-in replacement for useColorWheelState with optimized color processing

import { useState, useCallback, useEffect, useMemo } from 'react';
import { hexToHsl, hslToHex } from '../../utils/optimizedColor';
import { SCHEME_COUNTS, SCHEME_OFFSETS } from '../../components/FullColorWheel';
import { DEFAULT_COLOR, DEFAULT_SCHEME, validateHSL, generateRandomColor, mod } from './constants';
import { useThrottledCallbacks } from '../../utils/throttledCallbacks';
import { useOptimizedColorProcessing } from '../../hooks/useOptimizedColorProcessing';

export const useOptimizedColorWheelState = (options = {}) => {
  const {
    throttleFps = 30,
    immediateFps = 60,
    onColorsChange: externalOnColorsChange,
    onHexChange: externalOnHexChange,
    onActiveHandleChange: externalOnActiveHandleChange,
  } = options;

  // Core state (same as original)
  const [selectedScheme, setSelectedScheme] = useState(DEFAULT_SCHEME);
  const [palette, setPalette] = useState([DEFAULT_COLOR]);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [baseHex, setBaseHex] = useState(DEFAULT_COLOR);
  const [linked, setLinked] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedFollowsActive, setSelectedFollowsActive] = useState(true);
  const [showExtractor, setShowExtractor] = useState(false);

  // HSL input state (same as original)
  const hsl = useMemo(() => hexToHsl(selectedColor) || { h: 0, s: 100, l: 50 }, [selectedColor]);
  const [hslInputs, setHslInputs] = useState({
    h: String(Math.round(hsl.h)),
    s: String(Math.round(hsl.s)),
    l: String(Math.round(hsl.l)),
  });

  // Set up optimized color processing with caching
  const {
    analyzeColor,
    analyzePalette,
    analyzePaletteContrast,
    validateColorScheme,
    getCacheStats
  } = useOptimizedColorProcessing();

  // Set up throttled callbacks for performance
  const {
    onGestureStart,
    onGestureChange,
    onGestureEnd,
    handleColorUpdate,
    forceUpdate
  } = useThrottledCallbacks({
    onColorsChange: useCallback((colors) => {
      setPalette(colors);
      if (externalOnColorsChange) {
        externalOnColorsChange(colors);
      }
    }, [externalOnColorsChange]),
    
    onHexChange: useCallback((hex) => {
      setSelectedColor(hex);
      setBaseHex(hex);
      if (externalOnHexChange) {
        externalOnHexChange(hex);
      }
    }, [externalOnHexChange]),
    
    selectedFollowsActive,
    throttleFps,
    immediateFps
  });

  // Enhanced active handle change with throttling awareness
  const handleActiveHandleChange = useCallback((index) => {
    setActiveIdx(index);
    if (externalOnActiveHandleChange) {
      externalOnActiveHandleChange(index);
    }
  }, [externalOnActiveHandleChange]);

  // Sync HSL inputs when selected color changes (same as original)
  useEffect(() => {
    const { h = 0, s = 100, l = 50 } = hexToHsl(selectedColor) || {};
    setHslInputs({
      h: String(Math.round(h)),
      s: String(Math.round(s)),
      l: String(Math.round(l)),
    });
  }, [selectedColor]);

  // Enhanced color wheel callbacks with performance optimization
  const handleColorsChange = useCallback((colors) => {
    try {
      // Optimized palette analysis with caching (with error handling)
      const paletteAnalysis = analyzePalette ? analyzePalette(colors) : null;
      const contrastAnalysis = analyzePaletteContrast ? analyzePaletteContrast(colors) : null;
      const schemeValidation = validateColorScheme ? validateColorScheme(colors, selectedScheme) : null;
      
      // Log performance insights (development only)
      if (__DEV__) {
        const cacheStats = getCacheStats ? getCacheStats() : null;
        console.log('🎨 Palette Analysis:', {
          colors: colors.length,
          cacheStats,
          contrastIssues: contrastAnalysis?.issues?.length || 0,
          schemeValid: schemeValidation?.isValid || false
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Optimization error (fallback to basic mode):', error);
      }
    }
    
    // Ensure palette state is updated for API calls
    setPalette(colors);
    
    // Call the throttled gesture handler
    onGestureChange(colors, activeIdx);
  }, [onGestureChange, activeIdx, analyzePalette, analyzePaletteContrast, validateColorScheme, selectedScheme, getCacheStats]);

  const handleHexChange = useCallback((hex) => {
    try {
      // Optimized single color analysis with caching (with error handling)
      const colorAnalysis = analyzeColor ? analyzeColor(hex) : null;
      
      // Log color insights (development only)
      if (__DEV__ && colorAnalysis) {
        console.log('🎯 Color Analysis:', {
          hex,
          brightness: colorAnalysis.brightness,
          isLight: colorAnalysis.isLight,
          category: colorAnalysis.category,
          temperature: colorAnalysis.temperature
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Color analysis error (fallback to basic mode):', error);
      }
    }
    
    // Update local state immediately for UI responsiveness
    setSelectedColor(hex);
    setBaseHex(hex);
  }, [analyzeColor]);

  const handleActiveHandleChangeInternal = useCallback((index) => {
    setActiveIdx(index);
    handleActiveHandleChange(index);
    
    // Update selected color immediately when active handle changes
    if (selectedFollowsActive && palette[index]) {
      setSelectedColor(palette[index]);
      setBaseHex(palette[index]);
    }
  }, [handleActiveHandleChange, selectedFollowsActive, palette]);

  // HSL input handlers (enhanced with immediate updates)
  const updateHslInput = useCallback((component, value) => {
    setHslInputs(prev => ({ ...prev, [component]: value }));
  }, []);

  const applyHslInputs = useCallback((wheelRef) => {
    const { h, s, l } = validateHSL(hslInputs.h, hslInputs.s, hslInputs.l);
    const newHex = hslToHex(h, s, l);
    
    // Force immediate update for HSL input changes
    const newPalette = [...palette];
    newPalette[activeIdx] = newHex;
    
    forceUpdate(newPalette, activeIdx);
    
    if (wheelRef?.current?.updateColor) {
      wheelRef.current.updateColor(activeIdx, h, s / 100, l / 100);
    }
  }, [hslInputs, palette, activeIdx, forceUpdate]);

  const updateColorWheelLive = useCallback((component, value, wheelRef) => {
    const newInputs = { ...hslInputs, [component]: value };
    const { h, s, l } = validateHSL(newInputs.h, newInputs.s, newInputs.l);
    const newHex = hslToHex(h, s, l);
    
    // Immediate visual feedback
    setSelectedColor(newHex);
    setBaseHex(newHex);
    
    if (wheelRef?.current?.updateColor) {
      wheelRef.current.updateColor(activeIdx, h, s / 100, l / 100);
    }
  }, [hslInputs, activeIdx]);

  // Scheme and control handlers (enhanced with performance awareness)
  const resetScheme = useCallback(() => {
    const newPalette = [baseHex];
    setPalette(newPalette);
    forceUpdate(newPalette, 0);
  }, [baseHex, forceUpdate]);

  const randomize = useCallback(() => {
    const newColor = generateRandomColor();
    const newPalette = [newColor];
    
    setSelectedColor(newColor);
    setBaseHex(newColor);
    setPalette(newPalette);
    
    forceUpdate(newPalette, 0);
  }, [forceUpdate]);

  // Toggle handlers (same as original)
  const toggleLinked = useCallback(() => {
    setLinked(prev => !prev);
  }, []);

  const toggleSelectedFollowsActive = useCallback(() => {
    setSelectedFollowsActive(prev => !prev);
  }, []);

  // Extractor handlers (same as original)
  const openExtractor = useCallback(() => {
    setShowExtractor(true);
  }, []);

  const closeExtractor = useCallback(() => {
    setShowExtractor(false);
  }, []);

  const handleExtractorComplete = useCallback((extractedColors) => {
    if (extractedColors && extractedColors.length > 0) {
      const newPalette = extractedColors.slice(0, 5);
      setPalette(newPalette);
      setSelectedColor(newPalette[0]);
      setBaseHex(newPalette[0]);
      
      forceUpdate(newPalette, 0);
    }
    setShowExtractor(false);
  }, [forceUpdate]);

  // Return enhanced state and handlers
  return {
    // State (same as original)
    selectedScheme,
    setSelectedScheme,
    palette,
    selectedColor,
    baseHex,
    linked,
    activeIdx,
    selectedFollowsActive,
    showExtractor,
    hslInputs,

    // Enhanced handlers with performance optimization
    updateHslInput,
    applyHslInputs,
    updateColorWheelLive,
    resetScheme,
    randomize,
    toggleLinked,
    toggleSelectedFollowsActive,
    openExtractor,
    closeExtractor,
    handleExtractorComplete,

    // Performance-optimized color wheel callbacks
    handleColorsChange,
    handleHexChange,
    handleActiveHandleChange: handleActiveHandleChangeInternal,

    // Gesture lifecycle callbacks for enhanced performance
    onGestureStart: useCallback((colors, index) => {
      onGestureStart(colors, index);
      setActiveIdx(index);
    }, [onGestureStart]),

    onGestureEnd: useCallback((colors, index) => {
      onGestureEnd(colors, index);
    }, [onGestureEnd]),

    // Utility functions
    forceUpdate: useCallback((colors, index) => {
      forceUpdate(colors, index);
    }, [forceUpdate])
  };
};
