// hooks/useColorMatches.js - Color matches state management
import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/safeApiService';

const getMatchesKey = (userId) => `savedColorMatches:${userId || 'anon'}`;

export const useColorMatches = (user) => {
  const [savedColorMatches, setSavedColorMatches] = useState([]);

  const loadSavedColorMatches = useCallback(async (key) => {
    try {
      try {
        await ApiService.ready;
        const backendMatches = typeof ApiService.getUserColorMatches === 'function' 
          ? await ApiService.getUserColorMatches() 
          : null;
        if (backendMatches && Array.isArray(backendMatches)) {
          // Limit memory usage - only keep recent matches
          const limitedMatches = backendMatches.slice(-100);
          setSavedColorMatches(limitedMatches);
          
          // Async storage update (non-blocking)
          if (limitedMatches.length > 0) {
            AsyncStorage.setItem(key, JSON.stringify(limitedMatches)).catch(error => {
              console.warn('Failed to cache matches to AsyncStorage:', error);
            });
          }
          return;
        }
      } catch (apiError) {
        if (__DEV__) console.warn('Failed to load matches from API:', apiError);
      }
      
      // Fallback to local storage
      const saved = await AsyncStorage.getItem(key);
      if (saved) {
        try {
          const localMatches = JSON.parse(saved);
          // Validate and limit the data
          if (Array.isArray(localMatches)) {
            const limitedMatches = localMatches.slice(-100);
            setSavedColorMatches(limitedMatches);
          } else {
            setSavedColorMatches([]);
          }
        } catch (parseError) {
          console.warn('Failed to parse saved matches:', parseError);
          setSavedColorMatches([]);
          // Clear corrupted data
          AsyncStorage.removeItem(key).catch(() => {});
        }
      } else {
        setSavedColorMatches([]);
      }
    } catch (error) {
      console.warn('loadSavedColorMatches error:', error);
      setSavedColorMatches([]);
    }
  }, []);

  const saveColorMatch = useCallback(async (colorMatch) => {
    try {
      // Validate input
      if (!colorMatch || typeof colorMatch !== 'object') {
        throw new Error('Invalid color match data: must be an object');
      }
      if (!Array.isArray(colorMatch.colors) || colorMatch.colors.length === 0) {
        throw new Error('Invalid color match data: colors array is required');
      }
      if (!colorMatch.base_color || typeof colorMatch.base_color !== 'string') {
        throw new Error('Invalid color match data: base_color is required');
      }
      if (!colorMatch.scheme || typeof colorMatch.scheme !== 'string') {
        throw new Error('Invalid color match data: scheme is required');
      }

      // Attempt to save to backend
      try {
        const savedResp = await ApiService.createColorMatch({
          base_color: colorMatch.base_color,
          scheme: colorMatch.scheme,
          colors: colorMatch.colors,
          title: colorMatch.title || `${colorMatch.scheme} palette`,
          description: colorMatch.description || '',
          is_public: !!colorMatch.is_public
        });
        
        const savedMatch = (savedResp && savedResp.data) ? savedResp.data : savedResp;
        
        // Memory-efficient update using functional state update
        setSavedColorMatches(prevMatches => {
          const newMatches = [...prevMatches, savedMatch];
          // Limit memory usage - keep only last 100 matches
          const trimmedMatches = newMatches.length > 100 ? newMatches.slice(-100) : newMatches;
          
          // Async storage update (don't block UI)
          const key = getMatchesKey(user?.id);
          AsyncStorage.setItem(key, JSON.stringify(trimmedMatches)).catch(error => {
            console.warn('Failed to save to AsyncStorage:', error);
          });
          
          return trimmedMatches;
        });
        
        return savedMatch;
      } catch (apiError) {
        console.warn('Failed to save to backend, using local storage:', apiError);
        
        // Offline/local fallback with memory optimization
        const localMatch = { 
          ...colorMatch, 
          id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique ID
          created_at: new Date().toISOString(),
          _isLocal: true // Mark as local for sync later
        };
        
        setSavedColorMatches(prevMatches => {
          const newMatches = [...prevMatches, localMatch];
          // Limit memory usage
          const trimmedMatches = newMatches.length > 100 ? newMatches.slice(-100) : newMatches;
          
          // Async storage update
          const key = getMatchesKey(user?.id);
          AsyncStorage.setItem(key, JSON.stringify(trimmedMatches)).catch(error => {
            console.warn('Failed to save to AsyncStorage:', error);
          });
          
          return trimmedMatches;
        });
        
        return localMatch;
      }
    } catch (error) {
      console.error('saveColorMatch error:', error);
      throw error; // Re-throw for UI error handling
    }
  }, [user?.id]);

  // Load matches when user changes
  useEffect(() => {
    if (user?.id) {
      loadSavedColorMatches(getMatchesKey(user.id));
    } else {
      loadSavedColorMatches(getMatchesKey(null));
    }
  }, [user?.id, loadSavedColorMatches]);

  // Memory cleanup on unmount
  useEffect(() => {
    return () => {
      setSavedColorMatches([]);
    };
  }, []);

  return {
    savedColorMatches,
    saveColorMatch,
    loadSavedColorMatches,
  };
};
