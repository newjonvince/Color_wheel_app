// screens/ColorWheelScreen.js
// Screen that hosts the wheel + controls: link/unlink, H/S/L inputs, reset, randomize, and shows scheme swatches.

import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, View, Text, TextInput, Pressable } from 'react-native';
import FullColorWheel, { SCHEME_COUNTS, SCHEME_OFFSETS } from '../components/FullColorWheel';
import { getColorScheme, hexToHsl, hslToHex } from '../utils/color';

const { width: screenWidth } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(screenWidth * 0.9, 380);

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mod = (a, n) => ((a % n) + n) % n;

export default function ColorWheelScreen() {
  const [selectedFollowsActive, setSelectedFollowsActive] = React.useState(true);
  const wheelRef = React.useRef(null);
  const [selectedScheme, setSelectedScheme] = useState('complementary');
  const [palette, setPalette] = useState(['#FF6B6B']);
  const [selectedColor, setSelectedColor] = useState('#FF6B6B');
  const [linked, setLinked] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  // HSL input state is derived from Selected Color (active handle will update wheel though)
  const hsl = hexToHsl(selectedColor) || { h: 0, s: 100, l: 50 };
  const [hIn, setHIn] = useState(String(Math.round(hsl.h)));
  const [sIn, setSIn] = useState(String(Math.round(hsl.s)));
  const [lIn, setLIn] = useState(String(Math.round(hsl.l)));

  // Keep text fields in sync when selectedColor changes
  React.useEffect(() => {
    const { h=0, s=100, l=50 } = hexToHsl(selectedColor) || {};
    setHIn(String(Math.round(h)));
    setSIn(String(Math.round(s)));
    setLIn(String(Math.round(l)));
  }, [selectedColor]);

  const applyNumericInputs = () => {
    // Move active handle to these HSL values; FullColorWheel uses onHexChange/onColorsChange
    const H = mod(parseFloat(hIn) || 0, 360);
    const S = Math.max(0, Math.min(100, parseFloat(sIn) || 0));
    const L = Math.max(0, Math.min(100, parseFloat(lIn) || 0));
    // Selected color preview updates immediately
    setSelectedColor(hslToHex(H, S, L));
    // The wheel listens via initialHex only on mount; since it’s expensive to plumb full imperative refs,
    // we’ll update the palette locally (Selected Color) and let onColorsChange next drag refresh everything.
    // (If you want full imperative numeric control, we can expose a ref API in the wheel next pass.)
  };

  const resetScheme = () => {
    // Reset to canonical offsets from current base hue
    const { h=0, s=100, l=50 } = hexToHsl(selectedColor) || {};
    const c = SCHEME_COUNTS[selectedScheme] || 1;
    const offs = SCHEME_OFFSETS[selectedScheme] || [0];
    const sat01 = s / 100;
    const result = [];
    for (let i=0;i<c;i++) {
      const ang = mod(h + (offs[i] ?? 0), 360);
      result.push(hslToHex(ang, sat01*100, l));
    }
    setPalette(result);
    setLinked(true);
  };

  const randomize = () => {
    const h = Math.floor(Math.random()*360);
    const s = 60 + Math.floor(Math.random()*40); // 60–100%
    const l = 45 + Math.floor(Math.random()*10); // 45–55%
    setSelectedColor(hslToHex(h, s, l));
    resetScheme();
  };

  // Prefer live palette from wheel; otherwise derive
  const schemeColors = useMemo(() => {
    if (Array.isArray(palette) && palette.length > 0) return palette;
    return getColorScheme(selectedColor, selectedScheme, 0);
  }, [palette, selectedColor, selectedScheme]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 12 }}>
      {/* Wheel */}
      <FullColorWheel
        ref={wheelRef}
        selectedFollowsActive={selectedFollowsActive}
        size={WHEEL_SIZE}
        scheme={selectedScheme}
        initialHex={selectedColor}
        linked={linked}
        onToggleLinked={() => setLinked(v => !v)}
        onColorsChange={(colors) => {
          if (Array.isArray(colors) && colors.length) setPalette(colors);
        }}
        onHexChange={(hex) => {
          if (hex) setSelectedColor(hex);
        }}
        onActiveHandleChange={(i) => setActiveIdx(i)}
      />

      {/* Controls row */}
      <View style={{ width: '92%', maxWidth: 520, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Link toggle */}
          <Pressable
            onPress={() => setLinked(v => !v)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: linked ? '#e8f5e9' : '#ffebee', borderWidth: 1, borderColor: linked ? '#2e7d32' : '#c62828' }}
          >
            <Text style={{ fontWeight: '600' }}>{linked ? 'Linked' : 'Unlinked'}</Text>
          </Pressable>

          {/* Selected Color mode toggle */}
          <Pressable
            onPress={() => setSelectedFollowsActive(v => !v)}
            style={{ marginLeft: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: selectedFollowsActive ? '#e3f2fd' : '#fff3e0', borderWidth: 1, borderColor: selectedFollowsActive ? '#1565c0' : '#ef6c00' }}
          >
            <Text style={{ fontWeight: '600' }}>{selectedFollowsActive ? 'Selected = Active Handle' : 'Selected = Handle #1'}</Text>
          </Pressable>

          {/* Reset & Random */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={resetScheme} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#999' }}>
              <Text>Reset</Text>
            </Pressable>
            <Pressable onPress={randomize} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#999' }}>
              <Text>Randomize</Text>
            </Pressable>
          </View>
        </View>

        {/* Numeric H/S/L */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#555' }}>H</Text>
            <TextInput
              value={hIn}
              onChangeText={(v) => { setHIn(v); try { const H = ((parseFloat(v) || 0)%360+360)%360; const S = Math.max(0, Math.min(100, parseFloat(sIn) || 0)); const L = Math.max(0, Math.min(100, parseFloat(lIn) || 0)); if (wheelRef.current && wheelRef.current.setActiveHandleHSL) { wheelRef.current.setActiveHandleHSL(H,S,L); } } catch(e){} }}
              onBlur={applyNumericInputs}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              placeholder="0–360"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#555' }}>S (%)</Text>
            <TextInput
              value={sIn}
              onChangeText={(v) => { setSIn(v); try { const H = ((parseFloat(hIn) || 0)%360+360)%360; const S = Math.max(0, Math.min(100, parseFloat(v) || 0)); const L = Math.max(0, Math.min(100, parseFloat(lIn) || 0)); if (wheelRef.current && wheelRef.current.setActiveHandleHSL) { wheelRef.current.setActiveHandleHSL(H,S,L); } } catch(e){} }}
              onBlur={applyNumericInputs}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              placeholder="0–100"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#555' }}>L (%)</Text>
            <TextInput
              value={lIn}
              onChangeText={(v) => { setLIn(v); try { const H = ((parseFloat(hIn) || 0)%360+360)%360; const S = Math.max(0, Math.min(100, parseFloat(sIn) || 0)); const L = Math.max(0, Math.min(100, parseFloat(v) || 0)); if (wheelRef.current && wheelRef.current.setActiveHandleHSL) { wheelRef.current.setActiveHandleHSL(H,S,L); } } catch(e){} }}
              onBlur={applyNumericInputs}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              placeholder="0–100"
            />
          </View>
        </View>
      </View>

      {/* Swatches preview */}
      <View style={{ width: '92%', maxWidth: 520, marginTop: 16 }}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Selected Color</Text>
        <View style={{ width: '100%', height: 44, borderRadius: 8, backgroundColor: selectedColor, borderWidth: 1, borderColor: '#ddd' }} />
        <Text style={{ fontWeight: '700', marginTop: 16, marginBottom: 6 }}>{selectedScheme[0].toUpperCase() + selectedScheme.slice(1)} swatches</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {schemeColors.map((c, i) => (
            <View key={i} style={{
              flex: 1, height: 40, borderRadius: 8, backgroundColor: c, borderWidth: 1, borderColor: '#ddd',
              opacity: i === activeIdx ? 1 : 0.95
            }} />
          ))}
        </View>
      </View>
    </View>
  );
}
