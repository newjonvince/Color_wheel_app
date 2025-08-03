import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, Text, FlatList, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SavedOutfitsScreen() {
  const [outfits, setOutfits] = useState([]);

  useEffect(() => {
    loadSavedOutfits();
  }, []);

  const loadSavedOutfits = async () => {
    try {
      const savedOutfits = await AsyncStorage.getItem('savedOutfits');
      if (savedOutfits) {
        setOutfits(JSON.parse(savedOutfits));
      }
    } catch (error) {
      console.error('Error loading outfits:', error);
    }
  };

  const deleteOutfit = async (id) => {
    try {
      const updatedOutfits = outfits.filter(outfit => outfit.id !== id);
      await AsyncStorage.setItem('savedOutfits', JSON.stringify(updatedOutfits));
      setOutfits(updatedOutfits);
    } catch (error) {
      console.error('Error deleting outfit:', error);
    }
  };

  const renderOutfit = ({ item }) => (
    <View style={styles.outfitContainer}>
      <Image source={{ uri: item.imageUri }} style={styles.outfitImage} />
      <Text style={styles.schemeText}>{item.scheme}</Text>
      <View style={styles.colorsContainer}>
        {item.colors.map((color, index) => (
          <View
            key={index}
            style={[styles.colorBox, { backgroundColor: color }]}
          />
        ))}
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteOutfit(item.id)}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {outfits.length === 0 ? (
        <Text style={styles.emptyText}>No saved outfits yet</Text>
      ) : (
        <FlatList
          data={outfits}
          renderItem={renderOutfit}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContainer: {
    padding: 10,
  },
  outfitContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
  },
  outfitImage: {
    width: '100%',
    height: 200,
    borderRadius: 5,
    marginBottom: 10,
  },
  schemeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  colorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  colorBox: {
    width: 40,
    height: 40,
    margin: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
  },
});
