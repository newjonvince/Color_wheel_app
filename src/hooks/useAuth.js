// hooks/useAuth.js - Authentication state management with race condition prevention
import { useState, useCallback, useEffect, useRef } from 'react';
import { safeAsyncStorage } from '../utils/safeAsyncStorage';
import { safeStorage } from '../utils/safeStorage';
import ApiService from '../services/safeApiService';
import { pickUser } from '../config/app';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // ✅ Race condition prevention - track ongoing operations
  const initializationRef = useRef(null);
  const loginRef = useRef(null);
  const logoutRef = useRef(null);
  const isMountedRef = useRef(true);

  const clearStoredToken = useCallback(async () => {
    try {
      await safeStorage.clearAuth();
    } catch (error) {
      console.warn('Failed to clear stored tokens:', error);
    }
  }, []);

  // ✅ SAFER: Race condition prevention in initializeAuth
  const initializeAuth = useCallback(async ({ signal } = {}) => {
    // Prevent multiple concurrent initializations
    if (initializationRef.current) {
      console.log('🔄 Auth initialization already in progress, waiting...');
      return initializationRef.current;
    }

    // Create a new initialization promise
    const initPromise = (async () => {
      let initTimeout;
      try {
        if (!isMountedRef.current) return;
        
        // ✅ Check signal BEFORE starting any operations
        if (signal?.aborted || !isMountedRef.current) return;

        // Set a safety timeout for the entire initialization
        initTimeout = setTimeout(() => {
          // ✅ Check abort state before timeout action
          if (!signal?.aborted && isMountedRef.current) {
            setLoading(false);
            setIsInitialized(true);
          }
        }, 10000);

        // ✅ Check signal before each async operation
        if (signal?.aborted || !isMountedRef.current) return;

        // Load token safely
        let token = null;
        try {
          token = await safeStorage.getItem('fashion_color_wheel_auth_token');
          if (!token) token = await safeStorage.getItem('authToken');
        } catch (err) {
          // Always log token retrieval errors for production debugging
          console.warn('Token retrieval error:', err);
        }

        // ✅ Check signal AFTER async operation
        if (signal?.aborted || !isMountedRef.current) return;

      if (token) {
        try {
          // Safe API service initialization with validation
          if (ApiService?.setToken && typeof ApiService.setToken === 'function') {
            await ApiService.setToken(token);
          } else {
            // Always log ApiService availability issues for production debugging
            console.warn('ApiService.setToken not available during auth initialization');
          }
          
          // ✅ Check signal before API service ready check
          if (signal?.aborted || !isMountedRef.current) return;

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
              // Always log ApiService ready failures for production debugging
              console.warn('ApiService.ready failed or timed out:', readyError.message);
              // Continue with fallback - don't block auth initialization
            }
          }
          
          // ✅ Check signal after API service ready
          if (signal?.aborted || !isMountedRef.current) return;

          let profile = null;
          
          // Safe API profile loading with comprehensive error handling
          if (ApiService?.getUserProfile && typeof ApiService.getUserProfile === 'function') {
            try {
              // ✅ Create timeout that respects abort signal
              const timeoutPromise = new Promise((_, reject) => {
                const timeoutId = setTimeout(() => {
                  if (!signal?.aborted) {
                    reject(new Error('Profile timeout'));
                  }
                }, 5000);
                
                // Cancel timeout if signal is aborted
                if (signal) {
                  signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                  });
                }
              });
              
              // ✅ CRITICAL FIX: Pass signal to API call
              profile = await Promise.race([
                ApiService.getUserProfile({ signal }),
                timeoutPromise
              ]);
              
              // Always log successful profile loading for production debugging
              console.log('✅ Profile loaded from API');
            } catch (profileError) {
              // Always log API profile loading failures for production debugging
              console.warn('API profile loading failed:', profileError.message);
              // Fall through to storage fallback
            }
          }
          
          // Fallback to stored user data with safe AsyncStorage and JSON parsing
          if (!profile) {
            try {
              const storedUserData = await safeAsyncStorage.getItem('userData');
              if (storedUserData && typeof storedUserData === 'string' && storedUserData.trim().length > 0) {
                try {
                  profile = JSON.parse(storedUserData);
                  // Always log storage fallback usage for production debugging
                  console.log('✅ Profile loaded from storage fallback');
                } catch (parseError) {
                  console.warn('Failed to parse stored user data:', parseError.message);
                  // Clear corrupted data
                  try {
                    await safeAsyncStorage.removeItem('userData');
                  } catch (removeError) {
                    console.warn('Failed to remove corrupted user data:', removeError.message);
                  }
                }
              }
            } catch (storageError) {
              console.error('safeAsyncStorage.getItem failed during auth initialization:', storageError.message);
              // Continue without profile - not critical for auth initialization
            }
          }

          if (signal?.aborted) return;

          // Safe user normalization and state setting
          try {
            const normalized = pickUser(profile);
            if (normalized?.id) {
              setUser(normalized);
              // Always log successful user setting for production debugging
              console.log('✅ User set from profile');
            } else {
              // Always log invalid profile situations for production debugging
              console.log('No valid user profile found, clearing stored token');
              await clearStoredToken();
            }
          } catch (normalizationError) {
            console.warn('User profile normalization failed:', normalizationError.message);
            await clearStoredToken();
          }
          
        } catch (apiError) {
          // Always log API initialization errors for production debugging
          console.warn('API initialization error:', apiError);
          if (signal?.aborted) return;
          
          // Safe fallback to stored data with comprehensive error handling
          try {
            const storedUserData = await safeAsyncStorage.getItem('userData');
            if (storedUserData && typeof storedUserData === 'string' && storedUserData.trim().length > 0) {
              try {
                const parsedUser = JSON.parse(storedUserData);
                const normalized = pickUser(parsedUser);
                if (normalized?.id) {
                  setUser(normalized);
                  // Always log storage fallback after API error for production debugging
                  console.log('✅ User set from storage fallback after API error');
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

        if (signal?.aborted || !isMountedRef.current) return;
        
        if (isMountedRef.current) {
          setIsInitialized(true);
        }
      } catch (e) {
        console.error('Auth initialization failed:', e);
        if (isMountedRef.current) {
          setIsInitialized(true);
        }
      } finally {
        if (initTimeout) clearTimeout(initTimeout);
        if (isMountedRef.current) {
          setLoading(false);
        }
        // Clear the initialization reference
        initializationRef.current = null;
      }
    })();

    // Store the promise to prevent concurrent initializations
    initializationRef.current = initPromise;
    return initPromise;
  }, [clearStoredToken]);

  // ✅ SAFER: Race condition prevention in handleLoginSuccess
  const handleLoginSuccess = useCallback(async (u) => {
    // Prevent multiple concurrent logins
    if (loginRef.current) {
      console.log('🔄 Login already in progress, waiting...');
      return loginRef.current;
    }

    const loginPromise = (async () => {
      try {
        if (!isMountedRef.current) return;
        
        const nextUser = pickUser(u);
        
        // Set token with error handling
        try {
          if (nextUser?.token || nextUser?.authToken) {
            const tokenToSet = nextUser.token || nextUser.authToken;
            if (ApiService?.setToken) {
              await ApiService.setToken(tokenToSet);
            }
            if (ApiService?.ready) {
              await Promise.race([
                ApiService.ready,
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('ApiService.ready timeout')), 3000)
                )
              ]);
            }
          }
        } catch (error) {
          console.warn('Token setup failed:', error);
        }
        
        if (!isMountedRef.current) return;
        
        // Update user state
        setUser(nextUser);
        
        // Save to storage with error handling
        try {
          await Promise.all([
            safeAsyncStorage.setItem('isLoggedIn', 'true'),
            safeAsyncStorage.setItem('userData', JSON.stringify(nextUser))
          ]);
        } catch (error) {
          console.warn('Failed to save user data:', error);
        }
      } finally {
        loginRef.current = null;
      }
    })();

    loginRef.current = loginPromise;
    return loginPromise;
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
      await safeAsyncStorage.setItem('isLoggedIn', 'true');
      await safeAsyncStorage.setItem('userData', JSON.stringify(nextUser));
    } catch (error) {
      console.warn('Failed to save user data:', error);
    }
  }, []);

  // ✅ SAFER: Race condition prevention in handleLogout
  const handleLogout = useCallback(async () => {
    // Prevent multiple concurrent logouts
    if (logoutRef.current) {
      console.log('🔄 Logout already in progress, waiting...');
      return logoutRef.current;
    }

    const logoutPromise = (async () => {
      try {
        if (!isMountedRef.current) return;
        
        // Clear API state
        try {
          if (ApiService?.logout) {
            await ApiService.logout();
          }
          if (ApiService?.clearToken) {
            await ApiService.clearToken();
          }
          if (ApiService?.setToken) {
            ApiService.setToken(null);
          }
        } catch (apiError) {
          console.warn('API logout failed:', apiError);
        }
        
        // Clear storage
        try {
          await Promise.all([
            safeAsyncStorage.removeItem('isLoggedIn'),
            safeAsyncStorage.removeItem('userData')
          ]);
        } catch (storageError) {
          console.warn('Storage cleanup failed:', storageError);
        }
        
        if (isMountedRef.current) {
          setUser(null);
        }
      } catch (error) {
        console.warn('Logout failed:', error);
        if (isMountedRef.current) {
          setUser(null);
        }
      } finally {
        logoutRef.current = null;
      }
    })();

    logoutRef.current = logoutPromise;
    return logoutPromise;
  }, []);

  const handleAccountDeleted = useCallback(async () => {
    try {
      await ApiService.clearToken?.();
      ApiService.setToken?.(null);
      const keysToRemove = ['isLoggedIn', 'userData'];
      await safeAsyncStorage.multiRemove(keysToRemove);
      setUser(null);
    } catch (error) {
      console.warn('Account deletion cleanup failed:', error);
      setUser(null);
    }
  }, []);

  // ✅ Cleanup effect to prevent race conditions on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Cancel any ongoing operations
      if (initializationRef.current) {
        console.log('🧹 Canceling ongoing initialization on unmount');
      }
      if (loginRef.current) {
        console.log('🧹 Canceling ongoing login on unmount');
      }
      if (logoutRef.current) {
        console.log('🧹 Canceling ongoing logout on unmount');
      }
      
      // Clear references
      initializationRef.current = null;
      loginRef.current = null;
      logoutRef.current = null;
    };
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
