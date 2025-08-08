import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, FlatList, TextInput, Dimensions, Alert } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = (screenWidth - 45) / 2; // 2 columns with margins

// Mock community color combinations data (simulating what users have shared)
const COMMUNITY_COLOR_MATCHES = [
  {
    id: '1',
    title: 'Sunset Vibes',
    scheme: 'complementary',
    privacy: 'public',
    colors: ['#FF6B6B', '#4ECDC4'],
    baseColor: '#FF6B6B',
    author: 'FashionLover23',
    likes: 142,
    timestamp: '2024-01-15T10:30:00Z',
    tags: ['sunset', 'warm', 'summer']
  },
  {
    id: '2',
    title: 'Ocean Breeze',
    scheme: 'analogous',
    privacy: 'public',
    colors: ['#45B7D1', '#4ECDC4', '#96CEB4'],
    baseColor: '#45B7D1',
    author: 'ColorMaster',
    likes: 89,
    timestamp: '2024-01-14T15:45:00Z',
    tags: ['ocean', 'cool', 'relaxing']
  },
  {
    id: '3',
    title: 'Spring Garden',
    scheme: 'triadic',
    privacy: 'public',
    colors: ['#96CEB4', '#FFEAA7', '#DDA0DD'],
    baseColor: '#96CEB4',
    author: 'NaturePalette',
    likes: 203,
    timestamp: '2024-01-13T09:15:00Z',
    tags: ['spring', 'nature', 'fresh']
  },
  {
    id: '4',
    title: 'Elegant Neutrals',
    scheme: 'monochromatic',
    privacy: 'public',
    colors: ['#8E8E93', '#AEAEB2', '#C7C7CC'],
    baseColor: '#8E8E93',
    author: 'MinimalStyle',
    likes: 156,
    timestamp: '2024-01-12T14:20:00Z',
    tags: ['neutral', 'elegant', 'minimal']
  },
  {
    id: '5',
    title: 'Bold & Beautiful',
    scheme: 'tetradic',
    privacy: 'public',
    colors: ['#FF6B6B', '#4ECDC4', '#FFEAA7', '#BB8FCE'],
    baseColor: '#FF6B6B',
    author: 'BoldFashion',
    likes: 178,
    timestamp: '2024-01-11T11:30:00Z',
    tags: ['bold', 'vibrant', 'statement']
  },
  {
    id: '6',
    title: 'Autumn Leaves',
    scheme: 'analogous',
    privacy: 'public',
    colors: ['#D2691E', '#FF8C00', '#FFD700'],
    baseColor: '#D2691E',
    author: 'SeasonalStyle',
    likes: 134,
    timestamp: '2024-01-10T16:45:00Z',
    tags: ['autumn', 'warm', 'cozy']
  },
  {
    id: '7',
    title: 'Midnight Sky',
    scheme: 'complementary',
    privacy: 'public',
    colors: ['#191970', '#FFD700'],
    baseColor: '#191970',
    author: 'NightOwl',
    likes: 98,
    timestamp: '2024-01-09T20:15:00Z',
    tags: ['night', 'dramatic', 'luxury']
  },
  {
    id: '8',
    title: 'Tropical Paradise',
    scheme: 'triadic',
    privacy: 'public',
    colors: ['#00CED1', '#FF69B4', '#32CD32'],
    baseColor: '#00CED1',
    author: 'TropicalVibes',
    likes: 221,
    timestamp: '2024-01-08T13:30:00Z',
    tags: ['tropical', 'bright', 'fun']
  }
];

const TRENDING_TAGS = ['sunset', 'ocean', 'spring', 'neutral', 'bold', 'autumn', 'night', 'tropical', 'minimal', 'vintage'];

export default function DiscoverScreen({ onSaveColorMatch }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMatches, setFilteredMatches] = useState(COMMUNITY_COLOR_MATCHES);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [likedMatches, setLikedMatches] = useState(new Set());

  useEffect(() => {
    filterMatches();
  }, [searchQuery, selectedFilter]);

  const filterMatches = () => {
    let filtered = COMMUNITY_COLOR_MATCHES;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(match => 
        match.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        match.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        match.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by scheme
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(match => match.scheme === selectedFilter);
    }

    // Sort by likes (most popular first)
    filtered.sort((a, b) => b.likes - a.likes);

    setFilteredMatches(filtered);
  };

  const handleLike = (matchId) => {
    const newLikedMatches = new Set(likedMatches);
    if (newLikedMatches.has(matchId)) {
      newLikedMatches.delete(matchId);
    } else {
      newLikedMatches.add(matchId);
    }
    setLikedMatches(newLikedMatches);
  };

  const handleSaveToBoard = (match) => {
    const colorMatch = {
      id: Date.now().toString(),
      baseColor: match.baseColor,
      scheme: match.scheme,
      colors: match.colors,
      timestamp: new Date().toISOString(),
      title: `Saved: ${match.title}`,
      originalAuthor: match.author,
    };
    
    onSaveColorMatch(colorMatch, match.scheme);
    Alert.alert('Saved!', `"${match.title}" saved to your ${match.scheme} board`);
  };

  const renderColorMatch = ({ item }) => (
    <View style={styles.colorMatchCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <TouchableOpacity 
          style={styles.likeButton}
          onPress={() => handleLike(item.id)}
        >
          <Text style={[
            styles.likeIcon, 
            likedMatches.has(item.id) && styles.likedIcon
          ]}>
            {likedMatches.has(item.id) ? '❤️' : '🤍'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.colorPreview}>
        {item.colors.map((color, index) => (
          <View 
            key={index} 
            style={[styles.colorSwatch, { backgroundColor: color }]} 
          />
        ))}
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.schemeType}>{item.scheme.charAt(0).toUpperCase() + item.scheme.slice(1)}</Text>
        <Text style={styles.baseColorText}>Base: {item.baseColor}</Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>@{item.author}</Text>
          <Text style={styles.likeCount}>❤️ {item.likes + (likedMatches.has(item.id) ? 1 : 0)}</Text>
        </View>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={() => handleSaveToBoard(item)}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tags}>
        {item.tags.slice(0, 3).map((tag, index) => (
          <Text key={index} style={styles.tag}>#{tag}</Text>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.subtitle}>Explore trending color combinations</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search color combinations..."
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'all' && styles.activeFilterTab]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.activeFilterText]}>
            All
          </Text>
        </TouchableOpacity>
        {['complementary', 'analogous', 'triadic', 'tetradic', 'monochromatic'].map((scheme) => (
          <TouchableOpacity
            key={scheme}
            style={[styles.filterTab, selectedFilter === scheme && styles.activeFilterTab]}
            onPress={() => setSelectedFilter(scheme)}
          >
            <Text style={[styles.filterText, selectedFilter === scheme && styles.activeFilterText]}>
              {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Trending Tags */}
      <View style={styles.trendingSection}>
        <Text style={styles.trendingTitle}>Trending</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TRENDING_TAGS.map((tag, index) => (
            <TouchableOpacity
              key={index}
              style={styles.trendingTag}
              onPress={() => setSearchQuery(tag)}
            >
              <Text style={styles.trendingTagText}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Color Matches Grid */}
      <FlatList
        data={filteredMatches}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.matchesGrid}
        renderItem={renderColorMatch}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🎨</Text>
            <Text style={styles.emptyStateText}>No matches found</Text>
            <Text style={styles.emptyStateSubtext}>Try adjusting your search or filters</Text>
          </View>
        )}
      />
    </View>
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  filterContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 10,
  },
  activeFilterTab: {
    backgroundColor: '#3498db',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  activeFilterText: {
    color: 'white',
  },
  trendingSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  trendingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  trendingTag: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  trendingTagText: {
    fontSize: 12,
    color: '#3498db',
    fontWeight: '600',
  },
  matchesGrid: {
    padding: 15,
  },
  colorMatchCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    margin: 7.5,
    width: cardWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  likeButton: {
    padding: 5,
  },
  likeIcon: {
    fontSize: 16,
  },
  likedIcon: {
    transform: [{ scale: 1.2 }],
  },
  colorPreview: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  colorSwatch: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    marginRight: 5,
    borderWidth: 2,
    borderColor: 'white',
  },
  cardInfo: {
    marginBottom: 10,
  },
  schemeType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3498db',
    marginBottom: 2,
  },
  baseColorText: {
    fontSize: 11,
    color: '#7f8c8d',
    fontFamily: 'monospace',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  likeCount: {
    fontSize: 11,
    color: '#7f8c8d',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  saveButtonText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    fontSize: 10,
    color: '#3498db',
    marginRight: 8,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    width: screenWidth - 30,
  },
  emptyStateIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
});
