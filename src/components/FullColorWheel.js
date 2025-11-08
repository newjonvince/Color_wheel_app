// components/FullColorWheel.js
// Canva-style multi-handle color wheel with Skia + Reanimated
// Crash-safe: no non-serializable captures inside worklets (no Set/refs); hex conversion on JS thread

// Build verification tag for crash debugging
if (!__DEV__) {
  console.log('FullColorWheel build tag: 2025-08-16 worklet-patched');
  console.log('No bundle URL present - using production build');
}

import React, { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Platform } from 'react-native';
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
    if (!__DEV__) console.log('Reanimated worklet init check failed:', e.message);
    return false;
  }
})();

import { hslToHex, hexToHsl } from '../utils/color';

let Canvas, SkiaCircle, SweepGradient, RadialGradient, Paint, vec;
try {
  // iOS-safe Skia loading with platform check
  if (Platform.OS === 'ios') {
    const Skia = require('@shopify/react-native-skia');
    Canvas = Skia.Canvas;
    SkiaCircle = Skia.Circle;
    SweepGradient = Skia.SweepGradient;
    RadialGradient = Skia.RadialGradient;
    Paint = Skia.Paint;
    vec = Skia.vec;
  } else {
    const Skia = require('@shopify/react-native-skia');
    Canvas = Skia.Canvas;
    SkiaCircle = Skia.Circle;
    SweepGradient = Skia.SweepGradient;
    RadialGradient = Skia.RadialGradient;
    Paint = Skia.Paint;
    vec = Skia.vec;
  }
} catch (e) {
  if (!__DEV__) console.log('Skia module load failed on', Platform.OS + ':', e.message);
  Canvas = View;
  SkiaCircle = () => null;
  SweepGradient = () => null;
  RadialGradient = () => null;
  Paint = null;
  vec = () => null;
}

export const SCHEME_OFFSETS = {
  complementary: [0, 180],
  analogous: [0, 30, -30],
  triadic: [0, 120, 240],
  tetradic: [0, 90, 180, 270],
  'split-complementary': [0, 150, -150],
  monochromatic: [0, 0, 0],
};
export const SCHEME_COUNTS = {
  complementary: 2,
  analogous: 3,
  triadic: 3,
  tetradic: 4,
  'split-complementary': 3,
  monochromatic: 3,
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
    for (let i=1; i<count; i++) {
      handleAngles[i].value = mod(h + (offsets[i] ?? 0), 360);
      handleSats[i].value = s01;
      handleLights[i].value = l;
    }
    emitPalette();
  }, [scheme]);

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
    for (let i=1; i<count; i++) {
      if (!freed.current.has(i)) {
        handleAngles[i].value = mod(base + offsets[i], 360);
        handleSats[i].value = sat0;
      }
    }
    emitPalette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, scheme]);

  // ===== Palette emission: compute hexes on JS (avoid calling hslToHex in a worklet) =====
  const jsEmitPalette = (triples, activePref) => {
    try {
      const out = triples.map(([ang, s01, light]) => hslToHex(ang, s01 * 100, light));
      if (typeof onColorsChange === 'function') onColorsChange(out);
      if (typeof onHexChange === 'function') {
        const idx = (selectedFollowsActive ? Math.max(0, Math.min(activePref, out.length - 1)) : 0);
        onHexChange(out[idx]);
      }
    } catch {}
  };

  const emitPalette = () => {
    'worklet';
    try {
      const c = schemeCount.value;
      const triples = [];
      for (let i=0;i<c;i++) {
        triples.push([handleAngles[i].value, handleSats[i].value, handleLights[i].value]);
      }
      const idxPref = followActive.value ? Math.max(0, Math.min(activeIdx.value, c - 1)) : 0;
      callJS(jsEmitPalette, triples, idxPref);
    } catch(e) {}
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
      borderColor: '#00000022',
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
    const c = SCHEME_COUNTS[scheme] || 1;
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
      if (linked && idx !== 0) {
        // Keep UI-thread state and JS Set in sync without capturing Set in the worklet
        const arr = Array.isArray(freedIdxSV.value) ? freedIdxSV.value.slice() : [];
        if (arr.indexOf(idx) === -1) {
          arr.push(idx);
          freedIdxSV.value = arr;
        }
        callJS((k) => { freed.current.add(k); }, idx);
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

  // Public setters live on JS: safe to consult JS Set + props
  const setHandleHSL = (idx, h, s, l) => {
    const c = SCHEME_COUNTS[scheme] || 1;
    const i = Math.max(0, Math.min(idx, c - 1));
    handleAngles[i].value = mod(h, 360);
    handleSats[i].value = clamp01(s / 100);
    handleLights[i].value = Math.max(0, Math.min(100, l));
    if (linked && i === 0) {
      for (let k=1;k<c;k++) {
        if (!freed.current.has(k)) {
          handleAngles[k].value = mod(h + offsets[k], 360);
          handleSats[k].value = clamp01(s/100);
          handleLights[k].value = Math.max(0, Math.min(100, l));
        }
      }
    }
    emitPalette();
  };

  useImperativeHandle(ref, () => ({
    setActiveHandleHSL: (h,s,l) => {
      try {
        const idx = Math.min(Math.max(activeIdx.value, 0), (SCHEME_COUNTS[scheme]||1)-1);
        setHandleHSL(idx, h, s, l);
      } catch {}
    },
    setHandleHSL: (i,h,s,l) => {
      try { setHandleHSL(i,h,s,l); } catch {}
    }
  }), [scheme, linked]);

  // ===== Render: Canva look =====
  const innerSpacer = Math.max(6, radius * 0.06); // white spacer ring
  const outerRim = Math.max(10, radius * 0.10);   // glossy rim thickness

  return (
    <GestureDetector gesture={Gesture.Simultaneous(tap, pan)}>
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          {/* Outer gradient rim (dark teal -> cyan) */}
          <SkiaCircle cx={cx} cy={cy} r={radius}>
            <RadialGradient c={vec(cx, cy)} r={radius} colors={['#0A2324', '#9EE8FF']} />
          </SkiaCircle>

          {/* White spacer ring */}
          <SkiaCircle cx={cx} cy={cy} r={radius - outerRim}>
            <RadialGradient c={vec(cx, cy)} r={radius - outerRim} colors={['#FFFFFF', '#FFFFFF']} />
          </SkiaCircle>

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
