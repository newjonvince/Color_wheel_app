import React, { useState } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Text, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ColorMatchScreen = ({ route, navigation }) => {
  const { imageUri } = route.params;
  const [selectedScheme, setSelectedScheme] = useState(null);
  
  const colorSchemes = {
    complementary: ['#FF0000', '#00FFFF'],
    monochromatic: ['#FF0000', '#CC0000', '#990000', '#660000'],
    analogous: ['#FF0000', '#FF8000', '#FFFF00'],
    triadic: ['#FF0000', '#00FF00', '#0000FF'],
    tetradic: ['#FF0000', '#FFFF00', '#00FF00', '#0000FF'],
  };

  const saveOutfit = async () => {
    try {
      const existingOutfits = await AsyncStorage.getItem('savedOutfits');
      const outfits = existingOutfits ? JSON.parse(existingOutfits) : [];
      
      outfits.push({
        id: Date.now().toString(),
        imageUri,
        scheme: selectedScheme,
        colors: colorSchemes[selectedScheme],
      });
      
      await AsyncStorage.setItem('savedOutfits', JSON.stringify(outfits));
      navigation.navigate('SavedOutfits');
    } catch (error) {
      console.error('Error saving outfit:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} />
      
      <View style={styles.schemeContainer}>
        {Object.keys(colorSchemes).map((scheme) => (
          <TouchableOpacity
            key={scheme}
            style={[
              styles.schemeButton,
              selectedScheme === scheme && styles.selectedScheme,
            ]}
            onPress={() => setSelectedScheme(scheme)}
          >
            <Text style={styles.schemeText}>{scheme}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedScheme && (
        <View style={styles.colorPreview}>
          {colorSchemes[selectedScheme].map((color, index) => (
            <View
              key={index}
              style={[styles.colorBox, { backgroundColor: color }]}
            />
          ))}
        </View>
      )}

      {selectedScheme && (
        <TouchableOpacity style={styles.saveButton} onPress={saveOutfit}>
          <Text style={styles.saveButtonText}>Save Outfit</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  schemeContainer: {
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  schemeButton: {
    padding: 10,
    margin: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    minWidth: 120,
    alignItems: 'center',
  },
  selectedScheme: {
    backgroundColor: '#007AFF',
  },
  schemeText: {
    fontSize: 16,
    color: '#333',
  },
  colorPreview: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    padding: 20,
  },
  colorBox: {
    width: 60,
    height: 60,
    margin: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
  },
});
