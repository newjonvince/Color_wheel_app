// components/FullColorWheel.js
// Canva-style color wheel: a hue/saturation disk, a lightness ring around it, and
// scheme-linked handles. Skia draws the wheel; gestures run as Reanimated worklets on
// the UI thread; hex conversion stays on the JS thread so nothing non-serializable
// (Set/refs/closures) is captured inside a worklet.

import React, {
  useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle, useCallback,
} from 'react';
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
const MAIN_HANDLE = 28;
const SUB_HANDLE = 18;
const LIGHT_HANDLE = 20;
const DISK_CENTER = '#8C8C8C'; // neutral gray: saturation 0 at the center of the disk

// The ref itself must never cross into a worklet; worklets call this bound JS function via runOnJS.
const addFreedIndexCallback = (freedRef) => (idx) => {
  freedRef.current.add(idx);
};

// Pure helpers, safe inside worklets (no captures)
const clamp01 = (v) => {
  'worklet';
  return Math.max(0, Math.min(1, v));
};
const clamp100 = (v) => {
  'worklet';
  return Math.max(0, Math.min(100, v));
};
const mod = (a, n) => {
  'worklet';
  return ((a % n) + n) % n;
};

const markerBase = {
  position: 'absolute',
  borderRadius: 999,
  borderColor: '#FFFFFF',
  backgroundColor: 'transparent',
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
};

const FullColorWheel = forwardRef(function FullColorWheel({
  selectedFollowsActive = true,
  size,
  scheme = 'complementary',
  initialHex = '#FF6B6B',
  linked = true,
  freedIndices = [],
  onToggleLinked, // accepted for API compatibility; linking is toggled by the parent
  onColorsChange,
  onHexChange,
  onActiveHandleChange,
}, ref) {
  // ===== Geometry =====
  const radius = size / 2;
  const cx = radius, cy = radius;
  const ringWidth = Math.max(10, radius * 0.075);   // lightness ring thickness
  const gap = Math.max(6, radius * 0.045);          // white spacer between ring and disk
  const diskRadius = radius - ringWidth - gap;      // hue/saturation disk
  const ringRadius = radius - ringWidth / 2;        // centerline of the lightness ring

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
  const dragMode = useSharedValue(0); // 0 = moving a handle on the disk, 1 = sliding the lightness ring
  const freed = useRef(new Set(freedIndices || []));                    // JS-only
  const freedIdxSV = useSharedValue((freedIndices || []).slice());      // UI-thread safe (array)

  const addFreedIndex = useCallback(addFreedIndexCallback(freed), []);

  const lastEmitTime = useSharedValue(0);

  // Ring color follows the active handle's hue/saturation at mid lightness (JS state: it is a Skia prop)
  const [ringHex, setRingHex] = useState(() => {
    const { h = 0, s = 100 } = hexToHsl(initialHex) || {};
    return hslToHex(h, s, 50);
  });

  // Skia sweeps clockwise from 3 o'clock and clamps outside 0..360, so instead of a negative
  // start angle the color lists are rotated a quarter turn: index 0 is the hue at 3 o'clock
  // (90), which puts red at 12 o'clock to match the handle math (angle - 90).
  const hueSweepColors = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= 360; i += 10) arr.push(hslToHex((i + 90) % 360, 100, 50));
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

  // Reset freed handles when the scheme changes
  useEffect(() => {
    freed.current.clear();
    freedIdxSV.value = [];
    const { h = 0, s = 100, l = 50 } = hexToHsl(initialHex) || {};
    const s01 = s / 100;
    for (let i = 1; i < count; i++) {
      handleAngles[i].value = mod(h + (offsets[i] ?? 0), 360);
      handleSats[i].value = s01;
      handleLights[i].value = l;
    }
    emitPaletteJS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme, count, offsets, initialHex]);

  // Sync prop -> state
  useEffect(() => {
    freed.current = new Set(freedIndices || []);
    freedIdxSV.value = (freedIndices || []).slice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freedIndices]);

  // When linking turns on, re-sync dependents to the base handle
  useEffect(() => {
    if (!linked) return;
    const base = handleAngles[0].value;
    const sat0 = handleSats[0].value;
    const light0 = handleLights[0].value;

    if (scheme === 'complementary') {
      handleAngles[1].value = mod(base + 180, 360);
      handleSats[1].value = sat0;
      handleLights[1].value = light0;
    } else if (scheme === 'analogous' || scheme === 'triadic' || scheme === 'tetradic' || scheme === 'split-complementary') {
      const schemeOffsets = SCHEME_OFFSETS[scheme] || [0];
      const handleCount = SCHEME_COUNTS[scheme] || 1;
      for (let i = 0; i < handleCount; i++) {
        handleAngles[i].value = mod(base + (schemeOffsets[i] || 0), 360);
        handleSats[i].value = sat0;
        handleLights[i].value = light0;
      }
    } else {
      for (let i = 1; i < count; i++) {
        if (!freed.current.has(i)) {
          handleAngles[i].value = mod(base + (offsets[i] ?? 0), 360);
          handleSats[i].value = sat0;
          handleLights[i].value = light0;
        }
      }
    }
    emitPaletteJS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, scheme, count, offsets]);

  // ===== Palette emission: hex math happens on JS =====
  const jsEmitPalette = (triples, activePref, phase = 'change', activeIndex = 0) => {
    try {
      const out = triples.map(([ang, s01, light]) => hslToHex(ang, s01 * 100, light));
      const ringSource = triples[Math.max(0, Math.min(activeIndex, triples.length - 1))];
      if (ringSource) setRingHex(hslToHex(ringSource[0], ringSource[1] * 100, 50));
      if (typeof onColorsChange === 'function') onColorsChange(out, phase);
      if (typeof onHexChange === 'function') {
        const idx = selectedFollowsActive ? Math.max(0, Math.min(activePref, out.length - 1)) : 0;
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
      const active = Math.max(0, Math.min(activeIdx.value, c - 1));
      const activePref = selectedFollowsActive ? active : 0;
      jsEmitPalette(triples, activePref, phase, active);
    } catch (error) {
      console.warn('FullColorWheel: emitPaletteJS failed:', error.message);
    }
  };

  const emitPaletteWorklet = (phase = 'change', force = false) => {
    'worklet';
    // Throttle to ~60fps so drags don't flood the JS thread; gesture end always goes through
    const now = Date.now();
    if (!force && now - lastEmitTime.value < 16) return;
    lastEmitTime.value = now;

    const c = schemeCount.value;
    const triples = [];
    for (let i = 0; i < c; i++) {
      triples.push([handleAngles[i].value, handleSats[i].value, handleLights[i].value]);
    }
    const active = Math.max(0, Math.min(activeIdx.value, c - 1));
    const idxPref = followActive.value ? active : 0;
    runOnJS(jsEmitPalette)(triples, idxPref, phase, active);
  };

  // ===== Marker visuals =====
  // Called unconditionally in fixed order (m0..m4), so hook order is stable.
  const markerStyle = (idx) => useAnimatedStyle(() => {
    'worklet';
    const isMain = idx === 0;
    const d = isMain ? MAIN_HANDLE : SUB_HANDLE;
    const rad = ((handleAngles[idx].value - 90) * Math.PI) / 180;
    const r = diskRadius * clamp01(handleSats[idx].value);
    return {
      left: cx - d / 2 + Math.cos(rad) * r,
      top: cy - d / 2 + Math.sin(rad) * r,
      width: d,
      height: d,
      borderWidth: isMain ? 4 : 2.5,
    };
  });
  const m0 = markerStyle(0);
  const m1 = markerStyle(1);
  const m2 = markerStyle(2);
  const m3 = markerStyle(3);
  const m4 = markerStyle(4);

  // Lightness handle sits on the right half of the ring: top = 0%, right = 50%, bottom = 100%
  const lightMarker = useAnimatedStyle(() => {
    'worklet';
    const i = Math.max(0, Math.min(activeIdx.value, MAX_HANDLES - 1));
    const theta = (clamp100(handleLights[i].value) / 100) * Math.PI;
    return {
      left: cx - LIGHT_HANDLE / 2 + Math.sin(theta) * ringRadius,
      top: cy - LIGHT_HANDLE / 2 - Math.cos(theta) * ringRadius,
    };
  });

  // ===== Gesture helpers (worklets) =====
  const nearestHandle = (x, y) => {
    'worklet';
    const rawCount = SCHEME_COUNTS[scheme] || 1;
    const c = rawCount > MAX_HANDLES ? MAX_HANDLES : rawCount;
    let best = 0, bestDist = 1e9;
    for (let i = 0; i < c; i++) {
      const ang = ((handleAngles[i].value - 90) * Math.PI) / 180;
      const r = diskRadius * clamp01(handleSats[i].value);
      const d = Math.hypot(x - (cx + Math.cos(ang) * r), y - (cy + Math.sin(ang) * r));
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  };

  const isOnRing = (x, y) => {
    'worklet';
    return Math.hypot(x - cx, y - cy) > diskRadius + gap / 2;
  };

  // Lightness from a touch angle: clockwise from the top; the left half mirrors the right
  const lightnessAt = (x, y) => {
    'worklet';
    const deg = mod((Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90, 360);
    const t = deg <= 180 ? deg / 180 : (360 - deg) / 180;
    return t * 100;
  };

  const applyLightness = (light) => {
    'worklet';
    const idx = activeIdx.value;
    handleLights[idx].value = light;
    if (linked) {
      const c = schemeCount.value;
      const freedArray = Array.isArray(freedIdxSV.value) ? freedIdxSV.value : [];
      for (let k = 0; k < c; k++) {
        if (k !== idx && freedArray.indexOf(k) === -1) handleLights[k].value = light;
      }
    }
  };

  const hasActiveHandleCallback = typeof onActiveHandleChange === 'function';

  const tap = Gesture.Tap().onStart((e) => {
    'worklet';
    if (isOnRing(e.x, e.y)) {
      applyLightness(lightnessAt(e.x, e.y));
      emitPaletteWorklet('end', true);
      return;
    }
    const idx = nearestHandle(e.x, e.y);
    activeIdx.value = idx;
    if (hasActiveHandleCallback) runOnJS(onActiveHandleChange)(idx);
    emitPaletteWorklet('end', true);
  });

  const pan = Gesture.Pan()
    .onBegin((e) => {
      'worklet';
      if (isOnRing(e.x, e.y)) {
        dragMode.value = 1;
        applyLightness(lightnessAt(e.x, e.y));
        emitPaletteWorklet();
        return;
      }
      dragMode.value = 0;
      const idx = nearestHandle(e.x, e.y);
      activeIdx.value = idx;
      if (hasActiveHandleCallback) runOnJS(onActiveHandleChange)(idx);
      emitPaletteWorklet();
    })
    .onChange((e) => {
      'worklet';
      if (dragMode.value === 1) {
        applyLightness(lightnessAt(e.x, e.y));
        emitPaletteWorklet();
        return;
      }

      const idx = activeIdx.value;
      const ang = (Math.atan2(e.y - cy, e.x - cx) * 180) / Math.PI;
      const deg = mod(ang + 450, 360);
      const sat = clamp01(Math.hypot(e.x - cx, e.y - cy) / diskRadius);

      handleAngles[idx].value = deg;
      handleSats[idx].value = sat;

      if (linked && scheme === 'complementary') {
        const other = idx === 0 ? 1 : 0;
        handleAngles[other].value = mod(deg + 180, 360);
        handleSats[other].value = sat;
      } else if (linked && (scheme === 'analogous' || scheme === 'triadic' || scheme === 'tetradic' || scheme === 'split-complementary')) {
        // Multi-handle schemes: all handles move together, keeping their relative spacing
        const schemeOffsets = SCHEME_OFFSETS[scheme] || [0];
        const rawHandleCount = SCHEME_COUNTS[scheme] || 1;
        const handleCount = rawHandleCount > MAX_HANDLES ? MAX_HANDLES : rawHandleCount;
        const baseDeg = mod(deg - (schemeOffsets[idx] || 0), 360);
        for (let k = 0; k < handleCount; k++) {
          if (k !== idx) {
            handleAngles[k].value = mod(baseDeg + (schemeOffsets[k] || 0), 360);
            handleSats[k].value = sat;
          }
        }
      } else if (linked && idx === 0) {
        const c = schemeCount.value;
        const freedArray = Array.isArray(freedIdxSV.value) ? freedIdxSV.value : [];
        const schemeOffsets = SCHEME_OFFSETS[scheme] || [0];
        for (let k = 1; k < c; k++) {
          if (freedArray.indexOf(k) === -1) {
            handleAngles[k].value = mod(deg + (k < schemeOffsets.length ? schemeOffsets[k] : 0), 360);
            handleSats[k].value = sat;
          }
        }
      } else if (linked && idx !== 0) {
        // A dependent handle dragged on its own becomes free
        const currentFreed = Array.isArray(freedIdxSV.value) ? freedIdxSV.value : [];
        if (currentFreed.indexOf(idx) === -1) {
          freedIdxSV.value = currentFreed.concat([idx]);
          runOnJS(addFreedIndex)(idx);
        }
        handleAngles[idx].value = withTiming(deg, { duration: 100 });
      }

      emitPaletteWorklet();
    })
    .onFinalize(() => {
      'worklet';
      emitPaletteWorklet('end', true);
    });

  const combinedGesture = Gesture.Simultaneous(tap, pan);

  // ===== Public setters (JS): may consult the JS Set and props =====
  const setHandleHSL = (idx, h, s, l) => {
    const c = Math.min(SCHEME_COUNTS[scheme] || 1, MAX_HANDLES);
    const i = Math.max(0, Math.min(idx, c - 1));
    const s01 = clamp01(s / 100);
    const light = clamp100(l);
    handleAngles[i].value = mod(h, 360);
    handleSats[i].value = s01;
    handleLights[i].value = light;

    if (linked) {
      if (scheme === 'complementary') {
        const other = i === 0 ? 1 : 0;
        handleAngles[other].value = mod(h + 180, 360);
        handleSats[other].value = s01;
        handleLights[other].value = light;
      } else if (scheme === 'analogous' || scheme === 'triadic' || scheme === 'tetradic' || scheme === 'split-complementary') {
        const schemeOffsets = SCHEME_OFFSETS[scheme] || [0];
        const handleCount = Math.min(SCHEME_COUNTS[scheme] || 1, MAX_HANDLES);
        const baseDeg = mod(h - (schemeOffsets[i] || 0), 360);
        for (let k = 0; k < handleCount; k++) {
          if (k !== i) {
            handleAngles[k].value = mod(baseDeg + (schemeOffsets[k] || 0), 360);
            handleSats[k].value = s01;
            handleLights[k].value = light;
          }
        }
      } else if (i === 0) {
        for (let k = 1; k < c; k++) {
          if (!freed.current.has(k)) {
            handleAngles[k].value = mod(h + (offsets[k] ?? 0), 360);
            handleSats[k].value = s01;
            handleLights[k].value = light;
          }
        }
      }
    }
    emitPaletteJS('end');
  };

  useImperativeHandle(ref, () => ({
    setActiveHandleHSL: (h, s, l) => {
      try {
        const c = Math.min(SCHEME_COUNTS[scheme] || 1, MAX_HANDLES);
        setHandleHSL(Math.min(Math.max(activeIdx.value, 0), c - 1), h, s, l);
      } catch (error) {
        console.warn('FullColorWheel: setActiveHandleHSL failed:', error.message);
      }
    },
    setHandleHSL: (i, h, s, l) => {
      try { setHandleHSL(i, h, s, l); } catch (error) {
        console.warn('FullColorWheel: setHandleHSL failed:', error.message);
      }
    },
    // Make handle i the active one (the one the lightness ring and "follow active" track)
    selectHandle: (i) => {
      try {
        const c = Math.min(SCHEME_COUNTS[scheme] || 1, MAX_HANDLES);
        activeIdx.value = Math.max(0, Math.min(i, c - 1));
        emitPaletteJS('end');
      } catch (error) {
        console.warn('FullColorWheel: selectHandle failed:', error.message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scheme, linked, setHandleHSL, activeIdx]);

  // ===== Render =====
  const center = vec(cx, cy);
  return (
    <GestureDetector gesture={combinedGesture}>
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          {/* Lightness ring: black at the top, the active color at the sides, white at the bottom
              (sweep starts at 3 o'clock: color -> white (6) -> color (9) -> black (12) -> color) */}
          <Circle cx={cx} cy={cy} r={ringRadius} style="stroke" strokeWidth={ringWidth}>
            <SweepGradient
              c={center}
              colors={[ringHex, '#FFFFFF', ringHex, '#000000', ringHex]}
              positions={[0, 0.25, 0.5, 0.75, 1]}
            />
          </Circle>

          {/* White spacer */}
          <Circle cx={cx} cy={cy} r={radius - ringWidth} color="#FFFFFF" />

          {/* Hue disk, red at 12 o'clock, clockwise (see hueSweepColors) */}
          <Circle cx={cx} cy={cy} r={diskRadius}>
            <SweepGradient c={center} colors={hueSweepColors} />
          </Circle>

          {/* Saturation falls to neutral gray at the center */}
          <Circle cx={cx} cy={cy} r={diskRadius}>
            <RadialGradient c={center} r={diskRadius} colors={[DISK_CENTER + 'FF', DISK_CENTER + '00']} />
          </Circle>
        </Canvas>

        {/* Scheme handles (hollow rings, main one larger) */}
        <Animated.View pointerEvents="none" style={[markerBase, m0, { zIndex: 5 }]} />
        <Animated.View pointerEvents="none" style={[markerBase, m1, { zIndex: 4, opacity: count >= 2 ? 1 : 0 }]} />
        <Animated.View pointerEvents="none" style={[markerBase, m2, { zIndex: 3, opacity: count >= 3 ? 1 : 0 }]} />
        <Animated.View pointerEvents="none" style={[markerBase, m3, { zIndex: 2, opacity: count >= 4 ? 1 : 0 }]} />
        <Animated.View pointerEvents="none" style={[markerBase, m4, { zIndex: 1, opacity: count >= 5 ? 1 : 0 }]} />

        {/* Lightness handle on the ring */}
        <Animated.View
          pointerEvents="none"
          style={[
            markerBase,
            lightMarker,
            { width: LIGHT_HANDLE, height: LIGHT_HANDLE, borderWidth: 2, borderColor: '#E6E6E6', backgroundColor: '#FFFFFF', zIndex: 6 },
          ]}
        />
      </View>
    </GestureDetector>
  );
});

export default FullColorWheel;
