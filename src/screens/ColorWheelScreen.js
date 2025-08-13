// screens/ColorWheelScreen.js
// Screen that hosts the wheel + controls: link/unlink, H/S/L inputs, reset, randomize, and shows scheme swatches.

import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, View, Text, TextInput, Pressable, TouchableOpacity } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { getColorScheme, hexToHsl, hslToHex } from '../utils/color';
import CoolorsColorExtractor from '../components/CoolorsColorExtractor';
import FullColorWheel, { SCHEME_COUNTS, SCHEME_OFFSETS } from '../components/FullColorWheel';

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
  const [baseHex, setBaseHex] = useState('#FF6B6B'); // new: decoupled from selectedColor
  const [linked, setLinked] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  
  // Camera/Gallery extractor modal state
  const [showExtractor, setShowExtractor] = useState(false);
  const [extractorImageUri, setExtractorImageUri] = useState(null);

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
    const H = mod(parseFloat(hIn) || 0, 360);
    const S = Math.max(0, Math.min(100, parseFloat(sIn) || 0));
    const L = Math.max(0, Math.min(100, parseFloat(lIn) || 0));
    setSelectedColor(hslToHex(H, S, L));
    // Use the ref to keep wheel in sync on blur
    wheelRef.current?.setActiveHandleHSL?.(H, S, L);
  };

  const resetScheme = (anchorHex = selectedColor) => {
    // Reset to canonical offsets from anchor hue
    const { h=0, s=100, l=50 } = hexToHsl(anchorHex) || {};
    const c = SCHEME_COUNTS[selectedScheme] || 1;
    const offs = SCHEME_OFFSETS[selectedScheme] || [0];
    const result = Array.from({ length: c }, (_, i) =>
      hslToHex(mod(h + (offs[i] ?? 0), 360), s, l)
    );
    setPalette(result);
    setBaseHex(anchorHex); // anchor the wheel to this hex
    setLinked(true);
  };

  const randomize = () => {
    const h = Math.floor(Math.random()*360);
    const s = 60 + Math.floor(Math.random()*40); // 60–100%
    const l = 45 + Math.floor(Math.random()*10); // 45–55%
    const hex = hslToHex(h, s, l);
    setSelectedColor(hex);
    setBaseHex(hex); // anchor the wheel to the same hex
    resetScheme(hex); // pass the new hex explicitly to avoid stale state
  };

  // Camera/Gallery handlers
  const openCamera = () => {
    if (wheelRef.current?.openCamera) {
      wheelRef.current.openCamera();
    } else {
      // Fallback: open extractor modal for camera
      setExtractorImageUri(null);
      setShowExtractor(true);
    }
  };

  const openGallery = () => {
    if (wheelRef.current?.openGallery) {
      wheelRef.current.openGallery();
    } else {
      // Fallback: open extractor modal for gallery
      setExtractorImageUri(null);
      setShowExtractor(true);
    }
  };

  // Handle extractor completion
  const handleExtractorComplete = (extractedPalette) => {
    if (extractedPalette && extractedPalette.length > 0) {
      const newBaseHex = extractedPalette[0];
      setBaseHex(newBaseHex);
      setSelectedColor(newBaseHex);
      setPalette(extractedPalette);
      resetScheme(newBaseHex);
    }
    setShowExtractor(false);
    setExtractorImageUri(null);
  };

  // Prefer live palette from wheel; otherwise derive
  const schemeColors = useMemo(() => {
    if (Array.isArray(palette) && palette.length > 0) return palette;
    return getColorScheme(selectedColor, selectedScheme, 0);
  }, [palette, selectedColor, selectedScheme]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 12 }}>
      {/* Wheel with Camera/Gallery Icons */}
      <View style={{ position: 'relative', alignItems: 'center' }}>
        <FullColorWheel
          ref={wheelRef}
          selectedFollowsActive={selectedFollowsActive}
          size={WHEEL_SIZE}
          scheme={selectedScheme}
          initialHex={baseHex} // use baseHex, not selectedColor
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
        
        {/* Camera and Gallery Icons */}
        <View style={{ 
          position: 'absolute', 
          bottom: -20, 
          flexDirection: 'row', 
          justifyContent: 'center',
          gap: 20
        }}>
          <TouchableOpacity
            onPress={openCamera}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: 25,
              width: 50,
              height: 50,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}
          >
            <MaterialIcons name="photo-camera" size={24} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={openGallery}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: 25,
              width: 50,
              height: 50,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}
          >
            <Feather name="image" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

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
          <View style={{ flexDirection: 'row', marginLeft: 8, marginRight: 8 }}>
            <Pressable onPress={resetScheme} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#999', marginRight: 8 }}>
              <Text>Reset</Text>
            </Pressable>
            <Pressable onPress={randomize} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#999' }}>
              <Text>Randomize</Text>
            </Pressable>
          </View>
        </View>

        {/* Numeric H/S/L */}
        <View style={{ flexDirection: 'row', marginTop: 10, marginLeft: 8, marginRight: 8 }}>
          <View style={{ flex: 1, marginRight: 4 }}>
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
          <View style={{ flex: 1, marginLeft: 4, marginRight: 4 }}>
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
          <View style={{ flex: 1, marginLeft: 4 }}>
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
        <View style={{ flexDirection: 'row' }}>
          {schemeColors.map((c, i) => (
            <View key={i} style={{
              flex: 1, height: 40, borderRadius: 8, backgroundColor: c, borderWidth: 1, borderColor: '#ddd',
              opacity: i === activeIdx ? 1 : 0.95,
              marginRight: i < schemeColors.length - 1 ? 8 : 0
            }} />
          ))}
        </View>
      </View>

      {/* Color Extractor Modal */}
      {showExtractor && (
        <CoolorsColorExtractor
          visible={showExtractor}
          initialImageUri={extractorImageUri}
          initialSlots={4}
          navigateOnActions={false}
          onComplete={handleExtractorComplete}
          onCancel={() => {
            setShowExtractor(false);
            setExtractorImageUri(null);
          }}
        />
      )}
    </View>
  );
}
