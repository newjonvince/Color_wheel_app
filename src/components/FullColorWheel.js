// components/FullColorWheel.js
// Canva-style multi-handle color wheel with Skia + Reanimated
// Crash-safe: no non-serializable captures inside worklets (no Set/refs); hex conversion on JS thread

// CIRCULAR DEPENDENCY FIX: Lazy load expoConfigHelper to prevent crash on module initialization
let _isDebugModeValue = null;
const getIsDebugMode = () => {
  if (_isDebugModeValue === null) {
    try {
      const helper = require('../utils/expoConfigHelper');
      _isDebugModeValue = helper.isDebugMode ? helper.isDebugMode() : false;
    } catch (error) {
      console.warn('FullColorWheel: expoConfigHelper load failed', error?.message);
      _isDebugModeValue = false;
    }
  }
  return _isDebugModeValue;
};
const IS_DEBUG_MODE = () => getIsDebugMode();

// CRASH FIX: Removed top-level IS_DEBUG_MODE() call that was pulling expoConfigHelper
// during module load (before native bridge is ready). Build tag logging moved to component mount.

import React, { useEffect, useMemo, useRef, forwardRef, useImperativeHandle, useCallback, useState } from 'react';
import { View, Platform, Text, InteractionManager } from 'react-native';

// CRASH FIX: Lazy-load gesture-handler and reanimated to prevent native module initialization
// during the early import chain (before RN bridge is ready ~300ms after launch).
// This fixes the Thread 3 SIGABRT crash on startup.
let _gestureHandlerModule = null;
let _gestureHandlerLoadAttempted = false;

const loadGestureHandler = () => {
  if (_gestureHandlerLoadAttempted) return _gestureHandlerModule;
  _gestureHandlerLoadAttempted = true;
  try {
    const mod = require('react-native-gesture-handler');
    _gestureHandlerModule = {
      Gesture: mod.Gesture,
      GestureDetector: mod.GestureDetector,
    };
  } catch (e) {
    console.warn('FullColorWheel: react-native-gesture-handler load failed:', e?.message);
    _gestureHandlerModule = null;
  }
  return _gestureHandlerModule;
};

let _reanimatedModule = null;
let _reanimatedLoadAttempted = false;

const loadReanimated = () => {
  if (_reanimatedLoadAttempted) return _reanimatedModule;
  _reanimatedLoadAttempted = true;
  try {
    const mod = require('react-native-reanimated');
    _reanimatedModule = {
      Animated: mod.default,
      useSharedValue: mod.useSharedValue,
      useAnimatedStyle: mod.useAnimatedStyle,
      withTiming: mod.withTiming,
      runOnJS: mod.runOnJS,
    };
  } catch (e) {
    console.warn('FullColorWheel: react-native-reanimated load failed:', e?.message);
    _reanimatedModule = null;
  }
  return _reanimatedModule;
};

// CRASH FIX: Check reanimated readiness lazily, not at module load time
// This prevents native module initialization during the import chain
let _reanimatedReady = null;
const isReanimatedReady = () => {
  if (_reanimatedReady !== null) return _reanimatedReady;
  try {
    // First check if worklet init is available (quick check, no native access)
    const hasWorkletInit = typeof global?.__reanimatedWorkletInit === 'function';
    if (!hasWorkletInit) {
      _reanimatedReady = false;
      return false;
    }
    // Only load the module if worklet init is available
    const reanimated = loadReanimated();
    const gestureHandler = loadGestureHandler();
    _reanimatedReady = !!(reanimated && gestureHandler);
  } catch (e) {
    _reanimatedReady = false;
  }
  return _reanimatedReady;
};

// Safe hook wrappers that use lazy-loaded modules or fallbacks
const useSharedValueSafe = (initialValue) => {
  const reanimated = loadReanimated();
  if (reanimated?.useSharedValue) {
    return reanimated.useSharedValue(initialValue);
  }
  // Fallback: simple ref-like object (won't animate but won't crash)
  return useRef({ value: initialValue }).current;
};

const useAnimatedStyleSafe = (updater, deps) => {
  const reanimated = loadReanimated();
  if (reanimated?.useAnimatedStyle) {
    return reanimated.useAnimatedStyle(updater, deps);
  }
  // Fallback: return empty style
  return useMemo(() => ({}), deps || []);
};

const withTimingSafe = (value, config) => {
  const reanimated = loadReanimated();
  if (reanimated?.withTiming) {
    return reanimated.withTiming(value, config);
  }
  return value;
};

const runOnJSSafe = (fn) => {
  const reanimated = loadReanimated();
  if (reanimated?.runOnJS) {
    return reanimated.runOnJS(fn);
  }
  return fn;
};

import { hslToHex, hexToHsl } from '../utils/optimizedColor';

// CRASH FIX: Defer Skia loading until component render, not module load time.
// Native module crashes bypass try/catch - only JS exceptions are caught.
// By deferring, we ensure the app has mounted before Skia native init runs.
let _skiaModule = null;
let _skiaLoadAttempted = false;
let _skiaLoadError = null;

const loadSkia = () => {
  if (_skiaLoadAttempted) {
    return _skiaModule;
  }
  _skiaLoadAttempted = true;
  
  try {
    const Skia = require('@shopify/react-native-skia');
    _skiaModule = {
      Canvas: Skia.Canvas,
      Circle: Skia.Circle,
      SweepGradient: Skia.SweepGradient,
      RadialGradient: Skia.RadialGradient,
      Paint: Skia.Paint,
      vec: Skia.vec,
    };
  } catch (e) {
    _skiaLoadError = e;
    console.warn('FullColorWheel: Skia module load failed on', Platform.OS + ':', e?.message);
    _skiaModule = null;
  }
  
  return _skiaModule;
};

// Fallback components (used if Skia fails to load)
const FallbackCanvas = ({ style, children, ...props }) => (
  <View style={[style, {
    backgroundColor: '#f0f0f0',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center'
  }]} {...props}>
    <View style={{
      backgroundColor: '#ff6b6b',
      width: '80%',
      height: '80%',
      borderRadius: 999,
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <Text style={{
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center'
      }}>
        Color{'\n'}Picker
      </Text>
    </View>
    {children}
  </View>
);

const FallbackCircle = ({ cx, cy, r, color, children, ...props }) => (
  <View style={{
    position: 'absolute',
    left: (cx || 0) - (r || 50),
    top: (cy || 0) - (r || 50),
    width: (r || 50) * 2,
    height: (r || 50) * 2,
    backgroundColor: color || '#ff6b6b',
    borderRadius: 999,
  }} {...props}>
    {children}
  </View>
);

const FallbackGradient = () => null;
const fallbackVec = () => ({ x: 0, y: 0 });

// Import constants from shared location
import { SCHEME_OFFSETS, SCHEME_COUNTS } from '../constants/colorWheelConstants';
export { SCHEME_OFFSETS, SCHEME_COUNTS };

// JS helper functions for worklet callbacks (defined at top-level for performance)
// Don't pass ref to worklet - use callback instead
const addFreedIndexCallback = (freedRef) => (idx) => {
  freedRef.current.add(idx);
};

// Helper: run callback on JS when invoked from a worklet
// Uses lazy-loaded runOnJS to prevent early native module access
const callJS = (fn, ...args) => {
  'worklet';
  if (typeof fn !== 'function') return;
  if (typeof __WORKLET__ !== 'undefined' && __WORKLET__) {
    const runOnJS = loadReanimated()?.runOnJS;
    if (runOnJS) {
      runOnJS(fn)(...args);
    } else {
      fn(...args);
    }
  } else {
    fn(...args);
  }
};

// Pure functions - safe to call from worklets (no closures/captures)
const clamp01 = (v) => {
  'worklet';
  return Math.max(0, Math.min(1, v));
};

const mod = (a, n) => {
  'worklet';
  return ((a % n) + n) % n;
};

const FullColorWheelImpl = forwardRef(function FullColorWheel({
  selectedFollowsActive = true,
  size,
  scheme = 'complementary',
  initialHex = '#FF6B6B',
  linked = true,
  freedIndices = [],
  onToggleLinked,
  onColorsChange,
  onHexChange,
  onActiveHandleChange,
}, ref) {
  const [isSkiaAllowed, setIsSkiaAllowed] = useState(false);

  const MAX_HANDLES = 5;

  useEffect(() => {
    let cancelled = false;
    InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setIsSkiaAllowed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const radius = size / 2;
  const cx = radius, cy = radius;

  // CRASH FIX: Use safe hook wrappers that lazy-load reanimated
  const followActive = useSharedValueSafe(selectedFollowsActive ? 1 : 0);
  useEffect(() => {
    followActive.value = selectedFollowsActive ? 1 : 0;
    emitPaletteJS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFollowsActive]);

  const count = Math.min(SCHEME_COUNTS[scheme] || 1, MAX_HANDLES);
  const offsets = SCHEME_OFFSETS[scheme] || [0];
  const schemeCount = useSharedValueSafe(count);
  useEffect(() => { schemeCount.value = count; }, [count]);

  // Handle state (angle 0..360, sat 0..1, light 0..100)
  const handleAngles = [useSharedValueSafe(0), useSharedValueSafe(30), useSharedValueSafe(120), useSharedValueSafe(210), useSharedValueSafe(300)];
  const handleSats   = [useSharedValueSafe(1), useSharedValueSafe(1), useSharedValueSafe(1), useSharedValueSafe(1), useSharedValueSafe(1)];
  const handleLights = [useSharedValueSafe(50),useSharedValueSafe(50),useSharedValueSafe(50),useSharedValueSafe(50),useSharedValueSafe(50)];
  const activeIdx = useSharedValueSafe(0);
  const freed = useRef(new Set(freedIndices || []));                      // JS-only
  const freedIdxSV = useSharedValueSafe((freedIndices || []).slice());        // UI-thread safe (array)
  
  // Create callback that doesn't pass ref to worklet
  const addFreedIndex = useCallback(addFreedIndexCallback(freed), []);
  
  // Throttling for worklet memory leak prevention
  const lastEmitTime = useSharedValueSafe(0);

  // Precomputed hue sweep
  const hueSweepColors = useMemo(() => {
    const arr = [];
    for (let i=0; i<=360; i+=10) arr.push(hslToHex(i, 100, 50));
    return arr;
  }, []);

  // Initialize from initial hex + scheme
  useEffect(() => {
    const { h=0, s=100, l=50 } = hexToHsl(initialHex) || {};
    const s01 = s/100;
    handleAngles[0].value = h;
    handleSats[0].value = s01;
    handleLights[0].value = l;
    for (let i=1; i<count; i++) {
      if (!freed.current.has(i)) {
        handleAngles[i].value = mod(h + (offsets[i] ?? 0), 360);
        handleSats[i].value = s01;
      }
      handleLights[i].value = l;
    }
    emitPaletteJS();
  }, [initialHex]);

  // Reset freed when scheme changes
  useEffect(() => {
    freed.current.clear();
    freedIdxSV.value = [];
    const { h=0, s=100, l=50 } = hexToHsl(initialHex) || {};
    const s01 = s/100;
    
    // Initialize handles based on scheme
    for (let i=1; i<count; i++) {
      const offset = offsets[i] ?? 0;
      handleAngles[i].value = mod(h + offset, 360);
      handleSats[i].value = s01;
      handleLights[i].value = l;
    }
    
    emitPaletteJS();
  }, [scheme, count, offsets, initialHex]);

  // Sync prop → state
  useEffect(() => {
    freed.current = new Set(freedIndices || []);
    freedIdxSV.value = (freedIndices || []).slice();
  }, [freedIndices]);

  // When linking toggles, re-sync dependents to base
  useEffect(() => {
    if (!linked) return;
    const base = handleAngles[0].value;
    const sat0 = handleSats[0].value;
    const light0 = handleLights[0].value;
    
    // Special handling for different schemes (Canva-style)
    if (scheme === 'complementary') {
      handleAngles[1].value = mod(base + 180, 360);
      handleSats[1].value = sat0;
      handleLights[1].value = light0;
    } else if (scheme === 'analogous' || scheme === 'triadic' || scheme === 'tetradic' || scheme === 'split-complementary') {
      // Multi-handle schemes: All handles move together maintaining relative spacing
      const schemeOffsets = SCHEME_OFFSETS[scheme] || [0];
      const handleCount = SCHEME_COUNTS[scheme] || 1;
      
      for (let i = 0; i < handleCount; i++) {
        const offset = schemeOffsets[i] || 0;
        handleAngles[i].value = mod(base + offset, 360);
        handleSats[i].value = sat0;
        handleLights[i].value = light0;
      }
    } else {
      // Handle other schemes
      for (let i=1; i<count; i++) {
        if (!freed.current.has(i)) {
          const offset = offsets[i] ?? 0;
          handleAngles[i].value = mod(base + offset, 360);
          handleSats[i].value = sat0;
          handleLights[i].value = light0;
        }
      }
    }
    
    emitPaletteJS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, scheme, count, offsets]);

  // ===== Palette emission: compute hexes on JS (avoid calling hslToHex in a worklet) =====
  const jsEmitPalette = (triples, activePref, phase = 'change') => {
    try {
      const out = triples.map(([ang, s01, light]) => hslToHex(ang, s01 * 100, light));
      if (typeof onColorsChange === 'function') onColorsChange(out, phase);
      if (typeof onHexChange === 'function') {
        const idx = (selectedFollowsActive ? Math.max(0, Math.min(activePref, out.length - 1)) : 0);
        onHexChange(out[idx]);
      }
    } catch (error) {
      console.warn('FullColorWheel: jsEmitPalette failed:', error.message);
      console.error('FullColorWheel: jsEmitPalette error details:', error);
    }
  };

  const emitPaletteJS = (phase = 'change') => {
    try {
      const c = count;
      const triples = [];
      for (let i = 0; i < c; i++) {
        triples.push([handleAngles[i].value, handleSats[i].value, handleLights[i].value]);
      }
      const activePref = selectedFollowsActive ? Math.max(0, Math.min(activeIdx.value, c - 1)) : 0;
      jsEmitPalette(triples, activePref, phase);
    } catch (error) {
      console.warn('FullColorWheel: emitPaletteJS failed:', error.message);
      console.error('FullColorWheel: emitPaletteJS error details:', error);
    }
  };

  const emitPaletteWorklet = (phase = 'change') => {
    'worklet';
    try {
      // THROTTLING: Prevent excessive emissions for worklet memory leak prevention
      const now = Date.now();
      const THROTTLE_MS = 16; // ~60fps throttling
      
      if (now - lastEmitTime.value < THROTTLE_MS) {
        return; // Skip emission if too frequent
      }
      lastEmitTime.value = now;
      
      const c = schemeCount.value;
      const triples = [];
      for (let i=0;i<c;i++) {
        triples.push([handleAngles[i].value, handleSats[i].value, handleLights[i].value]);
      }
      const idxPref = followActive.value ? Math.max(0, Math.min(activeIdx.value, c - 1)) : 0;
      callJS(jsEmitPalette, triples, idxPref, phase);
    } catch(error) {
      console.warn('FullColorWheel: emitPalette worklet failed:', error.message);
      console.error('FullColorWheel: emitPalette worklet error details:', error);
    }
  };

  // ===== Marker visuals (Canva look) =====
  const markerStyle = (idx) => useAnimatedStyleSafe(() => {
    'worklet';
    const rad = ((handleAngles[idx].value - 90) * Math.PI) / 180;
    const r = radius * clamp01(handleSats[idx].value);
    const x = cx - 12 + Math.cos(rad) * r;
    const y = cy - 12 + Math.sin(rad) * r;
    const isMain = idx === 0;
    return {
      position: 'absolute',
      left: x,
      top: y,
      width: isMain ? 24 : 16,
      height: isMain ? 24 : 16,
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
      borderWidth: 3,
      borderColor: '#E0E0E0',   // Visible gray
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    };
  });
  const m0 = markerStyle(0);
  const m1 = markerStyle(1);
  const m2 = markerStyle(2);
  const m3 = markerStyle(3);
  const m4 = markerStyle(4);

  // Choose nearest handle
  const nearestHandle = (x, y) => {
    'worklet';
    // WORKLET FIX: Safe access to constants in worklet context
    const rawCount = (typeof SCHEME_COUNTS !== 'undefined' && SCHEME_COUNTS && SCHEME_COUNTS[scheme]) ? SCHEME_COUNTS[scheme] : 1;
    const c = rawCount > 5 ? 5 : rawCount;
    let best = 0, bestDist = 1e9;
    for (let i=0;i<c;i++) {
      const ang = ((handleAngles[i].value - 90) * Math.PI)/180;
      const r = radius * clamp01(handleSats[i].value);
      const hx = cx + Math.cos(ang)*r;
      const hy = cy + Math.sin(ang)*r;
      const d = Math.hypot(x - hx, y - hy);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  };

  // CRASH FIX: Load gesture handler lazily to prevent early native module access
  const gestureModule = loadGestureHandler();
  const GestureClass = gestureModule?.Gesture;
  
  // Create gestures only if gesture handler is available
  const tap = GestureClass ? GestureClass.Tap().onStart((e) => {
    'worklet';
    const idx = nearestHandle(e.x, e.y);
    activeIdx.value = idx;
    if (typeof onActiveHandleChange === 'function') callJS(onActiveHandleChange, idx);
    emitPaletteWorklet();
  }) : null;

  const pan = GestureClass ? GestureClass.Pan()
    .onBegin((e) => {
      'worklet';
      const idx = nearestHandle(e.x, e.y);
      activeIdx.value = idx;
      if (typeof onActiveHandleChange === 'function') callJS(onActiveHandleChange, idx);
      emitPaletteWorklet();
    })
    .onChange((e) => {
      'worklet';
      const idx = activeIdx.value;
      const ang = (Math.atan2(e.y - cy, e.x - cx) * 180) / Math.PI;
      const deg = mod(ang + 450, 360);
      const sat = clamp01(Math.hypot(e.x - cx, e.y - cy) / radius);
      
      // Update the dragged handle
      handleAngles[idx].value = deg;
      handleSats[idx].value = sat;
      
      // Canva-style synchronized movement for different schemes
      if (linked && scheme === 'complementary') {
        const complementaryIdx = idx === 0 ? 1 : 0;
        const complementaryAngle = mod(deg + 180, 360);
        handleAngles[complementaryIdx].value = complementaryAngle;
        handleSats[complementaryIdx].value = sat; // Match saturation
      } else if (linked && (scheme === 'analogous' || scheme === 'triadic' || scheme === 'tetradic' || scheme === 'split-complementary')) {
        // Synchronized movement for multi-handle schemes
        const baseAngle = deg;
        // WORKLET FIX: Capture constants in worklet-safe way
        const schemeOffsets = (typeof SCHEME_OFFSETS !== 'undefined' && SCHEME_OFFSETS && SCHEME_OFFSETS[scheme]) ? SCHEME_OFFSETS[scheme] : [0];
        const rawHandleCount = (typeof SCHEME_COUNTS !== 'undefined' && SCHEME_COUNTS && SCHEME_COUNTS[scheme]) ? SCHEME_COUNTS[scheme] : 1;
        const handleCount = rawHandleCount > 5 ? 5 : rawHandleCount;
        
        for (let k = 0; k < handleCount; k++) {
          if (k !== idx) { // Don't update the handle being dragged
            const offset = schemeOffsets[k] || 0;
            handleAngles[k].value = mod(baseAngle + offset, 360);
            handleSats[k].value = sat; // Match saturation
          }
        }
      } else if (linked && idx === 0) {
        // Handle other schemes (non-complementary)
        const c = schemeCount.value;
        for (let k = 1; k < c; k++) {
          const freedArray = Array.isArray(freedIdxSV.value) ? freedIdxSV.value : [];
          if (freedArray.indexOf(k) === -1) {
            // Add extra safety for worklet context
            const schemeOffsets = (SCHEME_OFFSETS && SCHEME_OFFSETS[scheme]) ? SCHEME_OFFSETS[scheme] : [0];
            const offset = k < schemeOffsets.length ? schemeOffsets[k] : 0;
            handleAngles[k].value = mod(deg + offset, 360);
            handleSats[k].value = sat;
          }
        }
      } else if (linked && idx !== 0) {
        // Mark non-primary handles as freed when dragged independently
        const currentFreed = Array.isArray(freedIdxSV.value) ? freedIdxSV.value : [];
        if (currentFreed.indexOf(idx) === -1) {
          freedIdxSV.value = currentFreed.concat([idx]);
          callJS(addFreedIndex, idx);
        }
        handleAngles[idx].value = withTimingSafe(deg, { duration: 100 });
      }
      
      emitPaletteWorklet();
    }) : null;

  // Public setters live on JS: safe to consult JS Set + props
  const setHandleHSL = (idx, h, s, l) => {
    const c = Math.min(SCHEME_COUNTS[scheme] || 1, MAX_HANDLES);
    const i = Math.max(0, Math.min(idx, c - 1));
    handleAngles[i].value = mod(h, 360);
    handleSats[i].value = clamp01(s / 100);
    handleLights[i].value = Math.max(0, Math.min(100, l));
    
    if (linked) {
      // Canva-style synchronization for different schemes
      if (scheme === 'complementary') {
        const complementaryIdx = i === 0 ? 1 : 0;
        const complementaryAngle = mod(h + 180, 360);
        handleAngles[complementaryIdx].value = complementaryAngle;
        handleSats[complementaryIdx].value = clamp01(s / 100);
        handleLights[complementaryIdx].value = Math.max(0, Math.min(100, l));
      } else if (scheme === 'analogous' || scheme === 'triadic' || scheme === 'tetradic' || scheme === 'split-complementary') {
        // Multi-handle schemes: All handles move together maintaining relative spacing
        const schemeOffsets = SCHEME_OFFSETS[scheme] || [0];
        const handleCount = SCHEME_COUNTS[scheme] || 1;
        
        for (let k = 0; k < handleCount; k++) {
          if (k !== i) { // Don't update the handle being set
            const offset = schemeOffsets[k] || 0;
            handleAngles[k].value = mod(h + offset, 360);
            handleSats[k].value = clamp01(s / 100);
            handleLights[k].value = Math.max(0, Math.min(100, l));
          }
        }
      } else if (i === 0) {
        // Handle other schemes when primary handle changes
        for (let k=1; k<c; k++) {
          if (!freed.current.has(k)) {
            const offset = offsets[k] ?? 0;
            handleAngles[k].value = mod(h + offset, 360);
            handleSats[k].value = clamp01(s/100);
            handleLights[k].value = Math.max(0, Math.min(100, l));
          }
        }
      }
    }
    
    emitPaletteJS();
  };

  useImperativeHandle(ref, () => ({
    setActiveHandleHSL: (h,s,l) => {
      try {
        // FIX: Safe access to constants and shared values
        const currentScheme = scheme; // Capture scheme prop
        const schemeCount = (typeof SCHEME_COUNTS !== 'undefined' && SCHEME_COUNTS && SCHEME_COUNTS[currentScheme]) ? SCHEME_COUNTS[currentScheme] : 1;
        const idx = Math.min(Math.max(activeIdx.value, 0), schemeCount - 1);
        setHandleHSL(idx, h, s, l);
      } catch (error) {
        console.warn('FullColorWheel: setActiveHandleHSL failed:', error.message);
        console.error('FullColorWheel: setActiveHandleHSL error details:', error);
      }
    },
    setHandleHSL: (i,h,s,l) => {
      try { setHandleHSL(i,h,s,l); } catch (error) {
        console.warn('FullColorWheel: setHandleHSL failed:', error.message);
        console.error('FullColorWheel: setHandleHSL error details:', error);
      }
    }
  }), [scheme, linked, setHandleHSL, activeIdx]);

  // ===== Render: Canva look =====
  const innerSpacer = Math.max(6, radius * 0.06); // white spacer ring
  const outerRim = Math.max(10, radius * 0.10);   // glossy rim thickness

  // CRASH FIX: Load Skia at render time, not module load time
  // This ensures the app has mounted before Skia native init runs
  const skia = isSkiaAllowed ? loadSkia() : null;
  const Canvas = skia?.Canvas || FallbackCanvas;
  const SkiaCircle = skia?.Circle || FallbackCircle;
  const SweepGradient = skia?.SweepGradient || FallbackGradient;
  const RadialGradient = skia?.RadialGradient || FallbackGradient;
  const vec = skia?.vec || fallbackVec;

  // CRASH FIX: Get Gesture and GestureDetector from lazy-loaded module
  const gestureHandler = loadGestureHandler();
  const Gesture = gestureHandler?.Gesture;
  const GestureDetector = gestureHandler?.GestureDetector || View;
  
  // CRASH FIX: Get Animated from lazy-loaded module
  const reanimated = loadReanimated();
  const AnimatedView = reanimated?.Animated?.View || View;

  // If gesture handler isn't available, return simple view without gestures
  if (!Gesture) {
    return (
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          <SkiaCircle cx={cx} cy={cy} r={radius} color="#1A3A3F" />
          <SkiaCircle cx={cx} cy={cy} r={radius - outerRim} color="#F8F8F8" />
          <SkiaCircle cx={cx} cy={cy} r={radius - outerRim - innerSpacer}>
            <SweepGradient c={vec(cx, cy)} colors={hueSweepColors} />
          </SkiaCircle>
        </Canvas>
      </View>
    );
  }

  // Create combined gesture using lazy-loaded GestureClass
  const combinedGesture = (GestureClass && tap && pan) ? GestureClass.Simultaneous(tap, pan) : null;
  
  return (
    <GestureDetector gesture={combinedGesture}>
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          {/* Outer gradient rim (dark teal -> cyan) */}
          <SkiaCircle cx={cx} cy={cy} r={radius} color="#1A3A3F" />

          {/* White spacer ring */}
          <SkiaCircle cx={cx} cy={cy} r={radius - outerRim} color="#F8F8F8" />

          {/* Hue disk */}
          <SkiaCircle cx={cx} cy={cy} r={radius - outerRim - innerSpacer}>
            <SweepGradient c={vec(cx, cy)} colors={hueSweepColors} />
          </SkiaCircle>

          {/* Desaturation toward center */}
          <SkiaCircle cx={cx} cy={cy} r={radius - outerRim - innerSpacer}>
            <RadialGradient c={vec(cx, cy)} r={radius - outerRim - innerSpacer} colors={['#FFFFFFFF', '#FFFFFF00']} />
          </SkiaCircle>
        </Canvas>

        {/* Handles */}
        <AnimatedView pointerEvents="none" style={[m0, { zIndex: 4 }]} />
        <AnimatedView pointerEvents="none" style={[m1, { zIndex: 3, opacity: count >= 2 ? 1 : 0 }]} />
        <AnimatedView pointerEvents="none" style={[m2, { zIndex: 2, opacity: count >= 3 ? 1 : 0 }]} />
        <AnimatedView pointerEvents="none" style={[m3, { zIndex: 1, opacity: count >= 4 ? 1 : 0 }]} />
        <AnimatedView pointerEvents="none" style={[m4, { zIndex: 0, opacity: count >= 5 ? 1 : 0 }]} />
      </View>
    </GestureDetector>
  );
});

const FallbackWheel = forwardRef(function FallbackWheel({ size, initialHex }, ref) {
  const radius = size/2;
  useImperativeHandle(ref, () => ({
    setActiveHandleHSL: () => {},
    setHandleHSL: () => {},
  }), []);
  return (
    <View style={{
      width: size, height: size, borderRadius: radius,
      backgroundColor: initialHex || '#FF6B6B', borderWidth: 1, borderColor: '#ddd',
      alignItems: 'center', justifyContent: 'center'
    }} />
  );
});

// CRASH FIX: Use lazy check instead of module-load-time check
// The component will use fallbacks internally if modules aren't available
export default FullColorWheelImpl;
