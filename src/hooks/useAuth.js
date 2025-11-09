// hooks/useAuth.js - Authentication state management
import { useState, useCallback, useEffect } from 'react';
import { safeStorage } from '../utils/safeStorage';
import ApiService from '../services/safeApiService';

const pickUser = (u) => (u?.user ? u.user : u);

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

  const initializeAuth = useCallback(async () => {
    let initTimeout;
    let profileTimeout;
    let isCancelled = false;
    
    try {
      // Set up timeout with cleanup
      initTimeout = setTimeout(() => {
        if (!isCancelled) {
          setLoading(false);
          setIsInitialized(true);
        }
      }, 10000);

      if (isCancelled) return;

      let token = null;
      try {
        token = await safeStorage.getItem('fashion_color_wheel_auth_token');
        if (!token) token = await safeStorage.getItem('authToken');
      } catch (error) {
        if (__DEV__) console.warn('Token retrieval error:', error);
      }

      if (isCancelled) return;

      if (token) {
        try {
          await ApiService?.setToken?.(token);
          await ApiService.ready;
          
          if (isCancelled) return;
          
          let profile = null;
          if (ApiService?.getUserProfile) {
            // Create cancellable profile timeout
            const profilePromise = ApiService.getUserProfile();
            const timeoutPromise = new Promise((_, reject) => {
              profileTimeout = setTimeout(() => {
                if (!isCancelled) reject(new Error('Profile timeout'));
              }, 5000);
            });
            
            try {
              profile = await Promise.race([profilePromise, timeoutPromise]);
              if (profileTimeout) clearTimeout(profileTimeout);
            } catch (timeoutError) {
              if (profileTimeout) clearTimeout(profileTimeout);
              throw timeoutError;
            }
          } else {
            const storedUserData = await AsyncStorage.getItem('userData');
            if (storedUserData) profile = JSON.parse(storedUserData);
          }
          
          if (isCancelled) return;
          
          const normalized = pickUser(profile);
          if (normalized?.id) {
            setUser(normalized);
          } else {
            await clearStoredToken();
          }
        } catch (apiError) {
          if (__DEV__) console.warn('API initialization error:', apiError);
          
          if (isCancelled) return;
          
          const storedUserData = await AsyncStorage.getItem('userData');
          if (storedUserData) {
            const userData = JSON.parse(storedUserData);
            setUser(userData);
          } else {
            await clearStoredToken();
          }
        }
      }

      if (!isCancelled) {
        if (initTimeout) clearTimeout(initTimeout);
        setIsInitialized(true);
      }
    } catch (e) {
      if (!isCancelled) {
        if (initTimeout) clearTimeout(initTimeout);
        if (profileTimeout) clearTimeout(profileTimeout);
        console.error('Auth initialization failed:', e);
        setIsInitialized(true);
      }
    } finally {
      if (!isCancelled) {
        setLoading(false);
      }
    }
    
    // Cleanup function
    return () => {
      isCancelled = true;
      if (initTimeout) clearTimeout(initTimeout);
      if (profileTimeout) clearTimeout(profileTimeout);
    };
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
