// components/FullColorWheel.js
// Big-disk color wheel with multi-handle support (2–4), link/unlink, snapping (web), keyboard nudges (web).
// Crash-safe: Skia optional, all runOnJS guarded.

import React, { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Platform, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

// Detect whether Reanimated worklets are actually available (plugin + init)
const REANIMATED_READY = typeof global.__reanimatedWorkletInit === 'function';

// Import color helpers BEFORE Skia to ensure proper initialization order
import { hslToHex, hexToHsl } from '../utils/color';

// Try Skia; fall back gracefully if not present
let Canvas, SkiaCircle, SweepGradient, RadialGradient, vec;
try {
  const Skia = require('@shopify/react-native-skia');
  Canvas = Skia.Canvas;
  SkiaCircle = Skia.Circle;
  SweepGradient = Skia.SweepGradient;
  RadialGradient = Skia.RadialGradient;
  vec = Skia.vec;
} catch (e) {
  if (__DEV__) console.warn('Skia not available, using fallback views');
  Canvas = View;
  SkiaCircle = () => null;
  SweepGradient = () => null;
  RadialGradient = () => null;
  vec = () => null;
}

// === Color-harmony definitions ===
export const SCHEME_OFFSETS = {
  complementary: [0, 180],
  analogous: [0, 30, -30],
  triadic: [0, 120, 240],
  tetradic: [0, 90, 180, 270],
  'split-complementary': [0, 150, -150],
  monochromatic: [0, 0, 0], // same hue; L will vary (handled by screen)
};

export const SCHEME_COUNTS = {
  complementary: 2,
  analogous: 3,
  triadic: 3,
  tetradic: 4,
  'split-complementary': 3,
  monochromatic: 3,
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mod = (a, n) => ((a % n) + n) % n;

// Web-only snapping/keyboard state (shift for snap; arrows for nudge)
const globalWebState = { snap: false };

// Helper for safe runOnJS calls from both worklet and JS contexts
const callJS = (fn, ...args) => {
  'worklet';
  if (typeof fn !== 'function') return;
  if (typeof __WORKLET__ !== 'undefined' && __WORKLET__) {
    runOnJS(fn)(...args);
  } else {
    fn(...args);
  }
};

// The real, animated wheel (runs only when reanimated is ready)
const FullColorWheelImpl = forwardRef(function FullColorWheel({
  selectedFollowsActive = true,
  size,
  scheme = 'analogous',
  initialHex = '#FF6B6B',
  linked = true,              // if true, secondary handles follow #0 until “freed”
  freedIndices = [],          // indices that are already independent (set by screen)
  onToggleLinked,             // optional
  onColorsChange,             // (hex[]) palette in handle order
  onHexChange,                // (hex) selected color (handle #0)
  onActiveHandleChange,       // (index) which handle is focused (for numeric inputs)
}, ref) {
  const radius = size / 2;
  const followActive = useSharedValue(selectedFollowsActive ? 1 : 0);
  React.useEffect(() => {
    followActive.value = selectedFollowsActive ? 1 : 0;
    emitPalette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFollowsActive]);

  const cx = radius;
  const cy = radius;

  const count = SCHEME_COUNTS[scheme] || 1;
  const offsets = SCHEME_OFFSETS[scheme] || [0];

  // Make count available in worklet context
  const schemeCount = useSharedValue(count);
  React.useEffect(() => {
    schemeCount.value = count;
  }, [count, schemeCount]);

  // 4 handles max (pre-allocated for stability)
  const handleAngles = [
    useSharedValue(0),
    useSharedValue(30),
    useSharedValue(120),
    useSharedValue(210),
  ];
  const handleSats = [
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
  ];

  // L(ightness) lives here for completeness; default 50% (editable from screen)
  const handleLights = [
    useSharedValue(50),
    useSharedValue(50),
    useSharedValue(50),
    useSharedValue(50),
  ];

  const activeIdx = useSharedValue(0);
  // JS-side set (safe in React effects)
  const freed = useRef(new Set(freedIndices || []));
  // Worklet-safe mirror (array of numbers)
  const freedIdxSV = useSharedValue((freedIndices || []).slice());

  // Pre-compute hue sweep colors for performance
  const hueSweepColors = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= 360; i += 10) arr.push(hslToHex(i, 100, 50));
    return arr;
  }, []);

  // Web-only: register key listeners once
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const keydown = (e) => {
      if (e.key === 'Shift') globalWebState.snap = true;
      // Arrow nudges
      const idx = activeIdx.value;
      let delta = 0;
      if (e.key === 'ArrowLeft') delta = - (e.shiftKey ? 5 : 1);
      if (e.key === 'ArrowRight') delta = + (e.shiftKey ? 5 : 1);
      if (delta !== 0) {
        const a = mod(handleAngles[idx].value + delta, 360);
        handleAngles[idx].value = a;
        emitPalette();
      }
      // Saturation via up/down
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const d = e.shiftKey ? 0.05 : 0.01;
        const sign = e.key === 'ArrowUp' ? +1 : -1;
        const s = clamp01(handleSats[idx].value + sign * d);
        handleSats[idx].value = s;
        emitPalette();
      }
    };
    const keyup = (e) => {
      if (e.key === 'Shift') globalWebState.snap = false;
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    };
  }, []);

  // Init from initialHex + scheme (place other handles by offsets)
  useEffect(() => {
    const { h: hue = 0, s: sat = 100, l: light = 50 } = hexToHsl(initialHex) || {};
    const sat01 = sat / 100;
    handleAngles[0].value = hue;
    handleSats[0].value = sat01;
    handleLights[0].value = light;

    for (let i = 1; i < count; i++) {
      if (!freed.current.has(i)) {
        const ang = mod(hue + (offsets[i] ?? 0), 360);
        handleAngles[i].value = ang;
        handleSats[i].value = sat01;
      }
      handleLights[i].value = light;
    }
    emitPalette();
  }, [initialHex]);

  // Reset freed handles only when scheme changes, not on color changes
  useEffect(() => {
    freed.current.clear(); // Reset freed handles on scheme change
    freedIdxSV.value = []; // Also clear shared value
    const { h: hue = 0, s: sat = 100, l: light = 50 } = hexToHsl(initialHex) || {};
    const sat01 = sat / 100;
    
    for (let i = 1; i < count; i++) {
      const ang = mod(hue + (offsets[i] ?? 0), 360);
      handleAngles[i].value = ang;
      handleSats[i].value = sat01;
      handleLights[i].value = light;
    }
    emitPalette();
  }, [scheme]);

  // Keep JS set in sync when prop changes
  useEffect(() => {
    freed.current = new Set(freedIndices || []);
    freedIdxSV.value = (freedIndices || []).slice();
  }, [freedIndices]);

  // If linked, keep non-freed handles aligned to base during re-renders
  useEffect(() => {
    if (!linked) return;
    const base = handleAngles[0].value;
    const sat0 = handleSats[0].value;
    for (let i = 1; i < count; i++) {
      if (!freed.current.has(i)) {
        handleAngles[i].value = mod(base + offsets[i], 360);
        handleSats[i].value = sat0;
      }
    }
    emitPalette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, scheme]);

  const polarToHex = (ang, sat01, light) => hslToHex(ang, sat01 * 100, light);

  const emitPalette = () => {
    'worklet';
    try {
      const c = schemeCount.value;
      const result = [];
      for (let i = 0; i < c; i++) {
        const ang = handleAngles[i].value;
        const sat = handleSats[i].value;
        const lig = handleLights[i].value;
        result.push(polarToHex(ang, sat, lig));
      }
      if (onColorsChange) callJS(onColorsChange, result);
      if (onHexChange) {
        const sel = followActive.value ? Math.min(Math.max(activeIdx.value,0), result.length-1) : 0;
        callJS(onHexChange, result[sel]);
      }
    } catch (e) {
      if (__DEV__) callJS(console.warn, 'emitPalette error:', e);
    }
  };

  // Marker visuals
  const markerStyle = (idx) =>
    useAnimatedStyle(() => {
      const rad = ((handleAngles[idx].value - 90) * Math.PI) / 180;
      const r = radius * clamp01(handleSats[idx].value);
      return {
        position: 'absolute',
        left: cx - 10 + Math.cos(rad) * r,
        top: cy - 10 + Math.sin(rad) * r,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        borderWidth: 3,
        borderColor: '#00000022',
      };
    });

  const m0 = markerStyle(0);
  const m1 = markerStyle(1);
  const m2 = markerStyle(2);
  const m3 = markerStyle(3);

  // Choose nearest handle by screen point
  const nearestHandle = (x, y) => {
    'worklet';
    const c = SCHEME_COUNTS[scheme] || 1;
    let best = 0;
    let bestDist = 1e9;
    for (let i = 0; i < c; i++) {
      const ang = ((handleAngles[i].value - 90) * Math.PI) / 180;
      const r = radius * clamp01(handleSats[i].value);
      const hx = cx + Math.cos(ang) * r;
      const hy = cy + Math.sin(ang) * r;
      const d = Math.hypot(x - hx, y - hy);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  };

  // Tapping a handle focuses it (for numeric inputs / keyboard nudges)
  const tap = Gesture.Tap().onStart((e) => {
    'worklet';
    const idx = nearestHandle(e.x, e.y);
    activeIdx.value = idx;
    if (typeof onActiveHandleChange === 'function') callJS(onActiveHandleChange, idx);
    emitPalette();
  });

  // Pan gesture updates angle + saturation of active handle
  const gesture = Gesture.Pan()
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
      let deg = mod(ang + 450, 360);
      if (Platform.OS === 'web' && globalWebState.snap) {
        const step = 30; deg = Math.round(deg / step) * step;
      }
      const sat = clamp01(Math.hypot(e.x - cx, e.y - cy) / radius);

      // Free this handle if we are linked and it's not the base
      if (linked && idx !== 0) { 
        // Update both ref and shared value for worklet compatibility
        callJS(() => freed.current.add(idx));
        const newFreed = [...freedIdxSV.value, idx];
        freedIdxSV.value = Array.from(new Set(newFreed));
      }

      handleAngles[idx].value = deg;
      handleSats[idx].value = sat;
      emitPalette();
    })
    .onFinalize((e) => {
      'worklet';
      const idx = activeIdx.value;
      const ang = (Math.atan2(e.y - cy, e.x - cx) * 180) / Math.PI;
      const deg = mod(ang + 450, 360);
      handleAngles[idx].value = withTiming(deg, { duration: 100 });
    });

  // Public setters (used by numeric inputs)
  const setHandleHSL = (idx, h, s, l) => {
    const count = SCHEME_COUNTS[scheme] || 1;
    const i = Math.max(0, Math.min(idx, count - 1));
    handleAngles[i].value = mod(h, 360);
    handleSats[i].value = clamp01(s / 100);
    handleLights[i].value = Math.max(0, Math.min(100, l));
    
    // If linked, update other handles too
    if (linked && i === 0) {
      const c = SCHEME_COUNTS[scheme] || 1;
      for (let k = 1; k < c; k++) {
        if (!freed.current.has(k)) {
          handleAngles[k].value = mod(h + offsets[k], 360);
          handleSats[k].value = clamp01(s / 100);
          handleLights[k].value = Math.max(0, Math.min(100, l));
        }
      }
    }
    emitPalette();
  };
  // Expose imperative setters for numeric inputs (for live updates while typing)
  useImperativeHandle(ref, () => ({
    setActiveHandleHSL: (h, s, l) => {
      try {
        const idx = Math.min(Math.max(activeIdx.value, 0), (SCHEME_COUNTS[scheme] || 1) - 1);
        setHandleHSL(idx, h, s, l);
      } catch (e) { /* no-op */ }
    },
    setHandleHSL: (i, h, s, l) => {
      try { setHandleHSL(i, h, s, l); } catch (e) { /* no-op */ }
    }
  }), [scheme]);


  // Expose imperative API via ref? (kept simple: we call through props via onColorsChange/onHexChange)

  // Render
  return (
    <GestureDetector gesture={Gesture.Simultaneous(tap, gesture)}>
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          {/* Color disk (sweep hue + radial desaturation) */}
          <SkiaCircle cx={cx} cy={cy} r={radius}>
            <SweepGradient c={vec(cx, cy)} colors={hueSweepColors} />
          </SkiaCircle>
          {RadialGradient ? (
            <SkiaCircle cx={cx} cy={cy} r={radius}>
              <RadialGradient c={vec(cx, cy)} r={radius} colors={['#FFFFFFFF', '#FFFFFF00']} />
            </SkiaCircle>
          ) : null}
        </Canvas>

        {/* Markers (always render, control visibility via opacity to avoid conditional Reanimated components) */}
        <Animated.View pointerEvents="none" style={[m0, { zIndex: 4 }]} />
        <Animated.View pointerEvents="none" style={[m1, { zIndex: 3, opacity: count >= 2 ? 1 : 0 }]} />
        <Animated.View pointerEvents="none" style={[m2, { zIndex: 2, opacity: count >= 3 ? 1 : 0 }]} />
        <Animated.View pointerEvents="none" style={[m3, { zIndex: 1, opacity: count >= 4 ? 1 : 0 }]} />
      </View>
    </GestureDetector>
  );
});

// A lightweight, non-animated fallback that won't crash if Reanimated isn't ready
const FallbackWheel = forwardRef(function FallbackWheel(
  { size, initialHex = '#FF6B6B', onColorsChange, onHexChange }, ref
) {
  const radius = size / 2;
  
  // Provide basic imperative methods for compatibility
  useImperativeHandle(ref, () => ({
    setActiveHandleHSL: () => {},
    resetScheme: () => {},
    randomize: () => {}
  }), []);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: initialHex,
        borderWidth: 1,
        borderColor: '#ddd',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 12, color: '#555', textAlign: 'center' }}>
        Color wheel running in safe mode
      </Text>
      <Text style={{ fontSize: 10, color: '#999', textAlign: 'center', marginTop: 4 }}>
        Reanimated not ready
      </Text>
    </View>
  );
});

export default REANIMATED_READY ? FullColorWheelImpl : FallbackWheel;
