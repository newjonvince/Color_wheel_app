// hooks/useAuth.js - Authentication state management
import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeStorage } from '../utils/safeStorage';
import ApiService from '../services/safeApiService';
import { pickUser } from '../config/app';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const clearStoredToken = useCallback(async () => {
    try {
      await safeStorage.clearAuth();
    } catch (error) {
      console.warn('Failed to clear stored tokens:', error);
    }
  }, []);

  const initializeAuth = useCallback(async ({ signal } = {}) => {
    let initTimeout;
    try {
      // Set a safety timeout for the entire initialization
      initTimeout = setTimeout(() => {
        setLoading(false);
        setIsInitialized(true);
      }, 10000);

      // Load token safely
      let token = null;
      try {
        token = await safeStorage.getItem('fashion_color_wheel_auth_token');
        if (!token) token = await safeStorage.getItem('authToken');
      } catch (err) {
        if (__DEV__) console.warn('Token retrieval error:', err);
      }

      if (signal?.aborted) return;

      if (token) {
        try {
          // Safe API service initialization with validation
          if (ApiService?.setToken && typeof ApiService.setToken === 'function') {
            await ApiService.setToken(token);
          } else {
            if (__DEV__) console.warn('ApiService.setToken not available during auth initialization');
          }
          
          // Wait for API service to be ready with timeout protection
          if (ApiService?.ready) {
            try {
              await Promise.race([
                ApiService.ready,
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('ApiService.ready timeout')), 3000)
                )
              ]);
            } catch (readyError) {
              if (__DEV__) console.warn('ApiService.ready failed or timed out:', readyError.message);
              // Continue with fallback - don't block auth initialization
            }
          }
          
          if (signal?.aborted) return;

          let profile = null;
          
          // Safe API profile loading with comprehensive error handling
          if (ApiService?.getUserProfile && typeof ApiService.getUserProfile === 'function') {
            try {
              // Race profile loading with timeout
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Profile timeout')), 5000);
              });
              
              profile = await Promise.race([
                ApiService.getUserProfile(),
                timeoutPromise
              ]);
              
              if (__DEV__) console.log('✅ Profile loaded from API');
            } catch (profileError) {
              if (__DEV__) console.warn('API profile loading failed:', profileError.message);
              // Fall through to storage fallback
            }
          }
          
          // Fallback to stored user data with safe AsyncStorage and JSON parsing
          if (!profile) {
            try {
              const storedUserData = await AsyncStorage.getItem('userData');
              if (storedUserData && typeof storedUserData === 'string' && storedUserData.trim().length > 0) {
                try {
                  profile = JSON.parse(storedUserData);
                  if (__DEV__) console.log('✅ Profile loaded from storage fallback');
                } catch (parseError) {
                  console.warn('Failed to parse stored user data:', parseError.message);
                  // Clear corrupted data
                  try {
                    await AsyncStorage.removeItem('userData');
                  } catch (removeError) {
                    console.warn('Failed to remove corrupted user data:', removeError.message);
                  }
                }
              }
            } catch (storageError) {
              console.error('AsyncStorage.getItem failed during auth initialization:', storageError.message);
              // Continue without profile - not critical for auth initialization
            }
          }

          if (signal?.aborted) return;

          // Safe user normalization and state setting
          try {
            const normalized = pickUser(profile);
            if (normalized?.id) {
              setUser(normalized);
              if (__DEV__) console.log('✅ User set from profile');
            } else {
              if (__DEV__) console.log('No valid user profile found, clearing stored token');
              await clearStoredToken();
            }
          } catch (normalizationError) {
            console.warn('User profile normalization failed:', normalizationError.message);
            await clearStoredToken();
          }
          
        } catch (apiError) {
          if (__DEV__) console.warn('API initialization error:', apiError);
          if (signal?.aborted) return;
          
          // Safe fallback to stored data with comprehensive error handling
          try {
            const storedUserData = await AsyncStorage.getItem('userData');
            if (storedUserData && typeof storedUserData === 'string' && storedUserData.trim().length > 0) {
              try {
                const parsedUser = JSON.parse(storedUserData);
                const normalized = pickUser(parsedUser);
                if (normalized?.id) {
                  setUser(normalized);
                  if (__DEV__) console.log('✅ User set from storage fallback after API error');
                } else {
                  await clearStoredToken();
                }
              } catch (parseError) {
                console.warn('Failed to parse stored user data in fallback:', parseError.message);
                await clearStoredToken();
              }
            } else {
              await clearStoredToken();
            }
          } catch (fallbackError) {
            console.error('Storage fallback failed during auth initialization:', fallbackError.message);
            await clearStoredToken();
          }
        }
      }

      if (signal?.aborted) return;
      setIsInitialized(true);
    } catch (e) {
      console.error('Auth initialization failed:', e);
      setIsInitialized(true);
    } finally {
      if (initTimeout) clearTimeout(initTimeout);
      setLoading(false);
    }
  }, [clearStoredToken]);

  const handleLoginSuccess = useCallback(async (u) => {
    const nextUser = pickUser(u);
    try {
      if (nextUser?.token || nextUser?.authToken) {
        const tokenToSet = nextUser.token || nextUser.authToken;
        await ApiService.setToken?.(tokenToSet);
        if (ApiService.ready) await ApiService.ready;
      }
    } catch (error) {
      console.warn('Token setup failed:', error);
    }
    setUser(nextUser);
    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(nextUser));
    } catch (error) {
      console.warn('Failed to save user data:', error);
    }
  }, []);

  const handleSignUpComplete = useCallback(async (u) => {
    const nextUser = pickUser(u);
    try { 
      if (u && (u.token || u.authToken)) { 
        ApiService.setToken?.(u.token || u.authToken); 
      } 
    } catch (error) {
      console.warn('Token setup failed:', error);
    }
    setUser(nextUser);
    try {
      await AsyncStorage.setItem('isLoggedIn', 'true');
      await AsyncStorage.setItem('userData', JSON.stringify(nextUser));
    } catch (error) {
      console.warn('Failed to save user data:', error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await ApiService.logout?.();
      await ApiService.clearToken?.();
      ApiService.setToken?.(null);
      await AsyncStorage.removeItem('isLoggedIn');
      await AsyncStorage.removeItem('userData');
      setUser(null);
    } catch (error) {
      console.warn('Logout failed:', error);
      setUser(null);
    }
  }, []);

  const handleAccountDeleted = useCallback(async () => {
    try {
      await ApiService.clearToken?.();
      ApiService.setToken?.(null);
      const keysToRemove = ['isLoggedIn', 'userData'];
      await AsyncStorage.multiRemove(keysToRemove);
      setUser(null);
    } catch (error) {
      console.warn('Account deletion cleanup failed:', error);
      setUser(null);
    }
  }, []);

  return {
    user,
    loading,
    isInitialized,
    initializeAuth,
    handleLoginSuccess,
    handleSignUpComplete,
    handleLogout,
    handleAccountDeleted,
  };
};
