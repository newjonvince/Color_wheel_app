// components/FullColorWheel.js
// Canva-style multi-handle color wheel with Skia + Reanimated.
// Gestures run as worklets on the UI thread; hex conversion stays on the JS thread,
// so nothing non-serializable (Set/refs/closures) is captured inside worklets.

import React, { useEffect, useMemo, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Canvas, Circle, SweepGradient, RadialGradient, vec } from '@shopify/react-native-skia';

import { hslToHex, hexToHsl } from '../utils/optimizedColor';
import { SCHEME_OFFSETS, SCHEME_COUNTS } from '../constants/colorWheelConstants';

export { SCHEME_OFFSETS, SCHEME_COUNTS };

const MAX_HANDLES = 5;

// JS helper for worklet callbacks: the ref itself must never cross into a worklet,
// so the worklet calls this bound function via runOnJS instead.
const addFreedIndexCallback = (freedRef) => (idx) => {
  freedRef.current.add(idx);
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

const FullColorWheel = forwardRef(function FullColorWheel({
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
    emitPaletteJS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFollowsActive]);

  const count = Math.min(SCHEME_COUNTS[scheme] || 1, MAX_HANDLES);
  const offsets = SCHEME_OFFSETS[scheme] || [0];
  const schemeCount = useSharedValue(count);
  useEffect(() => { schemeCount.value = count; }, [count]);

  // Handle state (angle 0..360, sat 0..1, light 0..100)
  const handleAngles = [useSharedValue(0), useSharedValue(30), useSharedValue(120), useSharedValue(210), useSharedValue(300)];
  const handleSats   = [useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1)];
  const handleLights = [useSharedValue(50), useSharedValue(50), useSharedValue(50), useSharedValue(50), useSharedValue(50)];
  const activeIdx = useSharedValue(0);
  const freed = useRef(new Set(freedIndices || []));                    // JS-only
  const freedIdxSV = useSharedValue((freedIndices || []).slice());      // UI-thread safe (array)

  const addFreedIndex = useCallback(addFreedIndexCallback(freed), []);

  // Throttling for palette emission from the UI thread
  const lastEmitTime = useSharedValue(0);

  // Precomputed hue sweep
  const hueSweepColors = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= 360; i += 10) arr.push(hslToHex(i, 100, 50));
    return arr;
  }, []);

  // Initialize from initial hex + scheme
  useEffect(() => {
    const { h = 0, s = 100, l = 50 } = hexToHsl(initialHex) || {};
    const s01 = s / 100;
    handleAngles[0].value = h;
    handleSats[0].value = s01;
    handleLights[0].value = l;
    for (let i = 1; i < count; i++) {
      if (!freed.current.has(i)) {
        handleAngles[i].value = mod(h + (offsets[i] ?? 0), 360);
        handleSats[i].value = s01;
      }
      handleLights[i].value = l;
    }
    emitPaletteJS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHex]);

  // Reset freed when scheme changes
  useEffect(() => {
    freed.current.clear();
    freedIdxSV.value = [];
    const { h = 0, s = 100, l = 50 } = hexToHsl(initialHex) || {};
    const s01 = s / 100;

    // Initialize handles based on scheme
    for (let i = 1; i < count; i++) {
      const offset = offsets[i] ?? 0;
      handleAngles[i].value = mod(h + offset, 360);
      handleSats[i].value = s01;
      handleLights[i].value = l;
    }

    emitPaletteJS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme, count, offsets, initialHex]);

  // Sync prop → state
  useEffect(() => {
    freed.current = new Set(freedIndices || []);
    freedIdxSV.value = (freedIndices || []).slice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      for (let i = 1; i < count; i++) {
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
    }
  };

  const emitPaletteWorklet = (phase = 'change') => {
    'worklet';
    // Throttle to ~60fps so drags don't flood the JS thread
    const now = Date.now();
    const THROTTLE_MS = 16;

    if (now - lastEmitTime.value < THROTTLE_MS) {
      return;
    }
    lastEmitTime.value = now;

    const c = schemeCount.value;
    const triples = [];
    for (let i = 0; i < c; i++) {
      triples.push([handleAngles[i].value, handleSats[i].value, handleLights[i].value]);
    }
    const idxPref = followActive.value ? Math.max(0, Math.min(activeIdx.value, c - 1)) : 0;
    runOnJS(jsEmitPalette)(triples, idxPref, phase);
  };

  // ===== Marker visuals (Canva look) =====
  // Called unconditionally in fixed order (m0..m4), so hook order is stable.
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
      borderColor: '#E0E0E0',
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
    const rawCount = SCHEME_COUNTS[scheme] || 1;
    const c = rawCount > MAX_HANDLES ? MAX_HANDLES : rawCount;
    let best = 0, bestDist = 1e9;
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

  const hasActiveHandleCallback = typeof onActiveHandleChange === 'function';

  const tap = Gesture.Tap().onStart((e) => {
    'worklet';
    const idx = nearestHandle(e.x, e.y);
    activeIdx.value = idx;
    if (hasActiveHandleCallback) runOnJS(onActiveHandleChange)(idx);
    emitPaletteWorklet();
  });

  const pan = Gesture.Pan()
    .onBegin((e) => {
      'worklet';
      const idx = nearestHandle(e.x, e.y);
      activeIdx.value = idx;
      if (hasActiveHandleCallback) runOnJS(onActiveHandleChange)(idx);
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
        handleAngles[complementaryIdx].value = mod(deg + 180, 360);
        handleSats[complementaryIdx].value = sat;
      } else if (linked && (scheme === 'analogous' || scheme === 'triadic' || scheme === 'tetradic' || scheme === 'split-complementary')) {
        // Synchronized movement for multi-handle schemes
        const schemeOffsets = SCHEME_OFFSETS[scheme] || [0];
        const rawHandleCount = SCHEME_COUNTS[scheme] || 1;
        const handleCount = rawHandleCount > MAX_HANDLES ? MAX_HANDLES : rawHandleCount;

        for (let k = 0; k < handleCount; k++) {
          if (k !== idx) {
            const offset = schemeOffsets[k] || 0;
            handleAngles[k].value = mod(deg + offset, 360);
            handleSats[k].value = sat;
          }
        }
      } else if (linked && idx === 0) {
        // Handle other schemes (non-complementary)
        const c = schemeCount.value;
        for (let k = 1; k < c; k++) {
          const freedArray = Array.isArray(freedIdxSV.value) ? freedIdxSV.value : [];
          if (freedArray.indexOf(k) === -1) {
            const schemeOffsets = SCHEME_OFFSETS[scheme] || [0];
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
          runOnJS(addFreedIndex)(idx);
        }
        handleAngles[idx].value = withTiming(deg, { duration: 100 });
      }

      emitPaletteWorklet();
    });

  const combinedGesture = Gesture.Simultaneous(tap, pan);

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
        handleAngles[complementaryIdx].value = mod(h + 180, 360);
        handleSats[complementaryIdx].value = clamp01(s / 100);
        handleLights[complementaryIdx].value = Math.max(0, Math.min(100, l));
      } else if (scheme === 'analogous' || scheme === 'triadic' || scheme === 'tetradic' || scheme === 'split-complementary') {
        // Multi-handle schemes: All handles move together maintaining relative spacing
        const schemeOffsets = SCHEME_OFFSETS[scheme] || [0];
        const handleCount = SCHEME_COUNTS[scheme] || 1;

        for (let k = 0; k < handleCount; k++) {
          if (k !== i) {
            const offset = schemeOffsets[k] || 0;
            handleAngles[k].value = mod(h + offset, 360);
            handleSats[k].value = clamp01(s / 100);
            handleLights[k].value = Math.max(0, Math.min(100, l));
          }
        }
      } else if (i === 0) {
        // Handle other schemes when primary handle changes
        for (let k = 1; k < c; k++) {
          if (!freed.current.has(k)) {
            const offset = offsets[k] ?? 0;
            handleAngles[k].value = mod(h + offset, 360);
            handleSats[k].value = clamp01(s / 100);
            handleLights[k].value = Math.max(0, Math.min(100, l));
          }
        }
      }
    }

    emitPaletteJS();
  };

  useImperativeHandle(ref, () => ({
    setActiveHandleHSL: (h, s, l) => {
      try {
        const c = Math.min(SCHEME_COUNTS[scheme] || 1, MAX_HANDLES);
        const idx = Math.min(Math.max(activeIdx.value, 0), c - 1);
        setHandleHSL(idx, h, s, l);
      } catch (error) {
        console.warn('FullColorWheel: setActiveHandleHSL failed:', error.message);
      }
    },
    setHandleHSL: (i, h, s, l) => {
      try { setHandleHSL(i, h, s, l); } catch (error) {
        console.warn('FullColorWheel: setHandleHSL failed:', error.message);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scheme, linked, setHandleHSL, activeIdx]);

  // ===== Render: Canva look =====
  const innerSpacer = Math.max(6, radius * 0.06); // white spacer ring
  const outerRim = Math.max(10, radius * 0.10);   // glossy rim thickness

  return (
    <GestureDetector gesture={combinedGesture}>
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          {/* Outer gradient rim (dark teal -> cyan) */}
          <Circle cx={cx} cy={cy} r={radius} color="#1A3A3F" />

          {/* White spacer ring */}
          <Circle cx={cx} cy={cy} r={radius - outerRim} color="#F8F8F8" />

          {/* Hue disk */}
          <Circle cx={cx} cy={cy} r={radius - outerRim - innerSpacer}>
            <SweepGradient c={vec(cx, cy)} colors={hueSweepColors} />
          </Circle>

          {/* Desaturation toward center */}
          <Circle cx={cx} cy={cy} r={radius - outerRim - innerSpacer}>
            <RadialGradient c={vec(cx, cy)} r={radius - outerRim - innerSpacer} colors={['#FFFFFFFF', '#FFFFFF00']} />
          </Circle>
        </Canvas>

        {/* Handles */}
        <Animated.View pointerEvents="none" style={[m0, { zIndex: 4 }]} />
        <Animated.View pointerEvents="none" style={[m1, { zIndex: 3, opacity: count >= 2 ? 1 : 0 }]} />
        <Animated.View pointerEvents="none" style={[m2, { zIndex: 2, opacity: count >= 3 ? 1 : 0 }]} />
        <Animated.View pointerEvents="none" style={[m3, { zIndex: 1, opacity: count >= 4 ? 1 : 0 }]} />
        <Animated.View pointerEvents="none" style={[m4, { zIndex: 0, opacity: count >= 5 ? 1 : 0 }]} />
      </View>
    </GestureDetector>
  );
});

export default FullColorWheel;
