// screens/ColorWheelScreen.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import FullColorWheel from '../components/FullColorWheel';
import AdvancedColorWheel from '../components/AdvancedColorWheel';
import CoolorsColorExtractor from '../components/CoolorsColorExtractor';
import { validateHexColor, getColorScheme, hexToRgb } from '../utils/color';

export default function ColorWheelScreen({ onSaveColorMatch, navigation }) {
  const [selectedColor, setSelectedColor] = useState('#FF0000');
  const [scheme, setScheme] = useState('analogous');
  const [wheelType, setWheelType] = useState('basic');
  const [showExtractor, setShowExtractor] = useState(false);
  const [initialImageUri, setInitialImageUri] = useState(null);
  const [manualHex, setManualHex] = useState('');
  const [manualPalette, setManualPalette] = useState(['#24FF89', '#FF249A']); // Start with 2 colors

  const openImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1
    });
    if (!result.canceled) {
      setInitialImageUri(result.assets[0].uri);
      setShowExtractor(true);
    }
  };

  const openCamera = async () => {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false, // Skip editing, go directly to extractor
    });
    
    if (!result.canceled) {
      // Same workflow as gallery - send directly to extractor
      setInitialImageUri(result.assets[0].uri);
      setShowExtractor(true);
      Haptics.selectionAsync();
    }
  };

  const handleManualHex = () => {
    let hex = manualHex.trim().toUpperCase();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (validateHexColor(hex)) {
      if (scheme === 'manual') {
        // Add to manual palette if there's room
        if (manualPalette.length < 4) {
          setManualPalette([...manualPalette, hex]);
          setManualHex('');
          Haptics.selectionAsync();
        } else {
          Alert.alert('Palette Full', 'You can only have up to 4 colors in manual mode.');
        }
      } else {
        setSelectedColor(hex);
        Haptics.selectionAsync();
      }
    } else {
      Alert.alert('Invalid Color', 'Please enter a valid HEX color.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const addColorToManualPalette = () => {
    if (manualPalette.length < 4) {
      // Generate a random color or use the current selected color
      const newColor = selectedColor;
      setManualPalette([...manualPalette, newColor]);
      Haptics.selectionAsync();
    }
  };

  const removeColorFromManualPalette = (index) => {
    if (manualPalette.length > 2) { // Keep minimum of 2 colors
      const newPalette = manualPalette.filter((_, i) => i !== index);
      setManualPalette(newPalette);
      Haptics.selectionAsync();
    }
  };

  const handleSave = async () => {
    const colors = scheme === 'manual' ? manualPalette : getColorScheme(selectedColor, scheme);
    const baseColor = scheme === 'manual' ? manualPalette[0] : selectedColor;
    
    try {
      // Save the color match
      await onSaveColorMatch({ base_color: baseColor, scheme, colors });
      
      // Provide haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate to Profile/Boards screen to show saved palettes
      if (navigation) {
        navigation.navigate('Profile');
        
        // Show success message after navigation
        setTimeout(() => {
          Alert.alert('Palette Saved!', 'Your color palette has been saved to your boards.', [
            { text: 'OK', style: 'default' }
          ]);
        }, 500);
      } else {
        Alert.alert('Saved', 'Your color match has been saved.');
      }
    } catch (e) {
      console.error('Save error:', e);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save color match. Please try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Color Wheel</Text>

      <View style={styles.toggleRow}>
        {['basic', 'full', 'advanced'].map(type => (
          <TouchableOpacity key={type} onPress={() => setWheelType(type)} style={[styles.toggleBtn, wheelType === type && styles.activeBtn]}>
            <Text style={[styles.toggleText, wheelType === type && styles.activeText]}>{type}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {wheelType === 'advanced' ? (
        <AdvancedColorWheel 
          currentUser={{ id: 'demo' }}
          onSaveColorMatch={onSaveColorMatch}
        />
      ) : wheelType === 'full' ? (
        <FullColorWheel 
          initialHex={selectedColor} 
          onChange={c => {
            setSelectedColor(c.hex);
            Haptics.selectionAsync();
          }} 
        />
      ) : (
        scheme === 'manual' ? (
          <View style={styles.manualPaletteContainer}>
            <View style={styles.paletteHeader}>
              <Text style={styles.paletteTitle}>Current Palette</Text>
              <Text style={styles.paletteCount}>{manualPalette.length} colors</Text>
            </View>
            <View style={styles.manualPalette}>
              {manualPalette.map((color, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.manualColorItem}
                  onLongPress={() => removeColorFromManualPalette(index)}
                >
                  <View style={[styles.manualColorSwatch, { backgroundColor: color }]} />
                  <Text style={styles.manualColorHex}>{color}</Text>
                </TouchableOpacity>
              ))}
              {manualPalette.length < 4 && (
                <TouchableOpacity 
                  style={styles.addColorButton}
                  onPress={addColorToManualPalette}
                >
                  <Ionicons name="add" size={24} color="#007AFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.colorInfoContainer}>
            <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
            <View style={styles.colorDetails}>
              <View style={styles.colorValueContainer}>
                <Text style={styles.colorLabel}>HEX</Text>
                <Text style={styles.colorValue}>{selectedColor}</Text>
              </View>
              <View style={styles.colorValueContainer}>
                <Text style={styles.colorLabel}>RGB</Text>
                <Text style={styles.colorValue}>
                  {(() => {
                    const { r, g, b } = hexToRgb(selectedColor);
                    return `RGB(${r}, ${g}, ${b})`;
                  })()}
                </Text>
              </View>
            </View>
          </View>
        )
      )}

      {/* Color Scheme Selector */}
      <View style={styles.schemeSection}>
        <Text style={styles.sectionTitle}>Color Scheme</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.schemeScroll}>
          {['analogous', 'complementary', 'triadic', 'tetradic', 'monochromatic', 'manual'].map((schemeType) => (
            <TouchableOpacity
              key={schemeType}
              style={[styles.schemeButton, scheme === schemeType && styles.selectedScheme]}
              onPress={() => {
                setScheme(schemeType);
                Haptics.selectionAsync();
              }}
            >
              <Text style={[styles.schemeText, scheme === schemeType && styles.selectedSchemeText]}>
                {schemeType.charAt(0).toUpperCase() + schemeType.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Image Source Buttons */}
      <View style={styles.imageSourceButtons}>
        <TouchableOpacity onPress={openImagePicker} style={[styles.btn, styles.imageBtn]}>
          <Ionicons name="images" size={20} color="white" />
          <Text style={styles.btnText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openCamera} style={[styles.btn, styles.imageBtn]}>
          <Ionicons name="camera" size={20} color="white" />
          <Text style={styles.btnText}>Camera</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showExtractor} animationType="slide">
        <CoolorsColorExtractor
          initialImageUri={initialImageUri}
          onColorExtracted={hex => {
            setSelectedColor(hex);
            setShowExtractor(false);
            setInitialImageUri(null);
            Haptics.selectionAsync();
          }}
          onClose={() => {
            setShowExtractor(false);
            setInitialImageUri(null);
          }}
          onCreateCollage={(image, hex) => {
            // Handle collage creation if needed
            console.log('Collage created with color:', hex);
          }}
        />
      </Modal>

      <TextInput
        style={styles.input}
        placeholder={scheme === 'manual' ? 'Add color #RRGGBB' : '#RRGGBB'}
        value={manualHex}
        onChangeText={setManualHex}
        onSubmitEditing={handleManualHex}
      />

      {/* Floating Save Button */}
      <TouchableOpacity onPress={handleSave} style={styles.floatingSaveBtn}>
        <Ionicons name="download" size={24} color="white" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center', paddingBottom: 100 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  toggleRow: { flexDirection: 'row', marginBottom: 20 },
  toggleBtn: { padding: 10, marginHorizontal: 5, borderRadius: 5, backgroundColor: '#ccc' },
  activeBtn: { backgroundColor: '#333' },
  toggleText: { color: '#000' },
  activeText: { color: '#fff' },
  
  // Enhanced color info display
  colorInfoContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    maxWidth: 350,
  },
  colorPreview: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 16,
    alignSelf: 'center',
  },
  colorDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  colorValueContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    flex: 0.45,
  },
  colorLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  colorValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  
  // Image source buttons
  imageSourceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
    marginBottom: 10,
  },
  btn: { padding: 15, backgroundColor: '#007AFF', borderRadius: 8, marginTop: 10 },
  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 0,
    flex: 0.45,
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginTop: 20, borderRadius: 5, width: 150, textAlign: 'center' },
  
  // Floating save button
  floatingSaveBtn: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  // Color scheme selector
  schemeSection: {
    marginBottom: 20,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  schemeScroll: {
    flexDirection: 'row',
  },
  schemeButton: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  selectedScheme: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  schemeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedSchemeText: {
    color: 'white',
  },
  
  // Manual palette styles
  manualPaletteContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    maxWidth: 350,
  },
  paletteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  paletteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  paletteCount: {
    fontSize: 14,
    color: '#666',
  },
  manualPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  manualColorItem: {
    alignItems: 'center',
    marginBottom: 12,
    width: '22%',
  },
  manualColorSwatch: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginBottom: 8,
  },
  manualColorHex: {
    fontSize: 12,
    color: '#333',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  addColorButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
});
