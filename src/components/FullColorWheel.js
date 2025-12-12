// components/FullColorWheel.js
// Canva-style multi-handle color wheel with Skia + Reanimated
// Crash-safe: no non-serializable captures inside worklets (no Set/refs); hex conversion on JS thread

// Build verification tag for crash debugging (only in debug mode)
import Constants from 'expo-constants';
const getSafeExpoExtra = () => {
  try {
    const expoConfig = Constants?.expoConfig;
    if (expoConfig && typeof expoConfig === 'object' && expoConfig.extra && typeof expoConfig.extra === 'object') {
      return expoConfig.extra;
    }
    console.warn('FullColorWheel: expoConfig missing or malformed, using defaults');
  } catch (error) {
    console.warn('FullColorWheel: unable to read expoConfig safely, using defaults', error);
  }
  return {};
};

const extra = getSafeExpoExtra();
const IS_DEBUG_MODE = !!extra.EXPO_PUBLIC_DEBUG_MODE;

if (IS_DEBUG_MODE) {
  console.log('FullColorWheel build tag: 2025-08-16 worklet-patched');
}

import React, { useEffect, useMemo, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { View, Platform, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

// Safe iOS check - avoid accessing potentially undefined globals at module load
const REANIMATED_READY = (() => {
  try {
    return typeof global?.__reanimatedWorkletInit === 'function';
  } catch (e) {
    // Log Reanimated issues only in debug mode
    if (IS_DEBUG_MODE) {
      console.log('Reanimated worklet init check failed:', e.message);
    }
    return false;
  }
})();

import { hslToHex, hexToHsl } from '../utils/optimizedColor';

let Canvas, SkiaCircle, SweepGradient, RadialGradient, Paint, vec;
try {
  // ✅ SIMPLIFIED: Universal Skia loading (works on all platforms)
  const Skia = require('@shopify/react-native-skia');
  Canvas = Skia.Canvas;
  SkiaCircle = Skia.Circle;
  SweepGradient = Skia.SweepGradient;
  RadialGradient = Skia.RadialGradient;
  Paint = Skia.Paint;
  vec = Skia.vec;
} catch (e) {
  // Log Skia loading failures only in debug mode
  if (IS_DEBUG_MODE) {
    console.log('Skia module load failed on', Platform.OS + ':', e.message);
  }
  
  // ✅ PROPER FALLBACK: Functional color picker UI
  const FallbackColorWheel = ({ style, children, ...props }) => (
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

  Canvas = FallbackColorWheel;
  SkiaCircle = FallbackCircle;
  SweepGradient = FallbackGradient;
  RadialGradient = FallbackGradient;
  Paint = null;
  vec = () => ({ x: 0, y: 0 });
}

// Import constants from shared location
import { SCHEME_OFFSETS, SCHEME_COUNTS } from '../constants/colorWheelConstants';
export { SCHEME_OFFSETS, SCHEME_COUNTS };

// JS helper functions for worklet callbacks (defined at top-level for performance)
// ✅ Don't pass ref to worklet - use callback instead
const addFreedIndexCallback = (freedRef) => (idx) => {
  freedRef.current.add(idx);
};

// Helper: run callback on JS when invoked from a worklet
const callJS = (fn, ...args) => {
  'worklet';
  if (typeof fn !== 'function') return;
  if (typeof __WORKLET__ !== 'undefined' && __WORKLET__) {
    runOnJS(fn)(...args);
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
  const radius = size / 2;
  const cx = radius, cy = radius;

  const followActive = useSharedValue(selectedFollowsActive ? 1 : 0);
  useEffect(() => {
    followActive.value = selectedFollowsActive ? 1 : 0;
    emitPalette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFollowsActive]);

  const count = SCHEME_COUNTS[scheme] || 1;
  const offsets = SCHEME_OFFSETS[scheme] || [0];
  const schemeCount = useSharedValue(count);
  useEffect(() => { schemeCount.value = count; }, [count]);

  // Handle state (angle 0..360, sat 0..1, light 0..100)
  const handleAngles = [useSharedValue(0), useSharedValue(30), useSharedValue(120), useSharedValue(210)];
  const handleSats   = [useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1)];
  const handleLights = [useSharedValue(50),useSharedValue(50),useSharedValue(50),useSharedValue(50)];
  const activeIdx = useSharedValue(0);
  const freed = useRef(new Set(freedIndices || []));                      // JS-only
  const freedIdxSV = useSharedValue((freedIndices || []).slice());        // UI-thread safe (array)
  
  // ✅ Create callback that doesn't pass ref to worklet
  const addFreedIndex = useCallback(addFreedIndexCallback(freed), []);
  
  // ✅ Throttling for worklet memory leak prevention
  const lastEmitTime = useSharedValue(0);

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
    emitPalette();
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
    
    emitPalette();
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
    
    emitPalette();
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

  const emitPalette = (phase = 'change') => {
    'worklet';
    try {
      // ✅ THROTTLING: Prevent excessive emissions for worklet memory leak prevention
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
  const markerStyle = (idx) => useAnimatedStyle(() => {
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

  // Choose nearest handle
  const nearestHandle = (x, y) => {
    'worklet';
    // ✅ WORKLET FIX: Safe access to constants in worklet context
    const c = (typeof SCHEME_COUNTS !== 'undefined' && SCHEME_COUNTS && SCHEME_COUNTS[scheme]) ? SCHEME_COUNTS[scheme] : 1;
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

  const tap = Gesture.Tap().onStart((e) => {
    'worklet';
    const idx = nearestHandle(e.x, e.y);
    activeIdx.value = idx;
    if (typeof onActiveHandleChange === 'function') callJS(onActiveHandleChange, idx);
    emitPalette();
  });

  const pan = Gesture.Pan()
    .onBegin((e) => {
      'worklet';
      const idx = nearestHandle(e.x, e.y);
      activeIdx.value = idx;
      if (typeof onActiveHandleChange === 'function') callJS(onActiveHandleChange, idx);
      emitPalette();
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
        // ✅ WORKLET FIX: Capture constants in worklet-safe way
        const schemeOffsets = (typeof SCHEME_OFFSETS !== 'undefined' && SCHEME_OFFSETS && SCHEME_OFFSETS[scheme]) ? SCHEME_OFFSETS[scheme] : [0];
        const handleCount = (typeof SCHEME_COUNTS !== 'undefined' && SCHEME_COUNTS && SCHEME_COUNTS[scheme]) ? SCHEME_COUNTS[scheme] : 1;
        
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
            // ✅ Add extra safety for worklet context
            const schemeOffsets = (SCHEME_OFFSETS && SCHEME_OFFSETS[scheme]) ? SCHEME_OFFSETS[scheme] : [0];
            const offset = k < schemeOffsets.length ? schemeOffsets[k] : 0;
            handleAngles[k].value = mod(deg + offset, 360);
            handleSats[k].value = sat;
          }
        }
      } else if (linked && idx !== 0) {
        // Mark non-primary handles as freed when dragged independently
        const arr = Array.isArray(freedIdxSV.value) ? freedIdxSV.value.slice() : [];
        if (arr.indexOf(idx) === -1) {
          handleAngles[idx].value = withTiming(deg, { duration: 100 });
        }
      }
      
      emitPalette();
    });

  // Public setters live on JS: safe to consult JS Set + props
  const setHandleHSL = (idx, h, s, l) => {
    const c = SCHEME_COUNTS[scheme] || 1;
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
    
    emitPalette();
  };

  useImperativeHandle(ref, () => ({
    setActiveHandleHSL: (h,s,l) => {
      try {
        // ✅ FIX: Safe access to constants and shared values
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

  return (
    <GestureDetector gesture={Gesture.Simultaneous(tap, pan)}>
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
        <Animated.View pointerEvents="none" style={[m0, { zIndex: 4 }]} />
        <Animated.View pointerEvents="none" style={[m1, { zIndex: 3, opacity: count >= 2 ? 1 : 0 }]} />
        <Animated.View pointerEvents="none" style={[m2, { zIndex: 2, opacity: count >= 3 ? 1 : 0 }]} />
        <Animated.View pointerEvents="none" style={[m3, { zIndex: 1, opacity: count >= 4 ? 1 : 0 }]} />
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

export default REANIMATED_READY ? FullColorWheelImpl : FallbackWheel;
