// screens/ColorWheelScreen/useColorWheelState.js - State management hook
import { useState, useCallback, useEffect, useMemo } from 'react';
import { hexToHsl, hslToHex } from '../../utils/optimizedColor';
import { SCHEME_COUNTS, SCHEME_OFFSETS } from '../../components/FullColorWheel';
import { DEFAULT_COLOR, DEFAULT_SCHEME, validateHSL, generateRandomColor, mod } from './constants';

export const useColorWheelState = () => {
  // Core state
  const [selectedScheme, setSelectedScheme] = useState(DEFAULT_SCHEME);
  const [palette, setPalette] = useState([DEFAULT_COLOR]);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [baseHex, setBaseHex] = useState(DEFAULT_COLOR);
  const [linked, setLinked] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedFollowsActive, setSelectedFollowsActive] = useState(true);
  const [showExtractor, setShowExtractor] = useState(false);

  // HSL input state
  const hsl = useMemo(() => hexToHsl(selectedColor) || { h: 0, s: 100, l: 50 }, [selectedColor]);
  const [hslInputs, setHslInputs] = useState({
    h: String(Math.round(hsl.h)),
    s: String(Math.round(hsl.s)),
    l: String(Math.round(hsl.l)),
  });

  // Sync HSL inputs when selected color changes
  useEffect(() => {
    const { h = 0, s = 100, l = 50 } = hexToHsl(selectedColor) || {};
    setHslInputs({
      h: String(Math.round(h)),
      s: String(Math.round(s)),
      l: String(Math.round(l)),
    });
  }, [selectedColor]);

  // Update individual HSL input
  const updateHslInput = useCallback((component, value) => {
    setHslInputs(prev => ({ ...prev, [component]: value }));
  }, []);

  // Apply HSL inputs to color wheel
  const applyHslInputs = useCallback((wheelRef) => {
    const { h, s, l } = validateHSL(hslInputs.h, hslInputs.s, hslInputs.l);
    const hex = hslToHex(h, s, l);
    setSelectedColor(hex);
    wheelRef.current?.setActiveHandleHSL?.(h, s, l);
  }, [hslInputs]);

  // Live update color wheel while typing (debounced)
  const updateColorWheelLive = useCallback((wheelRef, component, value) => {
    try {
      const newInputs = { ...hslInputs, [component]: value };
      const { h, s, l } = validateHSL(newInputs.h, newInputs.s, newInputs.l);
      wheelRef.current?.setActiveHandleHSL?.(h, s, l);
    } catch (error) {
      // Silently handle invalid input during typing
    }
  }, [hslInputs]);

  // Reset scheme with anchor color
  const resetScheme = useCallback((anchorHex = selectedColor) => {
    const { h = 0, s = 100, l = 50 } = hexToHsl(anchorHex) || {};
    const c = SCHEME_COUNTS[selectedScheme] || 1;
    const offs = SCHEME_OFFSETS[selectedScheme] || [0];
    const result = Array.from({ length: c }, (_, i) =>
      hslToHex(mod(h + (offs[i] ?? 0), 360), s, l)
    );
    setPalette(result);
    setBaseHex(anchorHex);
    setLinked(true);
  }, [selectedColor, selectedScheme]);

  // Generate random color
  const randomize = useCallback(() => {
    const { h, s, l } = generateRandomColor();
    const hex = hslToHex(h, s, l);
    setSelectedColor(hex);
    setBaseHex(hex);
    resetScheme(hex);
  }, [resetScheme]);

  // Toggle functions
  const toggleLinked = useCallback(() => setLinked(v => !v), []);
  const toggleSelectedFollowsActive = useCallback(() => setSelectedFollowsActive(v => !v), []);

  // Extractor functions
  const openExtractor = useCallback(() => setShowExtractor(true), []);
  const closeExtractor = useCallback(() => setShowExtractor(false), []);

  const handleExtractorComplete = useCallback((result) => {
    const extractedPalette = Array.isArray(result?.slots) ? result.slots : [];
    if (extractedPalette.length > 0) {
      const newBaseHex = extractedPalette[0];
      setBaseHex(newBaseHex);
      setSelectedColor(newBaseHex);
      setPalette(extractedPalette);
    }
    setShowExtractor(false);
  }, []);

  // Color wheel event handlers
  const handleColorsChange = useCallback((colors) => {
    if (Array.isArray(colors) && colors.length) {
      setPalette(colors);
    }
  }, []);

  const handleHexChange = useCallback((hex) => {
    if (hex) {
      setSelectedColor(hex);
    }
  }, []);

  const handleActiveHandleChange = useCallback((index) => {
    setActiveIdx(index);
  }, []);

  return {
    // State
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
    
    // Actions
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
    handleColorsChange,
    handleHexChange,
    handleActiveHandleChange,
  };
};
