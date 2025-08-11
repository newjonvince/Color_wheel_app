import React, { useMemo, useRef, useState, useCallback } from 'react';
import { View, PanResponder } from 'react-native';
import { Canvas, Circle, Paint, Shader, vec } from '@shopify/react-native-skia';

// ---------- helpers ----------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const hsvToRgb = (h, s, v) => {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r=0,g=0,b=0;
  if (0<=h && h<60) [r,g,b]=[c,x,0];
  else if (60<=h && h<120) [r,g,b]=[x,c,0];
  else if (120<=h && h<180) [r,g,b]=[0,c,x];
  else if (180<=h && h<240) [r,g,b]=[0,x,c];
  else if (240<=h && h<300) [r,g,b]=[x,0,c];
  else [r,g,b]=[c,0,x]; // 300-360
  return { r: Math.round((r+m)*255), g: Math.round((g+m)*255), b: Math.round((b+m)*255) };
};
const rgbToHex = ({r,g,b}) => `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;

// Convert touch point to polar (r, θ)
const cartToPolar = (x, y, cx, cy) => {
  const dx = x - cx, dy = y - cy;
  const r = Math.sqrt(dx*dx + dy*dy);
  let theta = Math.atan2(dy, dx) * 180/Math.PI;
  if (theta < 0) theta += 360;
  return { r, theta };
};

// ---------- component ----------
export default function FullColorWheel({
  size = 320,
  ringWidth = 28,
  onChange,
  initialHex = '#FF6B6B'
}) {
  const radius = size / 2;
  const innerR = radius - ringWidth; // SV disk radius
  const cx = radius, cy = radius;

  // HSV state
  const [h, setH] = useState(0);
  const [s, setS] = useState(1);
  const [v, setV] = useState(1);

  // derive hex/color
  const hex = useMemo(() => rgbToHex(hsvToRgb(h, s, v)), [h,s,v]);

  // notify
  const emit = useCallback(() => {
    onChange?.({ hex, h, s, v });
  }, [hex, h, s, v, onChange]);

  // Initialize from initialHex (simple parser; assumes #rrggbb)
  React.useEffect(() => {
    if (!initialHex || !/^#([0-9a-f]{6})$/i.test(initialHex)) return;
    const r = parseInt(initialHex.slice(1,3),16)/255;
    const g = parseInt(initialHex.slice(3,5),16)/255;
    const b = parseInt(initialHex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const d = max - min;
    let _h = 0;
    if (d !== 0) {
      switch (max) {
        case r: _h = ((g-b)/d) % 6; break;
        case g: _h = (b-r)/d + 2; break;
        case b: _h = (r-g)/d + 4; break;
      }
      _h *= 60; if (_h < 0) _h += 360;
    }
    const _v = max;
    const _s = max === 0 ? 0 : d / max;
    setH(_h); setS(_s); setV(_v);
  }, [initialHex]);

  React.useEffect(emit, [emit]);

  // Touch handling
  const dragging = useRef(null); // 'ring' | 'disk' | null

  const handleTouch = (x, y) => {
    const { r, theta } = cartToPolar(x, y, cx, cy);
    if (dragging.current === null) {
      // Decide which zone user touched first
      if (r > innerR && r <= radius) dragging.current = 'ring';
      else if (r <= innerR) dragging.current = 'disk';
      else return;
    }
    if (dragging.current === 'ring') {
      setH(theta);
    } else {
      // Map cartesian inside disk to S/V (classic HSV "cone" wheel)
      // normalize to [-1,1]
      const nx = (x - cx) / innerR;
      const ny = (y - cy) / innerR;
      const dist = Math.min(1, Math.sqrt(nx*nx + ny*ny));
      // Saturation = distance from center, Value = 1 - radial brightness falloff
      const newS = clamp01(dist);
      const newV = clamp01(1 - 0.5 * Math.max(0, Math.abs(ny))); // subtle vertical value bias
      setS(newS);
      setV(newV);
    }
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { dragging.current = null; handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY); },
    onPanResponderMove: (e) => handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onPanResponderRelease: () => { dragging.current = null; emit(); },
    onPanResponderTerminate: () => { dragging.current = null; emit(); },
  }), [emit]);

  // Marker positions
  const hueAngleRad = (h * Math.PI) / 180;
  const hueX = cx + (radius - ringWidth/2) * Math.cos(hueAngleRad);
  const hueY = cy + (radius - ringWidth/2) * Math.sin(hueAngleRad);

  const svR = (innerR - 6) * s;
  const svX = cx + svR * Math.cos(Math.PI/4);
  const svY = cy + svR * Math.sin(Math.PI/4) + (1 - v) * 20;

  return (
    <View style={{ width: size, height: size }} {...panResponder.panHandlers}>
      <Canvas style={{ width: size, height: size }}>
        {/* Outer ring - Hue wheel */}
        <Circle cx={cx} cy={cy} r={radius} color="#FF0000" />
        <Circle cx={cx} cy={cy} r={radius - 5} color="#FF8800" />
        <Circle cx={cx} cy={cy} r={radius - 10} color="#FFFF00" />
        <Circle cx={cx} cy={cy} r={radius - 15} color="#88FF00" />
        <Circle cx={cx} cy={cy} r={radius - 20} color="#00FF00" />
        <Circle cx={cx} cy={cy} r={radius - 25} color="#00FF88" />
        
        {/* Inner circle - white background */}
        <Circle cx={cx} cy={cy} r={innerR} color="white" />
        
        {/* SV area - simplified gradient */}
        <Circle cx={cx} cy={cy} r={innerR - 6} color={hex} />
        
        {/* Markers */}
        <Circle cx={hueX} cy={hueY} r={10} color="#ffffff" />
        <Circle cx={hueX} cy={hueY} r={7} color="#333333" />
        
        <Circle cx={svX} cy={svY} r={11} color="#ffffff" />
        <Circle cx={svX} cy={svY} r={8} color="#333333" />
      </Canvas>
    </View>
  );
}
