import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Modal, TextInput, Alert } from 'react-native';
import FullColorWheel from '../components/FullColorWheel';
import CoolorsColorExtractor from '../components/CoolorsColorExtractor';
import ApiService from '../services/api';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = width * 0.8;

const SCHEMES = ['analogous','complementary','triadic','tetradic','monochromatic'];

export default function ColorWheelScreen() {
  const [scheme, setScheme] = useState('analogous');
  const [palette, setPalette] = useState(['#7728D7','#D77728','#28D777']);
  const [baseHex, setBaseHex] = useState('#7728D7');
  
  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Scheme dropdown state
  const [showSchemeDropdown, setShowSchemeDropdown] = useState(false);
  
  // Image extractor state
  const [showExtractor, setShowExtractor] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState(null);

  const onColorsChange = useCallback((colors) => setPalette(colors), []);
  const onHexChange = useCallback((hex) => setBaseHex(hex), []);

  // Handle manual hex input changes
  const handleHexInputChange = useCallback((text) => {
    // Clean and validate hex input
    let cleanHex = text.toUpperCase().replace(/[^0-9A-F#]/g, '');
    if (!cleanHex.startsWith('#')) {
      cleanHex = '#' + cleanHex;
    }
    if (cleanHex.length <= 7) {
      setBaseHex(cleanHex);
      // If it's a valid 7-character hex, update the wheel
      if (cleanHex.length === 7 && /^#[0-9A-F]{6}$/.test(cleanHex)) {
        // The FullColorWheel will automatically update when baseHex changes
      }
    }
  }, []);

  // Handle image selection from camera/gallery
  const handleImageSelected = useCallback((imageAsset) => {
    console.log('Image selected:', imageAsset);
    setSelectedImageUri(imageAsset.uri);
    setShowExtractor(true);
  }, []);

  // Handle color extraction completion
  const handleExtractorComplete = useCallback((result) => {
    console.log('Extractor complete:', result);
    if (result?.slots && result.slots.length > 0) {
      // Update the palette with extracted colors
      setPalette(result.slots);
      setBaseHex(result.slots[0]);
    }
    setShowExtractor(false);
    setSelectedImageUri(null);
  }, []);

  // Handle extractor close
  const handleExtractorClose = useCallback(() => {
    setShowExtractor(false);
    setSelectedImageUri(null);
  }, []);

  // Save palette to backend
  const handleSavePalette = useCallback(async () => {
    if (!saveTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your palette');
      return;
    }

    setSaving(true);
    try {
      const paletteData = {
        base_color: baseHex,
        scheme: scheme,
        colors: palette,
        title: saveTitle.trim(),
        description: saveDescription.trim(),
        is_public: isPublic
      };

      const result = await ApiService.createColorMatch(paletteData);
      
      if (result.ok) {
        Alert.alert('Success!', 'Your color palette has been saved successfully!', [
          { text: 'OK', onPress: () => {
            setShowSaveModal(false);
            setSaveTitle('');
            setSaveDescription('');
            setIsPublic(false);
          }}
        ]);
      } else {
        throw new Error(result.error || 'Failed to save palette');
      }
    } catch (error) {
      console.error('Save palette error:', error);
      Alert.alert('Error', error.message || 'Failed to save palette. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [baseHex, scheme, palette, saveTitle, saveDescription, isPublic]);

  // Open save modal with default title
  const openSaveModal = useCallback(() => {
    setSaveTitle(`${scheme.charAt(0).toUpperCase() + scheme.slice(1)} Palette`);
    setSaveDescription('');
    setIsPublic(false);
    setShowSaveModal(true);
  }, [scheme]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Color Wheel</Text>

      <View style={styles.wheelWrap}>
        <FullColorWheel
          size={WHEEL_SIZE}
          scheme={scheme}
          initialHex={baseHex}
          onColorsChange={onColorsChange}
          onHexChange={onHexChange}
          onImageSelected={handleImageSelected}
        />
      </View>

      {/* Live Color Picker Field */}
      <View style={styles.colorPickerSection}>
        <Text style={styles.pickerLabel}>1. Pick a color</Text>
        <View style={styles.colorPickerRow}>
          <View style={[styles.colorDot, { backgroundColor: baseHex }]} />
          <TextInput
            style={styles.hexInput}
            value={baseHex}
            onChangeText={handleHexInputChange}
            placeholder="#000000"
            maxLength={7}
            autoCapitalize="characters"
          />
        </View>
      </View>

      {/* Color Scheme Selector */}
      <View style={styles.schemeSection}>
        <Text style={styles.schemeLabel}>2. Choose a color combination</Text>
        <View style={styles.schemeDropdown}>
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={() => setShowSchemeDropdown(!showSchemeDropdown)}
          >
            <Text style={styles.dropdownText}>{scheme.charAt(0).toUpperCase() + scheme.slice(1)}</Text>
            <Text style={[styles.dropdownArrow, showSchemeDropdown && styles.dropdownArrowUp]}>▼</Text>
          </TouchableOpacity>
          
          {/* Dropdown Options */}
          {showSchemeDropdown && (
            <View style={styles.dropdownOptions}>
              {SCHEMES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.dropdownOption, scheme === s && styles.dropdownOptionActive]}
                  onPress={() => {
                    setScheme(s);
                    setShowSchemeDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownOptionText, scheme === s && styles.dropdownOptionTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Live Palette Preview */}
      <View style={styles.palettePreview}>
        {palette.map((c, i) => (
          <View key={i} style={[styles.paletteColor, { backgroundColor: c }]} />
        ))}
      </View>

      {/* Hex Values Display */}
      <View style={styles.hexValuesRow}>
        {palette.map((c, i) => (
          <Text key={`hex-${i}`} style={styles.hexValue}>{c}</Text>
        ))}
      </View>

      {/* Scheme Selection Buttons (Hidden for now, can be toggled) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.schemeRow}>
        {SCHEMES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.schemeBtn, scheme === s && styles.schemeBtnActive]}
            onPress={() => setScheme(s)}
          >
            <Text style={[styles.schemeText, scheme === s && styles.schemeTextActive]}>
              {s[0].toUpperCase()+s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Current Palette Section - Matching your screenshot */}
      <View style={styles.currentPaletteSection}>
        <View style={styles.currentPaletteHeader}>
          <Text style={styles.currentPaletteTitle}>Current Palette</Text>
          <Text style={styles.currentPaletteCount}>{palette.length} colors</Text>
        </View>
        
        <View style={styles.currentPaletteColors}>
          {palette.map((color, index) => (
            <View key={`current-${index}`} style={styles.currentColorItem}>
              <View style={[styles.currentColorSwatch, { backgroundColor: color }]} />
              <Text style={styles.currentColorHex}>{color}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Floating Save Button - Lower Right */}
      <TouchableOpacity style={styles.floatingSaveButton} onPress={openSaveModal}>
        <Text style={styles.floatingSaveIcon}>💾</Text>
        <Text style={styles.floatingSaveText}>Save</Text>
      </TouchableOpacity>

      {/* Save Modal */}
      <Modal
        visible={showSaveModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSaveModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Save Palette</Text>
            <TouchableOpacity onPress={handleSavePalette} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Palette Preview */}
            <View style={styles.modalPalettePreview}>
              {palette.map((c, i) => (
                <View key={i} style={[styles.modalSwatch, { backgroundColor: c }]} />
              ))}
            </View>

            {/* Title Input */}
            <Text style={styles.modalLabel}>Title *</Text>
            <TextInput
              style={styles.modalInput}
              value={saveTitle}
              onChangeText={setSaveTitle}
              placeholder="Enter palette title"
              maxLength={100}
            />

            {/* Description Input */}
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={saveDescription}
              onChangeText={setSaveDescription}
              placeholder="Optional description"
              multiline
              numberOfLines={3}
              maxLength={500}
            />

            {/* Public/Private Toggle */}
            <TouchableOpacity 
              style={styles.modalToggle} 
              onPress={() => setIsPublic(!isPublic)}
            >
              <View style={[styles.modalCheckbox, isPublic && styles.modalCheckboxActive]}>
                {isPublic && <Text style={styles.modalCheckmark}>✓</Text>}
              </View>
              <Text style={styles.modalToggleText}>Make this palette public</Text>
            </TouchableOpacity>

            <Text style={styles.modalHint}>
              Public palettes can be discovered by other users in the community feed.
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Color Extractor Modal */}
      {showExtractor && selectedImageUri && (
        <Modal visible={showExtractor} animationType="slide" presentationStyle="fullScreen">
          <CoolorsColorExtractor
            initialImageUri={selectedImageUri}
            initialSlots={5}
            onComplete={handleExtractorComplete}
            onClose={handleExtractorClose}
          />
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 20, color: '#222' },
  wheelWrap: { alignItems: 'center', marginTop: 20 },
  
  // Live Color Picker Styles
  colorPickerSection: { marginHorizontal: 20, marginTop: 20 },
  pickerLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  colorPickerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  colorDot: { width: 32, height: 32, borderRadius: 16, marginRight: 12, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  hexInput: { flex: 1, fontSize: 16, fontFamily: 'Menlo', color: '#333', fontWeight: '500' },
  
  // Scheme Selector Styles
  schemeSection: { marginHorizontal: 20, marginTop: 20, zIndex: 1000 },
  schemeLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  schemeDropdown: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', position: 'relative' },
  dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  dropdownText: { fontSize: 16, color: '#333', fontWeight: '500' },
  dropdownArrow: { fontSize: 12, color: '#666', transform: [{ rotate: '0deg' }] },
  dropdownArrowUp: { transform: [{ rotate: '180deg' }] },
  dropdownOptions: { 
    position: 'absolute', 
    top: '100%', 
    left: 0, 
    right: 0, 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#e0e0e0', 
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001
  },
  dropdownOption: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownOptionActive: { backgroundColor: '#f8f9ff' },
  dropdownOptionText: { fontSize: 16, color: '#333', fontWeight: '500' },
  dropdownOptionTextActive: { color: '#5b5ce2', fontWeight: '600' },
  
  // Live Palette Preview Styles
  palettePreview: { flexDirection: 'row', marginHorizontal: 20, marginTop: 20, height: 60, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
  paletteColor: { flex: 1 },
  
  // Hex Values Display
  hexValuesRow: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 20, marginTop: 8 },
  hexValue: { fontFamily: 'Menlo', fontSize: 12, color: '#666', fontWeight: '500' },
  
  // Legacy scheme selection (hidden by default)
  schemeRow: { paddingHorizontal: 16, marginTop: 10, display: 'none' },
  schemeBtn: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, marginRight: 10, borderWidth: 1.5, borderColor: '#e7e7e7' },
  schemeBtnActive: { backgroundColor: '#5b5ce2', borderColor: '#5b5ce2' },
  schemeText: { color: '#666', fontWeight: '700' },
  schemeTextActive: { color: '#fff' },
  
  // Current Palette Section - Matching screenshot
  currentPaletteSection: { 
    marginHorizontal: 20, 
    marginTop: 30, 
    marginBottom: 100, // Space for floating button
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentPaletteHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  currentPaletteTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#333' 
  },
  currentPaletteCount: { 
    fontSize: 14, 
    color: '#666', 
    fontWeight: '500' 
  },
  currentPaletteColors: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12 
  },
  currentColorItem: { 
    alignItems: 'center', 
    minWidth: 80 
  },
  currentColorSwatch: { 
    width: 60, 
    height: 60, 
    borderRadius: 8, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  currentColorHex: { 
    fontSize: 12, 
    fontFamily: 'Menlo', 
    color: '#666', 
    fontWeight: '500' 
  },
  
  // Floating Save Button - Lower Right
  floatingSaveButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#007AFF',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  floatingSaveIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  floatingSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Legacy Save Button (hidden)
  saveButton: {
    display: 'none',
    backgroundColor: '#5b5ce2',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#5b5ce2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e7e7',
  },
  modalCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  modalSave: {
    color: '#5b5ce2',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSaveDisabled: {
    color: '#ccc',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalPalettePreview: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 20,
    backgroundColor: '#eee',
  },
  modalSwatch: {
    flex: 1,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e7e7e7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  modalCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#e7e7e7',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  modalCheckboxActive: {
    backgroundColor: '#5b5ce2',
    borderColor: '#5b5ce2',
  },
  modalCheckmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalToggleText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  modalHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    lineHeight: 20,
  },
});