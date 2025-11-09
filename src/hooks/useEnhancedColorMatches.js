// hooks/useEnhancedColorMatches.js - Enhanced color matches with likes integration
// Extends the original useColorMatches with social features and better API integration

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ApiService from '../services/api';
import { useUserPreferences } from '../utils/userPreferences';

const STORAGE_KEY = '@ColorMatches_Enhanced';
const MAX_LOCAL_MATCHES = 50;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useEnhancedColorMatches = () => {
  const [colorMatches, setColorMatches] = useState([]);
  const [likedMatches, setLikedMatches] = useState([]);
  const [popularMatches, setPopularMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  
  const { saveSchemeHistory } = useUserPreferences();
  const abortControllerRef = useRef(null);

  // Load cached data on mount
  useEffect(() => {
    loadCachedMatches();
  }, []);

  /**
   * Load cached color matches from local storage
   */
  const loadCachedMatches = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { matches, timestamp } = JSON.parse(cached);
        
        // Use cached data if recent, otherwise fetch fresh
        if (Date.now() - timestamp < CACHE_DURATION) {
          setColorMatches(matches);
          setLastFetch(timestamp);
        } else {
          // Cached data is stale, fetch fresh
          fetchColorMatches();
        }
      } else {
        // No cached data, fetch fresh
        fetchColorMatches();
      }
    } catch (error) {
      console.warn('Failed to load cached color matches:', error);
      fetchColorMatches();
    }
  }, []);

  /**
   * Cache color matches to local storage
   */
  const cacheMatches = useCallback(async (matches) => {
    try {
      const cacheData = {
        matches: matches.slice(0, MAX_LOCAL_MATCHES),
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache color matches:', error);
    }
  }, []);

  /**
   * Fetch color matches from API with enhanced error handling
   */
  const fetchColorMatches = useCallback(async (force = false) => {
    // Skip if already loading or recently fetched (unless forced)
    if (loading || (!force && lastFetch && Date.now() - lastFetch < 30000)) {
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      // Fetch user's color matches
      const userMatches = await ApiService.getUserColorMatches();
      
      // Process and enhance matches with like information
      const enhancedMatches = await enhanceMatchesWithLikes(userMatches.data || userMatches);
      
      setColorMatches(enhancedMatches);
      setLastFetch(Date.now());
      
      // Cache the results
      await cacheMatches(enhancedMatches);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch color matches:', error);
        setError(error.message || 'Failed to load color matches');
        
        // Fallback to cached data if available
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached) {
          const { matches } = JSON.parse(cached);
          setColorMatches(matches);
        }
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [loading, lastFetch, cacheMatches]);

  /**
   * Enhance color matches with like information
   */
  const enhanceMatchesWithLikes = useCallback(async (matches) => {
    if (!matches || matches.length === 0) return [];

    try {
      // Get like information for all matches
      const matchIds = matches.map(match => match.id);
      const likePromises = matchIds.map(id => 
        ApiService.getColorMatchLikes(id).catch(() => ({ like_count: 0, is_liked: false }))
      );
      
      const likeResults = await Promise.all(likePromises);
      
      // Enhance matches with like data
      return matches.map((match, index) => ({
        ...match,
        like_count: likeResults[index]?.like_count || 0,
        is_liked: likeResults[index]?.is_liked || false
      }));
    } catch (error) {
      console.warn('Failed to enhance matches with likes:', error);
      return matches.map(match => ({
        ...match,
        like_count: 0,
        is_liked: false
      }));
    }
  }, []);

  /**
   * Save a new color match with enhanced features
   */
  const saveColorMatch = useCallback(async (colorMatchData) => {
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!colorMatchData.base_color || !colorMatchData.scheme || !colorMatchData.colors) {
        throw new Error('Missing required color match data');
      }

      // Ensure colors is an array
      const colors = Array.isArray(colorMatchData.colors) 
        ? colorMatchData.colors 
        : [colorMatchData.colors];

      // Prepare the payload for the API
      const payload = {
        base_color: colorMatchData.base_color,
        scheme: colorMatchData.scheme,
        colors,
        title: colorMatchData.title || `${colorMatchData.scheme} palette`,
        description: colorMatchData.description || '',
        privacy: colorMatchData.privacy || 'private'
      };

      // Save to API
      const response = await ApiService.createColorMatch(payload);
      const newMatch = response.data || response;

      // Add to local state
      setColorMatches(prev => [newMatch, ...prev]);
      
      // Save to scheme history
      await saveSchemeHistory(colorMatchData.scheme, colors);
      
      // Update cache
      const updatedMatches = [newMatch, ...colorMatches];
      await cacheMatches(updatedMatches);

      return newMatch;
    } catch (error) {
      console.error('Failed to save color match:', error);
      setError(error.message || 'Failed to save color match');
      
      // Fallback: save locally if API fails
      try {
        const localMatch = {
          id: `local_${Date.now()}`,
          ...colorMatchData,
          created_at: new Date().toISOString(),
          like_count: 0,
          is_liked: false,
          local: true // Mark as local-only
        };
        
        setColorMatches(prev => [localMatch, ...prev]);
        await saveSchemeHistory(colorMatchData.scheme, colorMatchData.colors);
        
        return localMatch;
      } catch (localError) {
        console.error('Failed to save locally:', localError);
        throw error;
      }
    } finally {
      setLoading(false);
    }
  }, [colorMatches, cacheMatches, saveSchemeHistory]);

  /**
   * Like/unlike a color match
   */
  const toggleLike = useCallback(async (colorMatchId) => {
    const match = colorMatches.find(m => m.id === colorMatchId);
    if (!match) return;

    const wasLiked = match.is_liked;
    
    // Optimistic update
    setColorMatches(prev => prev.map(m => 
      m.id === colorMatchId 
        ? { 
            ...m, 
            is_liked: !wasLiked,
            like_count: wasLiked ? m.like_count - 1 : m.like_count + 1
          }
        : m
    ));

    try {
      if (wasLiked) {
        await ApiService.unlikeColorMatch(colorMatchId);
      } else {
        await ApiService.likeColorMatch(colorMatchId);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      
      // Revert optimistic update on error
      setColorMatches(prev => prev.map(m => 
        m.id === colorMatchId 
          ? { 
              ...m, 
              is_liked: wasLiked,
              like_count: wasLiked ? m.like_count + 1 : m.like_count - 1
            }
          : m
      ));
      
      setError('Failed to update like status');
    }
  }, [colorMatches]);

  /**
   * Fetch user's liked color matches
   */
  const fetchLikedMatches = useCallback(async () => {
    try {
      const response = await ApiService.getUserLikedColorMatches();
      const matches = response.data?.color_matches || response.color_matches || [];
      setLikedMatches(matches);
      return matches;
    } catch (error) {
      console.error('Failed to fetch liked matches:', error);
      setError('Failed to load liked matches');
      return [];
    }
  }, []);

  /**
   * Fetch popular color matches
   */
  const fetchPopularMatches = useCallback(async (params = {}) => {
    try {
      const response = await ApiService.getPopularColorMatches(params);
      const matches = response.data?.color_matches || response.color_matches || [];
      setPopularMatches(matches);
      return matches;
    } catch (error) {
      console.error('Failed to fetch popular matches:', error);
      setError('Failed to load popular matches');
      return [];
    }
  }, []);

  /**
   * Delete a color match
   */
  const deleteColorMatch = useCallback(async (colorMatchId) => {
    try {
      await ApiService.deleteColorMatch(colorMatchId);
      
      // Remove from local state
      setColorMatches(prev => prev.filter(m => m.id !== colorMatchId));
      setLikedMatches(prev => prev.filter(m => m.id !== colorMatchId));
      
      // Update cache
      const updatedMatches = colorMatches.filter(m => m.id !== colorMatchId);
      await cacheMatches(updatedMatches);
      
    } catch (error) {
      console.error('Failed to delete color match:', error);
      setError('Failed to delete color match');
      throw error;
    }
  }, [colorMatches, cacheMatches]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchColorMatches(true),
      fetchLikedMatches(),
      fetchPopularMatches()
    ]);
  }, [fetchColorMatches, fetchLikedMatches, fetchPopularMatches]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Data
    colorMatches,
    likedMatches,
    popularMatches,
    
    // State
    loading,
    error,
    lastFetch,
    
    // Actions
    saveColorMatch,
    deleteColorMatch,
    toggleLike,
    fetchColorMatches,
    fetchLikedMatches,
    fetchPopularMatches,
    refresh,
    clearError,
    
    // Utilities
    enhanceMatchesWithLikes,
    cacheMatches
  };
};
