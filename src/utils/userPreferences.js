// utils/userPreferences.js - Persistent user preferences system
// Saves and restores user UI preferences across app sessions

import { safeAsyncStorage } from './safeAsyncStorage';

// Storage keys for different preference types
const STORAGE_KEYS = {
  COLOR_WHEEL_PREFS: '@ColorWheel_UserPreferences',
  UI_SETTINGS: '@UI_Settings',
  SCHEME_HISTORY: '@SchemeHistory'
};

// Default preferences
const DEFAULT_PREFERENCES = {
  // Color wheel behavior
  linked: true,
  selectedFollowsActive: true,
  defaultScheme: 'complementary',
  
  // UI preferences
  showHandleLabels: false,
  activeHandleStyle: 'highlight', // 'highlight', 'glow', 'border'
  wheelSize: 'medium', // 'small', 'medium', 'large'
  
  // Performance settings
  throttleFps: 30,
  immediateFps: 60,
  enableHaptics: true,
  
  // Advanced settings
  rememberSchemeSettings: true,
  autoSaveColorMatches: false,
  showColorValues: false
};

class UserPreferences {
  constructor() {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.listeners = new Set();
    this.loaded = false;
  }

  /**
   * Load preferences from storage
   */
  async load() {
    try {
      const stored = await safeAsyncStorage.getItem(STORAGE_KEYS.COLOR_WHEEL_PREFS);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.preferences = { ...DEFAULT_PREFERENCES, ...parsed };
      }
      this.loaded = true;
      this.notifyListeners();
    } catch (error) {
      console.warn('Failed to load user preferences:', error);
      this.preferences = { ...DEFAULT_PREFERENCES };
      this.loaded = true;
    }
  }

  /**
   * Save preferences to storage
   */
  async save() {
    try {
      await safeAsyncStorage.setItem(
        STORAGE_KEYS.COLOR_WHEEL_PREFS,
        JSON.stringify(this.preferences)
      );
    } catch (error) {
      console.warn('Failed to save user preferences:', error);
    }
  }

  /**
   * Get a specific preference
   */
  get(key) {
    return this.preferences[key] ?? DEFAULT_PREFERENCES[key];
  }

  /**
   * Set a specific preference
   */
  async set(key, value) {
    this.preferences[key] = value;
    this.notifyListeners();
    await this.save();
  }

  /**
   * Update multiple preferences at once
   */
  async update(updates) {
    this.preferences = { ...this.preferences, ...updates };
    this.notifyListeners();
    await this.save();
  }

  /**
   * Reset to defaults
   */
  async reset() {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.notifyListeners();
    await this.save();
  }

  /**
   * Get all preferences
   */
  getAll() {
    return { ...this.preferences };
  }

  /**
   * Subscribe to preference changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.preferences);
      } catch (error) {
        console.warn('Preference listener error:', error);
      }
    });
  }

  /**
   * Color wheel specific preferences
   */
  getColorWheelPrefs() {
    return {
      linked: this.get('linked'),
      selectedFollowsActive: this.get('selectedFollowsActive'),
      defaultScheme: this.get('defaultScheme'),
      activeHandleStyle: this.get('activeHandleStyle'),
      showHandleLabels: this.get('showHandleLabels')
    };
  }

  async setColorWheelPrefs(prefs) {
    await this.update(prefs);
  }

  /**
   * Performance preferences
   */
  getPerformancePrefs() {
    return {
      throttleFps: this.get('throttleFps'),
      immediateFps: this.get('immediateFps'),
      enableHaptics: this.get('enableHaptics')
    };
  }

  async setPerformancePrefs(prefs) {
    await this.update(prefs);
  }

  /**
   * Scheme history management
   */
  async saveSchemeHistory(scheme, colors) {
    try {
      const historyKey = STORAGE_KEYS.SCHEME_HISTORY;
      const stored = await safeAsyncStorage.getItem(historyKey);
      let history = stored ? JSON.parse(stored) : [];
      
      // Add new entry
      const entry = {
        scheme,
        colors,
        timestamp: Date.now()
      };
      
      history.unshift(entry);
      
      // Keep only last 20 entries
      history = history.slice(0, 20);
      
      await safeAsyncStorage.setItem(historyKey, JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to save scheme history:', error);
    }
  }

  async getSchemeHistory() {
    try {
      const stored = await safeAsyncStorage.getItem(STORAGE_KEYS.SCHEME_HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load scheme history:', error);
      return [];
    }
  }

  /**
   * Smart reset behavior - respects user preferences
   */
  shouldResetToLinked() {
    return this.get('rememberSchemeSettings') ? this.get('linked') : true;
  }

  shouldResetToFollowActive() {
    return this.get('rememberSchemeSettings') ? this.get('selectedFollowsActive') : true;
  }
}

// Singleton instance
const userPreferences = new UserPreferences();

// React hook for easy integration
import { useState, useEffect } from 'react';

export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState(userPreferences.getAll());
  const [loaded, setLoaded] = useState(userPreferences.loaded);

  useEffect(() => {
    // Load preferences on mount
    if (!userPreferences.loaded) {
      userPreferences.load().then(() => {
        setLoaded(true);
        setPreferences(userPreferences.getAll());
      });
    }

    // Subscribe to changes
    const unsubscribe = userPreferences.subscribe((newPrefs) => {
      setPreferences(newPrefs);
    });

    return unsubscribe;
  }, []);

  return {
    preferences,
    loaded,
    get: userPreferences.get.bind(userPreferences),
    set: userPreferences.set.bind(userPreferences),
    update: userPreferences.update.bind(userPreferences),
    reset: userPreferences.reset.bind(userPreferences),
    getColorWheelPrefs: userPreferences.getColorWheelPrefs.bind(userPreferences),
    setColorWheelPrefs: userPreferences.setColorWheelPrefs.bind(userPreferences),
    getPerformancePrefs: userPreferences.getPerformancePrefs.bind(userPreferences),
    setPerformancePrefs: userPreferences.setPerformancePrefs.bind(userPreferences),
    saveSchemeHistory: userPreferences.saveSchemeHistory.bind(userPreferences),
    getSchemeHistory: userPreferences.getSchemeHistory.bind(userPreferences),
    shouldResetToLinked: userPreferences.shouldResetToLinked.bind(userPreferences),
    shouldResetToFollowActive: userPreferences.shouldResetToFollowActive.bind(userPreferences)
  };
};

// Color wheel specific hook
export const useColorWheelPreferences = () => {
  const { preferences, loaded, setColorWheelPrefs } = useUserPreferences();
  
  return {
    loaded,
    linked: preferences.linked,
    selectedFollowsActive: preferences.selectedFollowsActive,
    defaultScheme: preferences.defaultScheme,
    activeHandleStyle: preferences.activeHandleStyle,
    showHandleLabels: preferences.showHandleLabels,
    rememberSchemeSettings: preferences.rememberSchemeSettings,
    
    setLinked: (value) => setColorWheelPrefs({ linked: value }),
    setSelectedFollowsActive: (value) => setColorWheelPrefs({ selectedFollowsActive: value }),
    setDefaultScheme: (value) => setColorWheelPrefs({ defaultScheme: value }),
    setActiveHandleStyle: (value) => setColorWheelPrefs({ activeHandleStyle: value }),
    setShowHandleLabels: (value) => setColorWheelPrefs({ showHandleLabels: value }),
    
    updateAll: setColorWheelPrefs
  };
};

export default userPreferences;
