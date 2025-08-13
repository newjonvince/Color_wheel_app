// components/FullColorWheel.js
// Big-disk color wheel with multi-handle support (2–4), link/unlink, snapping (web), keyboard nudges (web).
// Crash-safe: Skia optional, all runOnJS guarded.

import React, { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

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
  console.warn('Skia not available, using fallback views');
  Canvas = View;
  SkiaCircle = () => null;
  SweepGradient = () => null;
  RadialGradient = () => null;
  vec = () => null;
}

// Use your existing color helpers (kept compatible with your colors.js)
import { hslToHex, hexToHsl } from '../utils/color';

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

export default forwardRef(function FullColorWheel({
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
  const freed = useRef(new Set(freedIndices || []));

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
      const c = SCHEME_COUNTS[scheme] || 1;
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
      console.warn('emitPalette error:', e);
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
    const idx = nearestHandle(e.x, e.y);
    activeIdx.value = idx;
    if (typeof onActiveHandleChange === 'function') runOnJS(onActiveHandleChange)(idx);
    emitPalette();
  });

  // Pan gesture updates angle + saturation of active handle
  const gesture = Gesture.Pan()
    .onBegin((e) => {
      const idx = nearestHandle(e.x, e.y);
      activeIdx.value = idx;
      if (typeof onActiveHandleChange === 'function') runOnJS(onActiveHandleChange)(idx);
      emitPalette();
    })
    .onChange((e) => {
      const idx = activeIdx.value;
      const ang = (Math.atan2(e.y - cy, e.x - cx) * 180) / Math.PI;
      let deg = mod(ang + 450, 360);
      if (Platform.OS === 'web' && globalWebState.snap) {
        const step = 30; deg = Math.round(deg / step) * step;
      }
      const sat = clamp01(Math.hypot(e.x - cx, e.y - cy) / radius);

      // Free this handle if we are linked and it's not the base
      if (linked && idx !== 0) { freed.current.add(idx); }

      handleAngles[idx].value = deg;
      handleSats[idx].value = sat;
      emitPalette();
    })
    .onFinalize((e) => {
      const idx = activeIdx.value;
      const ang = (Math.atan2(e.y - cy, e.x - cx) * 180) / Math.PI;
      const deg = mod(ang + 450, 360);
      handleAngles[idx].value = withTiming(deg, { duration: 100 });
    });

  // Public setters (used by numeric inputs)
  const setHandleHSL = (idx, h, s, l) => {
    'worklet';
    handleAngles[idx].value = mod(h, 360);
    handleSats[idx].value = clamp01(s / 100);
    handleLights[idx].value = Math.max(0, Math.min(100, l));
    // If linked and idx==0, sync others that aren't freed
    if (linked && idx === 0) {
      const c = SCHEME_COUNTS[scheme] || 1;
      for (let i = 1; i < c; i++) {
        if (!freed.current.has(i)) {
          handleAngles[i].value = mod(h + offsets[i], 360);
          handleSats[i].value = clamp01(s / 100);
          handleLights[i].value = Math.max(0, Math.min(100, l));
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

        {/* Markers (show only what the scheme needs) */}
        <Animated.View pointerEvents="none" style={[m0, { zIndex: 4 }]} />
        {(SCHEME_COUNTS[scheme] || 1) >= 2 && <Animated.View pointerEvents="none" style={[m1, { zIndex: 3 }]} />}
        {(SCHEME_COUNTS[scheme] || 1) >= 3 && <Animated.View pointerEvents="none" style={[m2, { zIndex: 2 }]} />}
        {(SCHEME_COUNTS[scheme] || 1) >= 4 && <Animated.View pointerEvents="none" style={[m3, { zIndex: 1 }]} />}
      </View>
    </GestureDetector>
  );
});
