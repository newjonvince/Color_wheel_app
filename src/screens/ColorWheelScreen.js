// screens/ColorWheelScreen.js
// Screen that hosts the Canva-style wheel + scheme selector + camera/gallery

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Dimensions, Platform, View, Text, TextInput, Pressable, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getColorScheme, hexToHsl, hslToHex } from '../utils/color';
import FullColorWheel, { SCHEME_COUNTS, SCHEME_OFFSETS } from '../components/FullColorWheel';
import ApiService from '../services/api';
import CoolorsColorExtractor from '../components/CoolorsColorExtractor';

const { width: screenWidth } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(screenWidth * 0.92, 380);
const mod = (a, n) => ((a % n) + n) % n;

const SCHEMES = ['complementary','analogous','split-complementary','triadic','tetradic','monochromatic'];

export default function ColorWheelScreen({ navigation, currentUser, onLogout }) {
  const [selectedFollowsActive, setSelectedFollowsActive] = React.useState(true);
  const wheelRef = React.useRef(null);
  const [selectedScheme, setSelectedScheme] = useState('complementary');
  const [palette, setPalette] = useState(['#FF6B6B']);
  const [selectedColor, setSelectedColor] = useState('#FF6B6B');
  const [baseHex, setBaseHex] = useState('#FF6B6B');
  const [linked, setLinked] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showExtractor, setShowExtractor] = useState(false);

  const hsl = hexToHsl(selectedColor) || { h: 0, s: 100, l: 50 };
  const [hIn, setHIn] = useState(String(Math.round(hsl.h)));
  const [sIn, setSIn] = useState(String(Math.round(hsl.s)));
  const [lIn, setLIn] = useState(String(Math.round(hsl.l)));

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
    const hex = hslToHex(H, S, L);
    setSelectedColor(hex);
    wheelRef.current?.setActiveHandleHSL?.(H, S, L);
  };

  const resetScheme = (anchorHex = selectedColor) => {
    const { h=0, s=100, l=50 } = hexToHsl(anchorHex) || {};
    const c = SCHEME_COUNTS[selectedScheme] || 1;
    const offs = SCHEME_OFFSETS[selectedScheme] || [0];
    const result = Array.from({ length: c }, (_, i) =>
      hslToHex(mod(h + (offs[i] ?? 0), 360), s, l)
    );
    setPalette(result);
    setBaseHex(anchorHex);
    setLinked(true);
  };

  const randomize = () => {
    const h = Math.floor(Math.random()*360);
    const s = 60 + Math.floor(Math.random()*40);
    const l = 45 + Math.floor(Math.random()*10);
    const hex = hslToHex(h, s, l);
    setSelectedColor(hex);
    setBaseHex(hex);
    resetScheme(hex);
  };

  const openCamera = () => setShowExtractor(true);
  const openGallery = () => setShowExtractor(true);

  const handleExtractorComplete = (result) => {
    const extractedPalette = Array.isArray(result?.slots) ? result.slots : [];
    if (extractedPalette.length > 0) {
      const newBaseHex = extractedPalette[0];
      setBaseHex(newBaseHex);
      setSelectedColor(newBaseHex);
      setPalette(extractedPalette);
    }
    setShowExtractor(false);
  };

  const loadUserData = useCallback(async () => {
    if (!currentUser) return;
    try {
      await ApiService.ready;
      await ApiService.getUserColorMatches();
    } catch (error) {
      console.warn('Failed to load user data:', error);
      if (error.isAuthError) {
        // Use proper logout handler instead of navigation
        if (typeof onLogout === 'function') {
          onLogout();
        }
      }
    }
  }, [currentUser, onLogout]);
  useFocusEffect(useCallback(() => { loadUserData(); }, [loadUserData]));

  const schemeColors = useMemo(() => {
    if (Array.isArray(palette) && palette.length > 0) return palette;
    return getColorScheme(selectedColor, selectedScheme, 0);
  }, [palette, selectedColor, selectedScheme]);

  const schemeTitle = selectedScheme ? (selectedScheme[0].toUpperCase() + selectedScheme.slice(1)) : 'Scheme';

  return (
    <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 12, paddingBottom: 24 }}>
      {/* Scheme selector and live selected swatch */}
      <View style={{ width: '92%', maxWidth: 520, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {SCHEMES.map((name) => (
            <Pressable
              key={name}
              onPress={() => setSelectedScheme(name)}
              style={{
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                borderWidth: 1, borderColor: selectedScheme === name ? '#0d47a1' : '#bbb',
                marginRight: 6, marginBottom: 6,
                backgroundColor: selectedScheme === name ? '#E3F2FD' : '#fff'
              }}
            >
              <Text style={{ fontWeight: '600', textTransform: 'capitalize' }}>{name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: selectedColor, borderWidth: 1, borderColor: '#ddd' }} />
      </View>

      {/* Wheel + camera/gallery buttons */}
      <View style={{ position: 'relative', alignItems: 'center' }}>
        <FullColorWheel
          ref={wheelRef}
          selectedFollowsActive={selectedFollowsActive}
          size={WHEEL_SIZE}
          scheme={selectedScheme}
          initialHex={baseHex}
          linked={linked}
          onToggleLinked={() => setLinked(v => !v)}
          onColorsChange={(colors) => { if (Array.isArray(colors) && colors.length) setPalette(colors); }}
          onHexChange={(hex) => { if (hex) setSelectedColor(hex); }}
          onActiveHandleChange={(i) => setActiveIdx(i)}
        />

        <View style={{ position: 'absolute', bottom: -20, flexDirection: 'row', justifyContent: 'center' }}>
          <TouchableOpacity onPress={openCamera}
            style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center',
                     marginRight: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}>
            <MaterialIcons name="photo-camera" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity onPress={openGallery}
            style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center',
                     shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}>
            <Feather name="image" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Controls */}
      <View style={{ width: '92%', maxWidth: 520, marginTop: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => setLinked(v => !v)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: linked ? '#e8f5e9' : '#ffebee', borderWidth: 1, borderColor: linked ? '#2e7d32' : '#c62828' }}>
            <Text style={{ fontWeight: '600' }}>{linked ? 'Linked' : 'Unlinked'}</Text>
          </Pressable>

          <Pressable onPress={() => setSelectedFollowsActive(v => !v)}
            style={{ marginLeft: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: selectedFollowsActive ? '#e3f2fd' : '#fff3e0', borderWidth: 1, borderColor: selectedFollowsActive ? '#1565c0' : '#ef6c00' }}>
            <Text style={{ fontWeight: '600' }}>{selectedFollowsActive ? 'Selected = Active Handle' : 'Selected = Handle #1'}</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', marginLeft: 8, marginRight: 8 }}>
            <Pressable onPress={() => resetScheme()} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#999', marginRight: 8 }}>
              <Text>Reset</Text>
            </Pressable>
            <Pressable onPress={randomize} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#999' }}>
              <Text>Randomize</Text>
            </Pressable>
          </View>
        </View>

        {/* HSL numeric inputs */}
        <View style={{ flexDirection: 'row', marginTop: 10, marginLeft: 8, marginRight: 8 }}>
          <View style={{ flex: 1, marginRight: 4 }}>
            <Text style={{ fontSize: 12, color: '#555' }}>H</Text>
            <TextInput
              value={hIn}
              onChangeText={(v) => { setHIn(v); try { const H = ((parseFloat(v) || 0)%360+360)%360; const S = Math.max(0, Math.min(100, parseFloat(sIn) || 0)); const L = Math.max(0, Math.min(100, parseFloat(lIn) || 0)); wheelRef.current?.setActiveHandleHSL?.(H,S,L);} catch(e){} }}
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
              onChangeText={(v) => { setSIn(v); try { const H = ((parseFloat(hIn) || 0)%360+360)%360; const S = Math.max(0, Math.min(100, parseFloat(v) || 0)); const L = Math.max(0, Math.min(100, parseFloat(lIn) || 0)); wheelRef.current?.setActiveHandleHSL?.(H,S,L);} catch(e){} }}
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
              onChangeText={(v) => { setLIn(v); try { const H = ((parseFloat(hIn) || 0)%360+360)%360; const S = Math.max(0, Math.min(100, parseFloat(sIn) || 0)); const L = Math.max(0, Math.min(100, parseFloat(v) || 0)); wheelRef.current?.setActiveHandleHSL?.(H,S,L);} catch(e){} }}
              onBlur={applyNumericInputs}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
              placeholder="0–100"
            />
          </View>
        </View>
      </View>

      {/* Swatches */}
      <View style={{ width: '92%', maxWidth: 520, marginTop: 16 }}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Selected Color</Text>
        <View style={{ width: '100%', height: 44, borderRadius: 8, backgroundColor: selectedColor, borderWidth: 1, borderColor: '#ddd' }} />
        <Text style={{ fontWeight: '700', marginTop: 16, marginBottom: 6 }}>{schemeTitle} swatches</Text>
        <View style={{ flexDirection: 'row' }}>
          {schemeColors.map((c, i) => (
            <View key={i} style={{ flex: 1, height: 40, borderRadius: 8, backgroundColor: c, borderWidth: 1, borderColor: '#ddd', opacity: i === activeIdx ? 1 : 0.95, marginRight: i < schemeColors.length - 1 ? 8 : 0 }} />
          ))}
        </View>
      </View>

      {showExtractor && (
        <CoolorsColorExtractor
          initialSlots={5}
          onComplete={handleExtractorComplete}
          onClose={() => setShowExtractor(false)}
        />
      )}
    </ScrollView>
  );
}
