import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Modal, TextInput, Alert } from 'react-native';
import FullColorWheel from './FullColorWheel';
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

  const onColorsChange = useCallback((colors) => setPalette(colors), []);
  const onHexChange = useCallback((hex) => setBaseHex(hex), []);

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
          strokeWidth={32}
          scheme={scheme}
          initialHex={baseHex}
          onColorsChange={onColorsChange}
          onHexChange={onHexChange}
        />
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.dot, { backgroundColor: baseHex }]} />
        <Text style={styles.code}>{baseHex}</Text>
      </View>

      <Text style={styles.subtitle}>Choose a color combination</Text>
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

      {/* Palette preview */}
      <View style={styles.paletteBar}>
        {palette.map((c, i) => (
          <View key={i} style={[styles.swatch, { backgroundColor: c }]} />
        ))}
      </View>

      <View style={styles.hexRow}>
        {palette.map((c, i) => (
          <Text key={`t-${i}`} style={styles.hexText}>{c}</Text>
        ))}
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={openSaveModal}>
        <Text style={styles.saveButtonText}>💾 Save Palette</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 20, color: '#222' },
  wheelWrap: { alignItems: 'center', marginTop: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  dot: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 2, borderColor: '#fff' },
  code: { fontFamily: 'Menlo', fontSize: 16, color: '#333' },
  subtitle: { marginHorizontal: 20, marginTop: 20, fontSize: 16, fontWeight: '700', color: '#333' },
  schemeRow: { paddingHorizontal: 16, marginTop: 10 },
  schemeBtn: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, marginRight: 10, borderWidth: 1.5, borderColor: '#e7e7e7' },
  schemeBtnActive: { backgroundColor: '#5b5ce2', borderColor: '#5b5ce2' },
  schemeText: { color: '#666', fontWeight: '700' },
  schemeTextActive: { color: '#fff' },
  paletteBar: { flexDirection: 'row', height: 56, borderRadius: 8, overflow: 'hidden', margin: 20, backgroundColor: '#eee' },
  swatch: { flex: 1 },
  hexRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 10 },
  hexText: { fontFamily: 'Menlo', fontSize: 12, color: '#666', marginTop: 6 },
  
  // Save Button
  saveButton: {
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