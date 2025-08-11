import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Path, Circle } from 'react-native-svg';

/**
 * FullColorWheel
 * Props:
 *   size: number
 *   strokeWidth?: number (ring thickness)
 *   scheme: 'analogous'|'complementary'|'triadic'|'tetradic'|'monochromatic'
 *   initialHex?: string
 *   onColorsChange?: (colors: string[]) => void  // fires continuously as the user drags
 *   onHexChange?: (hex: string) => void          // base color hex
 */
const TAU = Math.PI * 2;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const normAngle = (a) => {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
};

const hslToHex = (h, s, l) => {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

const hexToHsl = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const schemeOffsets = {
  complementary: [0, 180],
  analogous: [0, 30, -30],
  triadic: [0, 120, 240],
  tetradic: [0, 90, 180, 270],
  monochromatic: [0, 0, 0],
};

export default function FullColorWheel({
  size,
  strokeWidth = 30,
  scheme = 'triadic',
  initialHex = '#1ECB E1'.replace(' ', ''),
  onColorsChange,
  onHexChange,
}) {
  const radius = size / 2;
  const innerR = radius - strokeWidth;
  const [baseAngle, setBaseAngle] = useState(() => hexToHsl(initialHex).h || 180);
  const [activeMarker, setActiveMarker] = useState(0);
  const layoutRef = useRef({ x: 0, y: 0 }); // top-left of wheel in screen coords

  // markers are derived from baseAngle + scheme offsets
  const markers = useMemo(() => {
    const offsets = schemeOffsets[scheme] || [0];
    return offsets.map((off, i) => {
      const a = normAngle(baseAngle + off);
      const rad = (a - 90) * (Math.PI / 180);
      const ringR = innerR + strokeWidth / 2;
      return {
        id: i,
        angle: a,
        x: radius + Math.cos(rad) * ringR,
        y: radius + Math.sin(rad) * ringR,
        color: hslToHex(a, 100, scheme === 'monochromatic' && i > 0 ? (i === 1 ? 30 : 70) : 50),
        isActive: i === activeMarker,
      };
    });
  }, [baseAngle, scheme, radius, innerR, strokeWidth]);

  // current palette from markers
  const palette = useMemo(() => markers.map(m => m.color), [markers]);

  useEffect(() => {
    onColorsChange && onColorsChange(palette);
    onHexChange && onHexChange(markers[0]?.color || initialHex);
  }, [palette]); // eslint-disable-line

  const pointToAngle = useCallback((px, py) => {
    const cx = radius;
    const cy = radius;
    const dx = px - cx;
    const dy = py - cy;
    let ang = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    return normAngle(ang);
  }, [radius]);

  // When user drags anywhere on the ring, rotate baseAngle and keep offsets
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt, _gs) => {
      const { locationX, locationY } = evt.nativeEvent;
      // choose nearest marker to become active (nice UX)
      let nearest = 0, best = 99999;
      markers.forEach((m, idx) => {
        const dx = m.x - locationX, dy = m.y - locationY;
        const d2 = dx*dx + dy*dy;
        if (d2 < best) { best = d2; nearest = idx; }
      });
      setActiveMarker(nearest);
      const ang = pointToAngle(locationX, locationY);
      // translate drag start to new base angle for this marker
      const off = schemeOffsets[scheme]?.[nearest] || 0;
      const newBase = normAngle(ang - off);
      setBaseAngle(newBase);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const ang = pointToAngle(locationX, locationY);
      const off = schemeOffsets[scheme]?.[activeMarker] || 0;
      setBaseAngle(normAngle(ang - off));
    },
  }), [markers, activeMarker, pointToAngle, scheme]);

  const gradientStops = useMemo(() => (
    Array.from({ length: 360 }, (_, i) => ({
      angle: i,
      color: hslToHex(i, 100, 50),
    }))
  ), []);

  // ring path (donut)
  const ringPath = useMemo(() => {
    const R = radius, r = innerR;
    return `
      M ${R} 0
      A ${R} ${R} 0 1 1 ${R - 0.01} 0
      L ${r - 0.01} 0
      A ${r} ${r} 0 1 0 ${r} 0
      Z
    `;
  }, [radius, innerR]);

  return (
    <View
      style={{ width: size, height: size }}
      {...panResponder.panHandlers}
      onLayout={(e) => {
        const { x, y } = e.nativeEvent.layout;
        layoutRef.current = { x, y };
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="cw_grad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Hue ring composed of 360 thin slices */}
        {Array.from({ length: 360 }, (_, i) => {
          const start = (i - 90) * (Math.PI / 180);
          const end = (i + 1 - 90) * (Math.PI / 180);
          const Ro = radius, Ri = innerR;
          const x1 = radius + Ri * Math.cos(start);
          const y1 = radius + Ri * Math.sin(start);
          const x2 = radius + Ro * Math.cos(start);
          const y2 = radius + Ro * Math.sin(start);
          const x3 = radius + Ro * Math.cos(end);
          const y3 = radius + Ro * Math.sin(end);
          const x4 = radius + Ri * Math.cos(end);
          const y4 = radius + Ri * Math.sin(end);
          return (
            <Path
              key={`seg-${i}`}
              d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`}
              fill={hslToHex(i, 100, 50)}
            />
          );
        })}

        {/* soft inner glow */}
        <Path d={ringPath} fill="url(#cw_grad)" opacity={0.75} />

        {/* Markers */}
        {markers.map((m, idx) => (
          <Circle
            key={`m-${idx}`}
            cx={m.x}
            cy={m.y}
            r={idx === activeMarker ? 10 : 8}
            fill={m.color}
            stroke="#FFFFFF"
            strokeWidth={idx === activeMarker ? 4 : 3}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({});