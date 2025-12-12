// hooks/useNonBlockingStorage.js - React hooks for non-blocking storage operations
import { useState, useEffect, useCallback, useRef } from 'react';
import { lazyStorageManager } from '../utils/nonBlockingStorage';

// ✅ HOOK: Non-blocking user data with lazy loading
export const useUserData = (loadComplete = false) => {
  const [basicUser, setBasicUser] = useState(null);
  const [completeUser, setCompleteUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);
  const isMountedRef = useRef(true);

  // ✅ FAST LOAD: Load basic user data immediately
  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    const loadBasicData = async () => {
      try {
        if (isMountedRef.current) {
          setLoading(true);
          setError(null);
        }

        // ✅ FAST PATH: Load basic user data (non-blocking)
        const basic = await lazyStorageManager.getUserBasic();
        
        // ✅ RACE CONDITION FIX: Only update state if component is still mounted
        if (isMountedRef.current) {
          setBasicUser(basic);
        }

        // ✅ PRELOAD: Start preloading essentials in background
        lazyStorageManager.preloadEssentials().catch(console.warn);

      } catch (err) {
        console.error('Failed to load basic user data:', err);
        if (isMountedRef.current) {
          setError(err);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadBasicData();

    // ✅ CLEANUP: Reset loading flag and mark as unmounted
    return () => {
      loadingRef.current = false;
      isMountedRef.current = false;
    };
  }, []);

  // ✅ COMPLETE LOAD: Load complete user data when requested
  useEffect(() => {
    if (!loadComplete || !basicUser || completeUser) return;

    const loadCompleteData = async () => {
      try {
        if (isMountedRef.current) {
          setLoading(true);
        }
        
        const complete = await lazyStorageManager.getCompleteUserData();
        
        // ✅ RACE CONDITION FIX: Only update state if component is still mounted
        if (isMountedRef.current) {
          setCompleteUser(complete);
        }
      } catch (err) {
        console.error('Failed to load complete user data:', err);
        if (isMountedRef.current) {
          setError(err);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadCompleteData();
  }, [loadComplete, basicUser, completeUser]);

  // ✅ REFRESH: Manually refresh user data
  const refresh = useCallback(async (complete = false) => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      // Clear cache to force refresh
      lazyStorageManager.clearCache();

      if (complete) {
        const completeData = await lazyStorageManager.getCompleteUserData();
        if (isMountedRef.current) {
          setCompleteUser(completeData);
          setBasicUser(completeData); // Basic is subset of complete
        }
      } else {
        const basicData = await lazyStorageManager.getUserBasic();
        if (isMountedRef.current) {
          setBasicUser(basicData);
        }
      }
    } catch (err) {
      console.error('Failed to refresh user data:', err);
      if (isMountedRef.current) {
        setError(err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  return {
    user: completeUser || basicUser,
    basicUser,
    completeUser,
    loading,
    error,
    refresh,
    hasCompleteData: !!completeUser
  };
};

// ✅ HOOK: Paginated user boards with lazy loading
export const useUserBoards = (autoLoad = true) => {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const isMountedRef = useRef(true);
  const pageSize = 10;

  // ✅ CLEANUP: Mark as unmounted on cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ✅ LOAD PAGE: Load a specific page of boards
  const loadPage = useCallback(async (pageNum, append = false) => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      const pageBoards = await lazyStorageManager.getUserBoards(pageNum, pageSize);
      
      // ✅ RACE CONDITION FIX: Only update state if component is still mounted
      if (isMountedRef.current) {
        if (append) {
          setBoards(prev => [...prev, ...pageBoards]);
        } else {
          setBoards(pageBoards);
        }

        // Check if there are more pages
        setHasMore(pageBoards.length === pageSize);
      }
      
      return pageBoards;
    } catch (err) {
      console.error(`Failed to load boards page ${pageNum}:`, err);
      if (isMountedRef.current) {
        setError(err);
      }
      return [];
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [pageSize]);

  // ✅ LOAD MORE: Load next page and append to current boards
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    const nextPage = page + 1;
    const newBoards = await loadPage(nextPage, true);
    
    if (newBoards.length > 0 && isMountedRef.current) {
      setPage(nextPage);
    }
  }, [loading, hasMore, page, loadPage]);

  // ✅ REFRESH: Reload from first page
  const refresh = useCallback(async () => {
    if (isMountedRef.current) {
      setPage(0);
      setHasMore(true);
    }
    await loadPage(0, false);
  }, [loadPage]);

  // ✅ AUTO LOAD: Load first page on mount
  useEffect(() => {
    if (autoLoad) {
      loadPage(0, false);
    }
  }, [autoLoad, loadPage]);

  return {
    boards,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    currentPage: page
  };
};

// ✅ HOOK: Paginated color history with lazy loading
export const useColorHistory = (autoLoad = true) => {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const isMountedRef = useRef(true);
  const pageSize = 20;

  // ✅ CLEANUP: Mark as unmounted on cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ✅ LOAD PAGE: Load a specific page of colors
  const loadPage = useCallback(async (pageNum, append = false) => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      const pageColors = await lazyStorageManager.getColorHistory(pageNum, pageSize);
      
      // ✅ RACE CONDITION FIX: Only update state if component is still mounted
      if (isMountedRef.current) {
        if (append) {
          setColors(prev => [...prev, ...pageColors]);
        } else {
          setColors(pageColors);
        }

        // Check if there are more pages
        setHasMore(pageColors.length === pageSize);
      }
      
      return pageColors;
    } catch (err) {
      console.error(`Failed to load colors page ${pageNum}:`, err);
      if (isMountedRef.current) {
        setError(err);
      }
      return [];
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [pageSize]);

  // ✅ LOAD MORE: Load next page and append to current colors
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    const nextPage = page + 1;
    const newColors = await loadPage(nextPage, true);
    
    if (newColors.length > 0 && isMountedRef.current) {
      setPage(nextPage);
    }
  }, [loading, hasMore, page, loadPage]);

  // ✅ REFRESH: Reload from first page
  const refresh = useCallback(async () => {
    if (isMountedRef.current) {
      setPage(0);
      setHasMore(true);
    }
    await loadPage(0, false);
  }, [loadPage]);

  // ✅ AUTO LOAD: Load first page on mount
  useEffect(() => {
    if (autoLoad) {
      loadPage(0, false);
    }
  }, [autoLoad, loadPage]);

  return {
    colors,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    currentPage: page
  };
};

// ✅ HOOK: User preferences (usually small, can load immediately)
export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  // ✅ CLEANUP: Mark as unmounted on cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ✅ LOAD PREFERENCES: Load user preferences
  const loadPreferences = useCallback(async () => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      const prefs = await lazyStorageManager.getUserPreferences();
      
      // ✅ RACE CONDITION FIX: Only update state if component is still mounted
      if (isMountedRef.current) {
        setPreferences(prefs || {});
      }
    } catch (err) {
      console.error('Failed to load user preferences:', err);
      if (isMountedRef.current) {
        setError(err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // ✅ UPDATE PREFERENCES: Update user preferences
  const updatePreferences = useCallback(async (newPreferences) => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);

        // Update local state immediately for responsiveness
        setPreferences(prev => ({ ...prev, ...newPreferences }));
      }

      // Save to storage (non-blocking)
      await lazyStorageManager.setUserData({
        preferences: { ...preferences, ...newPreferences }
      });
    } catch (err) {
      console.error('Failed to update user preferences:', err);
      if (isMountedRef.current) {
        setError(err);
        
        // Revert local state on error
        await loadPreferences();
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [preferences, loadPreferences]);

  // ✅ AUTO LOAD: Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    refresh: loadPreferences
  };
};

// ✅ HOOK: Background preloader for better UX
export const useStoragePreloader = () => {
  const [preloaded, setPreloaded] = useState(false);
  const [preloading, setPreloading] = useState(false);

  const preload = useCallback(async () => {
    if (preloaded || preloading) return;

    try {
      setPreloading(true);
      await lazyStorageManager.preloadEssentials();
      setPreloaded(true);
      console.log('✅ Storage preloading completed');
    } catch (error) {
      console.warn('⚠️ Storage preloading failed:', error);
    } finally {
      setPreloading(false);
    }
  }, [preloaded, preloading]);

  // ✅ AUTO PRELOAD: Start preloading on mount
  useEffect(() => {
    // Delay preloading slightly to not interfere with initial render
    const timer = setTimeout(preload, 100);
    return () => clearTimeout(timer);
  }, [preload]);

  return {
    preloaded,
    preloading,
    preload
  };
};

// ✅ HOOK: Storage performance monitoring
export const useStoragePerformance = () => {
  const [metrics, setMetrics] = useState({
    cacheHits: 0,
    cacheMisses: 0,
    loadTimes: [],
    averageLoadTime: 0
  });

  const recordLoadTime = useCallback((operation, duration) => {
    setMetrics(prev => {
      const newLoadTimes = [...prev.loadTimes, { operation, duration, timestamp: Date.now() }];
      
      // Keep only last 50 measurements
      if (newLoadTimes.length > 50) {
        newLoadTimes.splice(0, newLoadTimes.length - 50);
      }

      const averageLoadTime = newLoadTimes.reduce((sum, item) => sum + item.duration, 0) / newLoadTimes.length;

      return {
        ...prev,
        loadTimes: newLoadTimes,
        averageLoadTime: Math.round(averageLoadTime)
      };
    });
  }, []);

  const recordCacheHit = useCallback(() => {
    setMetrics(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
  }, []);

  const recordCacheMiss = useCallback(() => {
    setMetrics(prev => ({ ...prev, cacheMisses: prev.cacheMisses + 1 }));
  }, []);

  const resetMetrics = useCallback(() => {
    setMetrics({
      cacheHits: 0,
      cacheMisses: 0,
      loadTimes: [],
      averageLoadTime: 0
    });
  }, []);

  return {
    metrics,
    recordLoadTime,
    recordCacheHit,
    recordCacheMiss,
    resetMetrics
  };
};
