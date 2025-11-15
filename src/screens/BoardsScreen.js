import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Dimensions, Alert, Modal, TextInput, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import CoolorsColorExtractor from '../components/CoolorsColorExtractor';
import ApiService from '../services/safeApiService';
import { getColorScheme as computeScheme } from '../utils/optimizedColor';
import { getAllSchemes } from '../constants/colorSchemes';
import { apiPatterns } from '../utils/apiHelpers';
import { safeId } from '../utils/keyExtractors';

const { width: screenWidth } = Dimensions.get('window');
const boardWidth = (screenWidth - 45) / 2; // 2 columns with margins

const MAIN_FOLDERS = [
  { id: 'private', name: 'Private', icon: '🔒', description: 'Only visible to you' },
  { id: 'public', name: 'Public', icon: '🌍', description: 'Visible to everyone' },
];

// Generate scheme folders with proper icons from centralized definitions
const SCHEME_ICONS = {
  complementary: '🎨',
  analogous: '🌈', 
  triadic: '🔺',
  tetradic: '⬜',
  monochromatic: '🎯',
  compound: '🔀',
  shades: '🌑',
  tints: '🌕',
  'split-complementary': '🎭'
};

const SCHEME_FOLDERS = getAllSchemes().map(scheme => ({
  id: scheme.key,
  name: scheme.name,
  icon: SCHEME_ICONS[scheme.key] || '🎨',
  description: scheme.description
}));

// Create lookup objects for consistent type handling
const MAIN_FOLDERS_BY_ID = Object.fromEntries(MAIN_FOLDERS.map(f => [f.id, f]));
const SCHEME_FOLDERS_BY_ID = Object.fromEntries(SCHEME_FOLDERS.map(s => [s.id, s]));

function BoardsScreen({ savedColorMatches = [], onSaveColorMatch, currentUser }) {
  const [selectedMainFolder, setSelectedMainFolder] = useState(null);
  const [selectedSchemeFolder, setSelectedSchemeFolder] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadScheme, setUploadScheme] = useState('complementary');
  const [uploadPrivacy, setUploadPrivacy] = useState('private');
  const [boards, setBoards] = useState([]); // kept for future use
  const [colorMatches, setColorMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // New state for color extractor integration
  const [showExtractor, setShowExtractor] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [extractedPalette, setExtractedPalette] = useState(null);

  // Load boards and color matches from database
  useEffect(() => {
    loadBoardsAndMatches();
  }, []);

  const loadBoardsAndMatches = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    
    // Use apiHelpers for better error handling
    const matchesResult = await apiPatterns.loadColorMatches();
    
    if (matchesResult.success) {
      const matchesRes = matchesResult.data;
      const matchesData = Array.isArray(matchesRes) ? matchesRes : matchesRes?.colorMatches || matchesRes?.data || [];
      setColorMatches(matchesData);
    } else {
      console.error('Failed to load color matches:', matchesResult.error);
      Alert.alert('Error', 'Failed to load color matches. Please try again.');
    }
    
    setLoading(false);
  }, [currentUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBoardsAndMatches();
    setRefreshing(false);
  }, [loadBoardsAndMatches]);

  // Memoized privacy partitions
  const publicMatches = useMemo(() => colorMatches.filter(m => m.privacy === 'public'), [colorMatches]);
  const privateMatches = useMemo(() => colorMatches.filter(m => m.privacy === 'private'), [colorMatches]);

  const getMainFolderColorMatches = useCallback((privacy) => (
    privacy === 'public' ? publicMatches : privateMatches
  ), [publicMatches, privateMatches]);

  const getBoardColorMatches = useCallback((schemeId, privacy = null) => {
    const base = privacy === 'public' ? publicMatches : privacy === 'private' ? privateMatches : colorMatches;
    return base.filter(m => m.scheme === schemeId);
  }, [colorMatches, publicMatches, privateMatches]);

  const safeDate = (item) => item.timestamp || item.created_at || item.createdAt || null;

  const getColorScheme = useCallback((baseColor, scheme) => computeScheme(baseColor, scheme), []);

  const handleUploadImage = useCallback(async () => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to upload color matches');
      return;
    }

    // Enhanced type safety for ImagePicker to prevent Swift runtime crashes
    if (!ImagePicker || typeof ImagePicker.requestMediaLibraryPermissionsAsync !== 'function') {
      Alert.alert('Error', 'Image picker not available');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission || !permission.granted) {
      Alert.alert('Permission Required', 'Permission to access your photos is required.');
      return;
    }

    // Enhanced type safety for ImagePicker options
    if (!ImagePicker.launchImageLibraryAsync || typeof ImagePicker.launchImageLibraryAsync !== 'function') {
      Alert.alert('Error', 'Image picker functionality not available');
      return;
    }

    // Validate MediaTypeOptions exists and has Images property
    const mediaTypeImages = ImagePicker.MediaTypeOptions?.Images || 
                           ImagePicker.MediaTypeOptions?.['Images'] || 
                           'Images';

    // Safe ImagePicker options with comprehensive type validation
    const pickerOptions = {
      mediaTypes: mediaTypeImages,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      // Add explicit type constraints to prevent Swift casting errors
      allowsMultipleSelection: false,
      base64: false,
      exif: false,
    };
    
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

    // Enhanced result validation to prevent Swift collection iterator failures
    if (!result || typeof result !== 'object' || result.canceled) return;

    // Comprehensive array and asset validation
    if (!result.assets || 
        !Array.isArray(result.assets) || 
        result.assets.length === 0) {
      Alert.alert('Error', 'No image selected');
      return;
    }

    const asset = result.assets[0];
    if (!asset || 
        typeof asset !== 'object' || 
        !asset.uri || 
        typeof asset.uri !== 'string' || 
        asset.uri.length === 0) {
      Alert.alert('Error', 'Failed to process selected image');
      return;
    }

    // NEW IDEAL FLOW: Open CoolorsColorExtractor for real color extraction
    setSelectedImageUri(result.assets[0].uri);
    setShowExtractor(true);
    setShowUploadModal(false); // Close upload modal to show extractor
  }, [currentUser]);

  // Handle color extraction completion from CoolorsColorExtractor
  const handleExtractorComplete = useCallback((result) => {
    console.log('Extractor complete:', result);
    if (result?.slots && result.slots.length > 0) {
      // Store extracted palette for saving
      setExtractedPalette(result.slots);
      
      // Reopen upload modal with extracted colors for final save
      setShowExtractor(false);
      setSelectedImageUri(null);
      setShowUploadModal(true);
    }
  }, []);

  // Handle extractor close without saving
  const handleExtractorClose = useCallback(() => {
    setShowExtractor(false);
    setSelectedImageUri(null);
    setExtractedPalette(null);
  }, []);

  // Save the extracted palette to the selected board/folder
  const handleSaveExtractedPalette = useCallback(async () => {
    if (!extractedPalette || extractedPalette.length === 0) {
      Alert.alert('No Colors', 'Please extract colors from an image first.');
      return;
    }

    try {
      const baseColor = extractedPalette[0]; // Use first extracted color as base
      const colorMatch = {
        baseColor,
        scheme: uploadScheme,

        colors: extractedPalette, // Use actual extracted colors
        title: uploadTitle || 'Extracted Color Match',
        image: selectedImageUri,
        metadata: { 
          extractionMethod: 'coolors_extractor', 
          originalImage: selectedImageUri, 
          uploadTitle,
          extractedColors: extractedPalette.length
        },
      };

      await ApiService.ready; // ensure token is loaded from SecureStore first
      const response = await ApiService.createColorMatch(colorMatch);
      const saved = response?.colorMatch || response?.data || response;
      if (!saved) throw new Error('Unexpected server response.');

      setColorMatches(prev => [saved, ...prev]);
      onSaveColorMatch?.({
        ...colorMatch,
        id: saved.id ?? saved._id,
        timestamp: saved.created_at ?? saved.createdAt ?? new Date().toISOString(),
        privacy: uploadPrivacy,
      }, uploadScheme);

      // Navigate to the specific board/folder after saving - use proper objects, not strings
      setSelectedMainFolder(MAIN_FOLDERS_BY_ID[uploadPrivacy] || null);
      setSelectedSchemeFolder(SCHEME_FOLDERS_BY_ID[uploadScheme] || null);

      setShowUploadModal(false);
      setUploadTitle('');
      setExtractedPalette(null);
      Alert.alert('Success!', `Color match saved to your ${uploadScheme} board!`);
    } catch (e) {
      console.error('Error saving extracted palette:', e);
      Alert.alert('Save Failed', e?.message || 'Failed to save color match. Please try again.');
    }
  }, [extractedPalette, uploadScheme, uploadPrivacy, uploadTitle, selectedImageUri, onSaveColorMatch]);

  const renderBoardGrid = () => {
    // Show specific scheme folder content
    if (selectedSchemeFolder && selectedMainFolder) {
      const boardMatches = getBoardColorMatches(selectedSchemeFolder.id, selectedMainFolder.id);
      
      return (
        <View style={styles.container}>
          <View style={styles.boardHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setSelectedSchemeFolder(null)}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.boardTitle}>
              {selectedMainFolder.icon} {selectedSchemeFolder.icon} {selectedSchemeFolder.name}
            </Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                setUploadScheme(selectedSchemeFolder.id);
                setUploadPrivacy(selectedMainFolder.id);
                setShowUploadModal(true);
              }}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.boardDescription}>
            {selectedMainFolder.name} • {selectedSchemeFolder.description}
          </Text>
          
          <FlatList
            data={boardMatches}
            numColumns={2}
            keyExtractor={safeId}
            contentContainerStyle={styles.colorMatchGrid}
            renderItem={({ item }) => (
              <View style={styles.colorMatchCard}>
                <View style={styles.colorMatchHeader}>
                  <Text style={styles.colorMatchTitle}>{item.title || 'Color Match'}</Text>
                  <Text style={styles.colorMatchDate}>
                    {new Date(item.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.colorMatchColors}>
                  {item.colors.map((color, index) => (
                    <View 
                      key={index} 
                      style={[styles.colorMatchSwatch, { backgroundColor: color }]} 
                    />
                  ))}
                </View>
                <Text style={styles.colorMatchBaseColor}>Base: {item.baseColor}</Text>
                <View style={styles.privacyIndicator}>
                  <Text style={styles.privacyText}>
                    {item.privacy === 'private' ? '🔒 Private' : '🌍 Public'}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyBoard}>
                <Text style={styles.emptyBoardIcon}>🎨</Text>
                <Text style={styles.emptyBoardText}>No color matches yet</Text>
                <Text style={styles.emptyBoardSubtext}>
                  Save color combinations from the Color Wheel or upload images
                </Text>
              </View>
            )}
          />
        </View>
      );
    }

    // Show scheme folders within a main folder
    if (selectedMainFolder) {
      return (
        <View style={styles.container}>
          <View style={styles.boardHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setSelectedMainFolder(null)}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.boardTitle}>{selectedMainFolder.icon} {selectedMainFolder.name}</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                setUploadPrivacy(selectedMainFolder.id);
                setShowUploadModal(true);
              }}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.boardDescription}>{selectedMainFolder.description}</Text>
          
          <FlatList
            data={SCHEME_FOLDERS}
            numColumns={2}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.boardGrid}
            renderItem={({ item }) => {
              const matchCount = getBoardColorMatches(item.id, selectedMainFolder.id).length;
              return (
                <TouchableOpacity 
                  style={styles.boardCard}
                  onPress={() => setSelectedSchemeFolder(item)}
                >
                  <View style={styles.boardIcon}>
                    <Text style={styles.boardIconText}>{item.icon}</Text>
                  </View>
                  <Text style={styles.boardName}>{item.name}</Text>
                  <Text style={styles.boardCount}>
                    {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                  </Text>
                  
                  {/* Preview colors if available */}
                  {matchCount > 0 && (
                    <View style={styles.boardPreview}>
                      {(() => {
                        const matches = getBoardColorMatches(item.id, selectedMainFolder.id);
                        return matches.length > 0 ? matches.slice(0, 3).map((match, index) => (
                          <View 
                            key={index}
                            style={[
                              styles.previewSwatch, 
                              { backgroundColor: match.baseColor, marginLeft: index * -5 }
                            ]} 
                          />
                        )) : null;
                      })()}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Boards</Text>
          <Text style={styles.subtitle}>Organize your color combinations</Text>
        </View>

        <FlatList
          data={MAIN_FOLDERS}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.boardGrid}
          renderItem={({ item }) => {
            const matchCount = getMainFolderColorMatches(item.id).length;
            return (
              <TouchableOpacity 
                style={styles.boardCard}
                onPress={() => setSelectedMainFolder(item)}
              >
                <View style={styles.boardIcon}>
                  <Text style={styles.boardIconText}>{item.icon}</Text>
                </View>
                <Text style={styles.boardName}>{item.name}</Text>
                <Text style={styles.boardCount}>
                  {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                </Text>
                
                {/* Preview colors if available */}
                {matchCount > 0 && (
                  <View style={styles.boardPreview}>
                    {(() => {
                      const matches = getMainFolderColorMatches(item.id);
                      return matches.length > 0 ? matches.slice(0, 3).map((match, index) => (
                        <View 
                          key={index}
                          style={[
                            styles.previewSwatch, 
                            { backgroundColor: match.baseColor, marginLeft: index * -5 }
                          ]} 
                        />
                      )) : null;
                    })()}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity 
          style={styles.uploadFab}
          onPress={() => setShowUploadModal(true)}
        >
          <Text style={styles.uploadFabText}>+</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      {renderBoardGrid()}
      
      {/* Upload Modal */}
      <Modal visible={showUploadModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {extractedPalette ? 'Save Extracted Palette' : 'Upload Color Match'}
            </Text>
            
            {/* Show extracted colors preview */}
            {extractedPalette && (
              <View style={styles.extractedColorsPreview}>
                <Text style={styles.extractedColorsLabel}>Extracted Colors:</Text>
                <View style={styles.extractedColorsRow}>
                  {extractedPalette.map((color, index) => (
                    <View
                      key={index}
                      style={[styles.extractedColorSwatch, { backgroundColor: color }]}
                    />
                  ))}
                </View>
              </View>
            )}
            
            <TextInput
              style={styles.titleInput}
              value={uploadTitle}
              onChangeText={setUploadTitle}
              placeholder="Enter title (optional)"
              placeholderTextColor="#999"
            />
            
            <Text style={styles.schemeLabel}>Privacy:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.schemeSelector}>
              {MAIN_FOLDERS.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={[
                    styles.schemeSelectorButton,
                    uploadPrivacy === folder.id && styles.selectedSchemeSelector
                  ]}
                  onPress={() => setUploadPrivacy(folder.id)}
                >
                  <Text style={styles.schemeSelectorIcon}>{folder.icon}</Text>
                  <Text style={[
                    styles.schemeSelectorText,
                    uploadPrivacy === folder.id && styles.selectedSchemeSelectorText
                  ]}>
                    {folder.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Text style={styles.schemeLabel}>Color Scheme:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.schemeSelector}>
              {SCHEME_FOLDERS.map((scheme) => (
                <TouchableOpacity
                  key={scheme.id}
                  style={[
                    styles.schemeSelectorButton,
                    uploadScheme === scheme.id && styles.selectedSchemeSelector
                  ]}
                  onPress={() => setUploadScheme(scheme.id)}
                >
                  <Text style={styles.schemeSelectorIcon}>{scheme.icon}</Text>
                  <Text style={[
                    styles.schemeSelectorText,
                    uploadScheme === scheme.id && styles.selectedSchemeSelectorText
                  ]}>
                    {scheme.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowUploadModal(false);
                  setUploadTitle('');
                  setUploadPrivacy('private');
                  setUploadScheme('complementary');
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={extractedPalette ? handleSaveExtractedPalette : handleUploadImage}
              >
                <Text style={styles.uploadButtonText}>
                  {extractedPalette ? '💾 Save Palette' : '📷 Upload Image'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  boardGrid: {
    padding: 15,
  },
  boardCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    margin: 7.5,
    width: boardWidth,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  boardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  boardIconText: {
    fontSize: 30,
  },
  boardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
    textAlign: 'center',
  },
  boardCount: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  boardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  previewSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  uploadFab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  uploadFabText: {
    fontSize: 30,
    color: 'white',
    fontWeight: 'bold',
  },
  // Board detail view
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  boardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
  boardDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  colorMatchGrid: {
    padding: 15,
  },
  colorMatchCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    margin: 7.5,
    width: boardWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  colorMatchHeader: {
    marginBottom: 10,
  },
  colorMatchTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  colorMatchDate: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  colorMatchColors: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  colorMatchSwatch: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    marginRight: 5,
    borderWidth: 2,
    borderColor: 'white',
  },
  colorMatchBaseColor: {
    fontSize: 12,
    color: '#7f8c8d',
    fontFamily: 'monospace',
  },
  emptyBoard: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyBoardIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyBoardText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyBoardSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 20,
    width: '85%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2c3e50',
    textAlign: 'center',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  schemeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  schemeSelector: {
    marginBottom: 25,
  },
  schemeSelectorButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginRight: 10,
    borderRadius: 15,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 80,
  },
  selectedSchemeSelector: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  schemeSelectorIcon: {
    fontSize: 20,
    marginBottom: 5,
  },
  schemeSelectorText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedSchemeSelectorText: {
    color: 'white',
  },
  // Privacy indicator styles
  privacyIndicator: {
    marginTop: 8,
    alignItems: 'center',
  },
  privacyText: {
    fontSize: 10,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  cancelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Extracted colors preview styles
  extractedColorsPreview: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  extractedColorsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  extractedColorsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  extractedColorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginHorizontal: 3,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default BoardsScreen;
