// screens/ColorWheelScreen/useOptimizedColorWheelState.js - Enhanced state management for FullColorWheel

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Constants from 'expo-constants';
import { analyzeColor, getColorScheme, getCacheStats, hexToHsl, hslToHex } from '../../utils/optimizedColor';
import { useThrottledCallbacks } from '../../utils/throttledCallbacks';
import { useOptimizedColorProcessing } from '../../hooks/useOptimizedColorProcessing';
import { DEFAULT_SCHEME, DEFAULT_COLOR, generateRandomColor, validateHSL } from './constants';
import { LAYOUT } from '../../constants/layout';
import { isValidHex6, filterValidHexColors } from '../../utils/colorValidation';
import { reportError, ERROR_EVENTS } from '../../utils/errorTelemetry';

// Production-ready configuration
const extra = Constants.expoConfig?.extra || {};
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

export const useOptimizedColorWheelState = (options = {}) => {
  const {
    throttleFps = LAYOUT.THROTTLE_FPS,
    immediateFps = LAYOUT.IMMEDIATE_FPS,
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

  // ✅ SAFER: Create fallback functions to prevent crashes
  const createSafeFallbacks = () => ({
    analyzeColor: (color) => ({ 
      dominantColors: [], 
      colorHarmony: 'unknown', 
      temperature: 'neutral',
      accessibility: { contrast: 0, wcagLevel: 'fail' }
    }),
    analyzePalette: (palette) => ({ 
      harmony: 'unknown', 
      balance: 0, 
      diversity: 0,
      dominantHues: [],
      temperature: 'neutral'
    }),
    analyzePaletteContrast: (palette) => ({ 
      averageContrast: 0, 
      minContrast: 0, 
      maxContrast: 0,
      wcagCompliance: 'fail',
      contrastPairs: []
    }),
    validateColorScheme: (palette, scheme) => ({ 
      isValid: false, 
      score: 0, 
      suggestions: [],
      compliance: 'fail'
    }),
    getCacheStats: () => ({ 
      hits: 0, 
      misses: 0, 
      size: 0,
      hitRate: 0
    })
  });

  // ✅ SAFER: Safe destructuring with comprehensive fallbacks
  let colorProcessing;
  try {
    colorProcessing = useOptimizedColorProcessing();
  } catch (error) {
    console.error('🚨 useOptimizedColorProcessing hook failed:', error);
    colorProcessing = null;
  }

  // Use fallbacks if hook failed or returned invalid data
  const safeFallbacks = createSafeFallbacks();
  const safeColorProcessing = colorProcessing && typeof colorProcessing === 'object' 
    ? colorProcessing 
    : safeFallbacks;

  const {
    analyzeColor = safeFallbacks.analyzeColor,
    analyzePalette = safeFallbacks.analyzePalette,
    analyzePaletteContrast = safeFallbacks.analyzePaletteContrast,
    validateColorScheme = safeFallbacks.validateColorScheme,
    getCacheStats = safeFallbacks.getCacheStats
  } = safeColorProcessing;

  // ✅ SAFER: Use refs to track latest values and prevent race conditions
  const latestPaletteRef = useRef([]);
  const latestActiveIdxRef = useRef(0);
  
  // ✅ Cleanup refs on unmount to prevent GC issues
  useEffect(() => {
    return () => {
      // Clear large array refs to help GC
      if (latestPaletteRef.current && latestPaletteRef.current.length > 0) {
        latestPaletteRef.current = [];
      }
      latestActiveIdxRef.current = 0;
    };
  }, []);

  // ✅ SAFER: Set up throttled callbacks with error handling
  const {
    onGestureStart,
    onGestureChange,
    onGestureEnd,
    handleColorUpdate,
    forceUpdate,
  } = useThrottledCallbacks({
    onColorsChange: useCallback((colors) => {
      try {
        if (!Array.isArray(colors)) {
          console.warn('⚠️ onColorsChange received non-array:', colors);
          return;
        }
        setPalette(colors);
        externalOnColorsChange?.(colors);
      } catch (error) {
        console.error('❌ Error in onColorsChange:', error);
        reportError(ERROR_EVENTS.COLOR_WHEEL_GESTURE_FAILED, error, {
          colorsCount: colors?.length || 0,
          context: 'onColorsChange_callback',
        });
      }
    }, [setPalette, externalOnColorsChange]),
    
    onHexChange: useCallback((hex) => {
      try {
        if (!isValidHex6(hex)) {
          console.warn('⚠️ onHexChange received invalid hex:', hex);
          return;
        }
        setSelectedColor(hex);
        setBaseHex(hex);
        externalOnHexChange?.(hex);
      } catch (error) {
        console.error('❌ Error in onHexChange:', error);
        reportError(ERROR_EVENTS.COLOR_WHEEL_GESTURE_FAILED, error, {
          hex: hex,
          context: 'onHexChange_callback',
        });
      }
    }, [setSelectedColor, setBaseHex, externalOnHexChange]),
    
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

  // ✅ SAFER: Enhanced color wheel callbacks with race condition prevention
  const handleColorsChange = useCallback((colors, phase = 'change') => {
    // Ensure colors is an array and filter to valid hex strings
    const list = Array.isArray(colors) ? colors : [];
    const hexColors = filterValidHexColors(list);

    // Update refs immediately (synchronous)
    latestPaletteRef.current = hexColors;

    // Update state (async)
    setPalette(hexColors);
    
    // Use ref value for gesture callback to ensure consistency
    onGestureChange(hexColors, latestActiveIdxRef.current);

    // ✅ IMPROVED: Smart phase detection for components that don't pass phase
    // If no explicit phase and colors haven't changed much, assume it's during gesture
    const shouldSkipAnalysis = phase !== 'end' && phase !== 'complete';
    
    if (shouldSkipAnalysis) {
      // During drag: skip heavy analysis for performance
      if (IS_DEBUG_MODE) {
        console.log('🎯 Skipping heavy analysis during gesture phase:', phase);
      }
      return;
    }

    // At gesture end, use ref to get latest committed values
    const currentPalette = latestPaletteRef.current;
    const currentActiveIdx = latestActiveIdxRef.current;

    // Enhanced optimization with caching and analysis - only at gesture end
    try {
      // ✅ SAFER: Always call functions since we have fallbacks
      const paletteAnalysis = typeof analyzePalette === 'function' 
        ? analyzePalette(currentPalette) 
        : safeFallbacks.analyzePalette(currentPalette);
        
      const contrastAnalysis = typeof analyzePaletteContrast === 'function'
        ? analyzePaletteContrast(currentPalette)
        : safeFallbacks.analyzePaletteContrast(currentPalette);
        
      const schemeValidation = typeof validateColorScheme === 'function'
        ? validateColorScheme(currentPalette, selectedScheme)
        : safeFallbacks.validateColorScheme(currentPalette, selectedScheme);
        
      // Log color processing stats for production performance monitoring
      if (typeof getCacheStats === 'function') {
          try {
            const cacheStats = getCacheStats();
            if (IS_DEBUG_MODE) {
              console.log(' Color Processing Stats:', {
                paletteSize: currentPalette.length,
                cacheHits: cacheStats.hits,
                cacheMisses: cacheStats.misses,
                hitRate: `${Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)}%`
              });
            }
          } catch (statsError) {
            console.warn('Failed to get cache stats:', statsError);
          }
        }
    } catch (error) {
      // Always log optimization errors for production debugging
      console.warn('⚠️ Optimization error (fallback to basic mode):', error);
    }
  }, [onGestureChange, analyzePalette, analyzePaletteContrast, validateColorScheme, selectedScheme, getCacheStats]);

  // ✅ Also update activeIdx ref when it changes
  useEffect(() => {
    latestActiveIdxRef.current = activeIdx;
  }, [activeIdx]);

  const handleHexChange = useCallback((hex) => {
    // Validate hex string format
    if (!isValidHex6(hex)) {
      // Always log invalid hex colors for production debugging
      console.warn('⚠️ Invalid hex color provided to handleHexChange:', hex);
      return;
    }
    
    try {
      // Optimized single color analysis with caching (with error handling)
      const colorAnalysis = analyzeColor ? analyzeColor(hex) : null;
      
      // Log color analysis for production insights (when available)
      if (colorAnalysis && IS_DEBUG_MODE) {
        console.log(' Color Analysis:', {
          hex,
          brightness: colorAnalysis.brightness,
          category: colorAnalysis.analysis?.category,
          harmony: colorAnalysis.analysis?.harmony,
          accessibility: colorAnalysis.accessibility
        });
      }
    } catch (error) {
      // Always log color analysis errors for production debugging
      console.warn(' Color analysis error (fallback to basic mode):', error);
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

  // ✅ SAFER: Enhanced updateColorWheelLive with validation and error handling
  const updateColorWheelLive = useCallback((component, value) => {
    const newInputs = { ...hslInputs, [component]: value };
    const { h, s, l } = validateHSL(newInputs.h, newInputs.s, newInputs.l);
    
    let newHex;
    try {
      newHex = hslToHex(h, s, l);
      
      // Validate hex output
      if (!isValidHex6(newHex)) {
        console.error('❌ Invalid hex from hslToHex:', { h, s, l, newHex });
        return; // Don't update with invalid color
      }
      
      // Immediate visual feedback
      setSelectedColor(newHex);
      setBaseHex(newHex);
      
      const wheel = wheelRef?.current;
      if (wheel?.setHandleHSL) {
        wheel.setHandleHSL(activeIdx, h, s, l);
      }
    } catch (error) {
      console.error('❌ Color conversion failed:', error, { h, s, l });
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

  // ✅ SAFER: Enhanced handleExtractorComplete with better validation
  const handleExtractorComplete = useCallback((extractedColors) => {
    try {
      if (!Array.isArray(extractedColors)) {
        console.warn('⚠️ handleExtractorComplete received non-array:', extractedColors);
        return;
      }
      
      if (extractedColors.length === 0) {
        console.warn('⚠️ handleExtractorComplete received empty array');
        return;
      }
      
      // Slice FIRST to prevent processing too many colors, then filter
      const validColors = filterValidHexColors(
        extractedColors.slice(0, 5) // Limit to 5 colors max for performance
      );
      
      if (validColors.length > 0) {
        // Update refs immediately for consistency
        latestPaletteRef.current = validColors;
        
        setPalette(validColors);
        setSelectedColor(validColors[0]);
        setBaseHex(validColors[0]);
        
        forceUpdate(validColors, 0);
        
        if (IS_DEBUG_MODE) {
          console.log('✅ Extracted colors applied:', validColors.length, 'colors');
        }
      } else {
        // Always log extraction issues for production debugging
        console.warn('⚠️ No valid hex colors extracted from:', extractedColors.slice(0, 3), '...');
      }
    } catch (error) {
      console.error('❌ Error in handleExtractorComplete:', error);
      
      // ✅ Report to analytics
      reportError(ERROR_EVENTS.COLOR_EXTRACTION_FAILED, error, {
        colorsCount: extractedColors?.length || 0,
        context: 'handleExtractorComplete',
      });
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
