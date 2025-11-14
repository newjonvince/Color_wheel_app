// screens/ColorWheelScreen/useOptimizedColorWheelState.js - Enhanced state management for FullColorWheel

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { getColorScheme, hexToHsl, hslToHex } from '../../utils/optimizedColor';
import { useThrottledCallbacks } from '../../utils/throttledCallbacks';
import { useOptimizedColorProcessing } from '../../hooks/useOptimizedColorProcessing';
import { DEFAULT_SCHEME, DEFAULT_COLOR, generateRandomColor, validateHSL } from './constants';

export const useOptimizedColorWheelState = (options = {}) => {
  const {
    throttleFps = 30,
    immediateFps = 60,
    onColorsChange: externalOnColorsChange,
    onHexChange: externalOnHexChange,
    onActiveHandleChange: externalOnActiveHandleChange,
    wheelRef,
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
    analyzeColor = null,
    analyzePalette = null,
    analyzePaletteContrast = null,
    validateColorScheme = null,
    getCacheStats = null
  } = useOptimizedColorProcessing();

  // Set up throttled callbacks for performance
  const {
    onGestureStart,
    onGestureChange,
    onGestureEnd,
    handleColorUpdate,
    forceUpdate,
  } = useThrottledCallbacks({
    onColorsChange: useCallback((colors) => {
      setPalette(colors);
      externalOnColorsChange?.(colors);
    }, [externalOnColorsChange]),
    
    onHexChange: useCallback((hex) => {
      setSelectedColor(hex);
      setBaseHex(hex);
      externalOnHexChange?.(hex);
    }, [externalOnHexChange]),
    
    selectedFollowsActive,
    throttleFps,
    immediateFps,
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
  const handleColorsChange = useCallback((colors, phase = 'change') => {
    // Ensure colors is an array and filter to valid hex strings
    const list = Array.isArray(colors) ? colors : [];
    const hexColors = list.filter(color => 
      typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color)
    );

    // Ensure palette state is updated with validated hex strings
    setPalette(hexColors);
    
    // Call the throttled gesture handler
    onGestureChange(hexColors, activeIdx);

    if (phase !== 'end') {
      // During drag: skip heavy analysis for performance
      return;
    }

    // Enhanced optimization with caching and analysis - only at gesture end
    try {
      if (analyzeColor && analyzePalette && analyzePaletteContrast && validateColorScheme) {
        const paletteAnalysis = analyzePalette(hexColors);
        const contrastAnalysis = analyzePaletteContrast(hexColors);
        const schemeValidation = validateColorScheme(hexColors, selectedScheme);
        
        if (__DEV__ && getCacheStats) {
          const cacheStats = getCacheStats();
          console.log('🎨 Color Processing Stats:', {
            paletteSize: hexColors.length,
            cacheStats,
            analysis: { paletteAnalysis, contrastAnalysis, schemeValidation }
          });
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Optimization error (fallback to basic mode):', error);
      }
    }
  }, [onGestureChange, activeIdx, analyzePalette, analyzePaletteContrast, validateColorScheme, selectedScheme, getCacheStats]);

  const handleHexChange = useCallback((hex) => {
    // Validate hex string format
    if (typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      if (__DEV__) {
        console.warn('⚠️ Invalid hex color provided to handleHexChange:', hex);
      }
      return;
    }
    
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
    
    // Call external callback if provided
    if (externalOnActiveHandleChange) {
      externalOnActiveHandleChange(index);
    }
    
    // Update selected color immediately when active handle changes
    if (selectedFollowsActive && palette[index]) {
      setSelectedColor(palette[index]);
      setBaseHex(palette[index]);
    }
  }, [externalOnActiveHandleChange, selectedFollowsActive, palette]);

  // HSL input handlers (enhanced with immediate updates)
  const updateHslInput = useCallback((component, value) => {
    setHslInputs(prev => ({ ...prev, [component]: value }));
  }, []);

  const applyHslInputs = useCallback(() => {
    const { h, s, l } = validateHSL(hslInputs.h, hslInputs.s, hslInputs.l);
    const newHex = hslToHex(h, s, l);
    
    // Force immediate update for HSL input changes
    const newPalette = [...palette];
    newPalette[activeIdx] = newHex;
    
    forceUpdate(newPalette, activeIdx);
    
    const wheel = wheelRef?.current;
    if (wheel?.setHandleHSL) {
      wheel.setHandleHSL(activeIdx, h, s, l);
    }
  }, [hslInputs, palette, activeIdx, forceUpdate, wheelRef]);

  const updateColorWheelLive = useCallback((component, value) => {
    const newInputs = { ...hslInputs, [component]: value };
    const { h, s, l } = validateHSL(newInputs.h, newInputs.s, newInputs.l);
    const newHex = hslToHex(h, s, l);
    
    // Immediate visual feedback
    setSelectedColor(newHex);
    setBaseHex(newHex);
    
    const wheel = wheelRef?.current;
    if (wheel?.setHandleHSL) {
      wheel.setHandleHSL(activeIdx, h, s, l);
    }
  }, [hslInputs, activeIdx, wheelRef]);

  // Scheme and control handlers (enhanced with performance awareness)
  const resetScheme = useCallback(() => {
    const newPalette = [baseHex];
    setPalette(newPalette);
    forceUpdate(newPalette, 0);
  }, [baseHex, forceUpdate]);

  const randomize = useCallback(() => {
    const randomHsl = generateRandomColor();
    const newColor = hslToHex(randomHsl.h, randomHsl.s, randomHsl.l);
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
      // Validate and filter extracted colors to ensure they are hex strings
      const validColors = extractedColors
        .slice(0, 5)
        .filter(color => typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color));
      
      if (validColors.length > 0) {
        setPalette(validColors);
        setSelectedColor(validColors[0]);
        setBaseHex(validColors[0]);
        
        forceUpdate(validColors, 0);
      } else if (__DEV__) {
        console.warn('⚠️ No valid hex colors extracted from:', extractedColors);
      }
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
      setActiveIdx(index);
    }, []),

    onGestureEnd,

    // Utility functions
    forceUpdate
  };
};
