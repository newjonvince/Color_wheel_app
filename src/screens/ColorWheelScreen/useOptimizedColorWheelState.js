// screens/ColorWheelScreen/useOptimizedColorWheelState.js - Enhanced state management for FullColorWheel

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// CRASH FIX: Lazy-load all imports to prevent early module initialization
let _throttledCallbacks = null;
let _throttledCallbacksLoadAttempted = false;
const getThrottledCallbacks = () => {
  if (_throttledCallbacksLoadAttempted) return _throttledCallbacks;
  _throttledCallbacksLoadAttempted = true;
  try {
    _throttledCallbacks = require('../../utils/throttledCallbacks');
  } catch (error) {
    console.warn('useOptimizedColorWheelState: throttledCallbacks load failed', error?.message);
    _throttledCallbacks = { useThrottledCallbacks: () => ({}) };
  }
  return _throttledCallbacks;
};
const useThrottledCallbacks = (config) => {
  const mod = getThrottledCallbacks();
  const hook = mod?.useThrottledCallbacks;
  return typeof hook === 'function' ? hook(config) : {};
};

let _useOptimizedColorProcessing = null;
let _useOptimizedColorProcessingLoadAttempted = false;
const getUseOptimizedColorProcessing = () => {
  if (_useOptimizedColorProcessingLoadAttempted) return _useOptimizedColorProcessing;
  _useOptimizedColorProcessingLoadAttempted = true;
  try {
    const mod = require('../../hooks/useOptimizedColorProcessing');
    _useOptimizedColorProcessing = mod?.useOptimizedColorProcessing || mod?.default || mod;
  } catch (error) {
    console.warn('useOptimizedColorWheelState: useOptimizedColorProcessing load failed', error?.message);
    _useOptimizedColorProcessing = () => ({});
  }
  return _useOptimizedColorProcessing;
};
const useOptimizedColorProcessing = (config) => {
  const hook = getUseOptimizedColorProcessing();
  return typeof hook === 'function' ? hook(config) : {};
};

let _constants = null;
let _constantsLoadAttempted = false;
const getConstants = () => {
  if (_constantsLoadAttempted) return _constants;
  _constantsLoadAttempted = true;
  try {
    _constants = require('./constants');
  } catch (error) {
    console.warn('useOptimizedColorWheelState: constants load failed', error?.message);
    _constants = {
      DEFAULT_SCHEME: 'monochromatic',
      DEFAULT_COLOR: { hex: '#FF0000', hsl: { h: 0, s: 100, l: 50 } },
      generateRandomColor: () => ({ h: 0, s: 100, l: 50 }),
      validateHSL: (h, s, l) => ({ h: 0, s: 100, l: 50 })
    };
  }
  return _constants;
};
const DEFAULT_SCHEME = (() => {
  const mod = getConstants();
  return mod?.DEFAULT_SCHEME || 'monochromatic';
})();
const DEFAULT_COLOR = (() => {
  const mod = getConstants();
  return mod?.DEFAULT_COLOR || { hex: '#FF0000', hsl: { h: 0, s: 100, l: 50 } };
})();
const generateRandomColor = () => {
  const mod = getConstants();
  const fn = mod?.generateRandomColor;
  return typeof fn === 'function' ? fn() : { h: 0, s: 100, l: 50 };
};
const validateHSL = (h, s, l) => {
  const mod = getConstants();
  const fn = mod?.validateHSL;
  return typeof fn === 'function' ? fn(h, s, l) : { h: 0, s: 100, l: 50 };
};

let _layout = null;
let _layoutLoadAttempted = false;
const getLayout = () => {
  if (_layoutLoadAttempted) return _layout;
  _layoutLoadAttempted = true;
  try {
    _layout = require('../../constants/layout');
  } catch (error) {
    console.warn('useOptimizedColorWheelState: layout constants load failed', error?.message);
    _layout = { LAYOUT: {} };
  }
  return _layout;
};
const LAYOUT = new Proxy({}, {
  get: (target, prop) => {
    const mod = getLayout();
    return mod?.LAYOUT?.[prop] || {};
  }
});

let _colorValidation = null;
let _colorValidationLoadAttempted = false;
const getColorValidation = () => {
  if (_colorValidationLoadAttempted) return _colorValidation;
  _colorValidationLoadAttempted = true;
  try {
    _colorValidation = require('../../utils/colorValidation');
  } catch (error) {
    console.warn('useOptimizedColorWheelState: colorValidation load failed', error?.message);
    _colorValidation = {
      isValidHex6: () => false,
      filterValidHexColors: (colors) => []
    };
  }
  return _colorValidation;
};
const isValidHex6 = (hex) => {
  const mod = getColorValidation();
  const fn = mod?.isValidHex6;
  return typeof fn === 'function' ? fn(hex) : false;
};
const filterValidHexColors = (colors) => {
  const mod = getColorValidation();
  const fn = mod?.filterValidHexColors;
  return typeof fn === 'function' ? fn(colors) : [];
};

let _optimizedColorModule = null;
let _optimizedColorLoadAttempted = false;
const getOptimizedColorModule = () => {
  if (_optimizedColorLoadAttempted) return _optimizedColorModule;
  _optimizedColorLoadAttempted = true;
  try {
    _optimizedColorModule = require('../../utils/optimizedColor');
  } catch (error) {
    console.warn('useOptimizedColorWheelState: optimizedColor load failed', error?.message || error);
    _optimizedColorModule = null;
  }
  return _optimizedColorModule;
};

const clampNumber = (value, min, max) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

const parseHexToRgb = (hex) => {
  if (typeof hex !== 'string') return null;
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return { r, g, b };
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

const hexToHslSafe = (hex) => {
  const mod = getOptimizedColorModule();
  const fn = mod?.hexToHsl;
  if (typeof fn === 'function') {
    try {
      return fn(hex);
    } catch (_error) {
      return null;
    }
  }

  const rgb = parseHexToRgb(hex);
  if (!rgb) return null;
  try {
    return rgbToHslFallback(rgb);
  } catch (_error) {
    return null;
  }
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

const hslToHexSafe = (h, s, l) => {
  const mod = getOptimizedColorModule();
  const fn = mod?.hslToHex;
  if (typeof fn === 'function') {
    try {
      return fn(h, s, l);
    } catch (_error) {
      return hslToHexFallback(h, s, l);
    }
  }
  return hslToHexFallback(h, s, l);
};

const analyzeColorSafe = (hex) => {
  const mod = getOptimizedColorModule();
  const fn = mod?.analyzeColor;
  if (typeof fn !== 'function') return null;
  try {
    return fn(hex);
  } catch (_error) {
    return null;
  }
};

let _errorTelemetryModule = null;
let _errorTelemetryLoadAttempted = false;
const getErrorTelemetryModule = () => {
  if (_errorTelemetryLoadAttempted) return _errorTelemetryModule;
  _errorTelemetryLoadAttempted = true;
  try {
    _errorTelemetryModule = require('../../utils/errorTelemetry');
  } catch (error) {
    console.warn('useOptimizedColorWheelState: errorTelemetry load failed', error?.message || error);
    _errorTelemetryModule = null;
  }
  return _errorTelemetryModule;
};

const ERROR_EVENTS_FALLBACK = {
  COLOR_WHEEL_GESTURE_FAILED: 'color_wheel_gesture_failed',
  COLOR_EXTRACTION_FAILED: 'color_extraction_failed',
};

const getErrorEventsSafe = () => {
  const mod = getErrorTelemetryModule();
  const events = mod?.ERROR_EVENTS;
  if (events && typeof events === 'object') return events;
  return ERROR_EVENTS_FALLBACK;
};

const reportErrorSafe = (eventName, error, context = {}) => {
  const mod = getErrorTelemetryModule();
  const fn = mod?.reportError;
  if (typeof fn === 'function') {
    try {
      return fn(eventName, error, context);
    } catch (_error) {
      try {
        console.error(`[${eventName}]`, error, context);
      } catch (_e) {
        return;
      }
      return;
    }
  }
  try {
    console.error(`[${eventName}]`, error, context);
  } catch (_error) {
    return;
  }
};

import { isDebugMode as IS_DEBUG_MODE } from '../../utils/debugMode';

let _imagePicker = null;
let _imagePickerLoadAttempted = false;
const getImagePicker = () => {
  if (_imagePickerLoadAttempted) return _imagePicker;
  _imagePickerLoadAttempted = true;
  try {
    _imagePicker = require('expo-image-picker');
  } catch (error) {
    console.warn('useOptimizedColorWheelState: expo-image-picker load failed', error?.message);
    _imagePicker = null;
  }
  return _imagePicker;
};

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
  const [extractorImageUri, setExtractorImageUri] = useState(null);
  const [extractorMode, setExtractorMode] = useState('gallery');

  // HSL input state (same as original)
  const hsl = useMemo(() => hexToHslSafe(selectedColor) || { h: 0, s: 100, l: 50 }, [selectedColor]);
  const [hslInputs, setHslInputs] = useState({
    h: String(Math.round(hsl.h)),
    s: String(Math.round(hsl.s)),
    l: String(Math.round(hsl.l)),
  });

  // SAFER: Create fallback functions to prevent crashes
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

  // RULES OF HOOKS COMPLIANCE: Call hook unconditionally at top level
  const colorProcessing = useOptimizedColorProcessing();

  // SAFE: Validate hook result and use fallbacks if needed
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

  // SAFER: Use refs to track latest values and prevent race conditions
  const latestPaletteRef = useRef([]);
  const latestActiveIdxRef = useRef(0);
  
  // Cleanup refs on unmount to prevent GC issues
  useEffect(() => {
    return () => {
      // Clear large array refs to help GC
      if (latestPaletteRef.current && latestPaletteRef.current.length > 0) {
        latestPaletteRef.current = [];
      }
      latestActiveIdxRef.current = 0;
    };
  }, []);

  // SAFER: Set up throttled callbacks with error handling
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
          console.warn('onColorsChange received non-array:', colors);
          return;
        }
        setPalette(colors);
        externalOnColorsChange?.(colors);
      } catch (error) {
        console.error('Error in onColorsChange:', error);
        reportErrorSafe(getErrorEventsSafe().COLOR_WHEEL_GESTURE_FAILED, error, {
          colorsCount: colors?.length || 0,
          context: 'onColorsChange_callback',
        });
      }
    }, [setPalette, externalOnColorsChange]),
    
    onHexChange: useCallback((hex) => {
      try {
        if (!isValidHex6(hex)) {
          console.warn('onHexChange received invalid hex:', hex);
          return;
        }
        setSelectedColor(hex);
        setBaseHex(hex);
        externalOnHexChange?.(hex);
      } catch (error) {
        console.error('Error in onHexChange:', error);
        reportErrorSafe(getErrorEventsSafe().COLOR_WHEEL_GESTURE_FAILED, error, {
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
    const { h = 0, s = 100, l = 50 } = hexToHslSafe(selectedColor) || {};
    setHslInputs({
      h: String(Math.round(h)),
      s: String(Math.round(s)),
      l: String(Math.round(l)),
    });
  }, [selectedColor]);

  // RACE CONDITION FIX: Enhanced color wheel callbacks with consistent data flow
  const handleColorsChange = useCallback((colors, phase = 'change') => {
    // Ensure colors is an array and filter to valid hex strings
    const list = Array.isArray(colors) ? colors : [];
    const hexColors = filterValidHexColors(list);

    // RACE CONDITION FIX: Use current call's data consistently throughout
    const currentActiveIdx = latestActiveIdxRef.current;

    // Update refs immediately (synchronous) - but use current call's data
    latestPaletteRef.current = hexColors;

    // Update state (async)
    setPalette(hexColors);
    
    // CONSISTENT: Use current call's data, not potentially stale ref
    onGestureChange(hexColors, currentActiveIdx);

    // IMPROVED: Smart phase detection for components that don't pass phase
    // If no explicit phase and colors haven't changed much, assume it's during gesture
    const shouldSkipAnalysis = phase !== 'end' && phase !== 'complete';
    
    if (shouldSkipAnalysis) {
      // During drag: skip heavy analysis for performance
      if (IS_DEBUG_MODE()) {
        console.log('Skipping heavy analysis during gesture phase:', phase);
      }
      return;
    }

    // RACE CONDITION FIX: Use current call's data for analysis consistency
    const currentPalette = hexColors; // Use current call's data, not ref
    // currentActiveIdx already captured above

    // Enhanced optimization with caching and analysis - only at gesture end
    try {
      // SAFER: Always call functions since we have fallbacks
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
            if (IS_DEBUG_MODE()) {
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
      console.warn('Optimization error (fallback to basic mode):', error);
    }
  }, [onGestureChange, analyzePalette, analyzePaletteContrast, validateColorScheme, selectedScheme, getCacheStats]);

  // Also update activeIdx ref when it changes
  useEffect(() => {
    latestActiveIdxRef.current = activeIdx;
  }, [activeIdx]);

  const handleHexChange = useCallback((hex) => {
    // Validate hex string format
    if (!isValidHex6(hex)) {
      // Always log invalid hex colors for production debugging
      console.warn('Invalid hex color provided to handleHexChange:', hex);
      return;
    }
    
    try {
      // Optimized single color analysis with caching (with error handling)
      const colorAnalysis = analyzeColorSafe(hex);
      
      // Log color analysis for production insights (when available)
      if (colorAnalysis && IS_DEBUG_MODE()) {
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
    // Push new color to the wheel so external callers (e.g. swatch press) sync the wheel
    forceUpdate([hex], activeIdx);
  }, [forceUpdate, activeIdx]);

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
    const newHex = hslToHexSafe(h, s, l);
    
    // Force immediate update for HSL input changes
    const newPalette = [...palette];
    newPalette[activeIdx] = newHex;
    
    forceUpdate(newPalette, activeIdx);
    
    const wheel = wheelRef?.current;
    if (wheel?.setHandleHSL) {
      wheel.setHandleHSL(activeIdx, h, s, l);
    }
  }, [hslInputs, palette, activeIdx, forceUpdate, wheelRef]);

  // SAFER: Enhanced updateColorWheelLive with validation and error handling
  const updateColorWheelLive = useCallback((component, value) => {
    const newInputs = { ...hslInputs, [component]: value };
    const { h, s, l } = validateHSL(newInputs.h, newInputs.s, newInputs.l);
    
    let newHex;
    try {
      newHex = hslToHexSafe(h, s, l);
      
      // Validate hex output
      if (!isValidHex6(newHex)) {
        console.error('Invalid hex from hslToHex:', { h, s, l, newHex });
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
      console.error('Color conversion failed:', error, { h, s, l });
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
    const newColor = hslToHexSafe(randomHsl.h, randomHsl.s, randomHsl.l);
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

  const openCamera = useCallback(async () => {
    setExtractorMode('camera');
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        setShowExtractor(true);
        return;
      }
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Camera permission denied');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setExtractorImageUri(result.assets[0].uri);
        setShowExtractor(true);
      }
    } catch (error) {
      console.error('openCamera failed:', error);
      setShowExtractor(true);
    }
  }, []);

  const openGallery = useCallback(async () => {
    setExtractorMode('gallery');
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        setShowExtractor(true);
        return;
      }
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Gallery permission denied');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setExtractorImageUri(result.assets[0].uri);
        setShowExtractor(true);
      }
    } catch (error) {
      console.error('openGallery failed:', error);
      setShowExtractor(true);
    }
  }, []);

  const closeExtractor = useCallback(() => {
    setShowExtractor(false);
    setExtractorImageUri(null);
  }, []);

  // SAFER: Enhanced handleExtractorComplete with better validation
  const handleExtractorComplete = useCallback((extractedColors) => {
    try {
      if (!Array.isArray(extractedColors)) {
        console.warn('handleExtractorComplete received non-array:', extractedColors);
        return;
      }
      
      if (extractedColors.length === 0) {
        console.warn('handleExtractorComplete received empty array');
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
        
        if (IS_DEBUG_MODE()) {
          console.log('Extracted colors applied:', validColors.length, 'colors');
        }
      } else {
        // Always log extraction issues for production debugging
        console.warn('No valid hex colors extracted from:', extractedColors.slice(0, 3), '...');
      }
    } catch (error) {
      console.error('Error in handleExtractorComplete:', error);
      
      // Report to analytics
      reportErrorSafe(getErrorEventsSafe().COLOR_EXTRACTION_FAILED, error, {
        colorsCount: extractedColors?.length || 0,
        context: 'handleExtractorComplete',
      });
    }
    setExtractorImageUri(null);
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
    hsl,

    // Enhanced handlers with performance optimization
    updateHslInput,
    applyHslInputs,
    updateColorWheelLive,
    resetScheme,
    randomize,
    toggleLinked,
    toggleSelectedFollowsActive,
    openExtractor,
    openCamera,
    openGallery,
    closeExtractor,
    extractorMode,
    extractorImageUri,
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
