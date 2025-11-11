// hooks/useNetworkStatus.js - React Native network status hook using NetInfo
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Custom hook for network status monitoring using NetInfo
 * Provides reliable network state across all React Native platforms
 * 
 * @returns {Object} Network status object
 * @returns {boolean} isConnected - Whether device is connected to internet
 * @returns {boolean} isInternetReachable - Whether internet is actually reachable
 * @returns {string} connectionType - Type of connection (wifi, cellular, etc.)
 * @returns {boolean} isLoading - Whether initial network state is still loading
 */
export const useNetworkStatus = () => {
  const [networkState, setNetworkState] = useState({
    isConnected: true, // Assume connected initially to avoid false negatives
    isInternetReachable: true,
    connectionType: 'unknown',
    isLoading: true,
  });

  useEffect(() => {
    // Get initial network state
    const getInitialState = async () => {
      try {
        const state = await NetInfo.fetch();
        setNetworkState({
          isConnected: state.isConnected ?? true,
          isInternetReachable: state.isInternetReachable ?? true,
          connectionType: state.type || 'unknown',
          isLoading: false,
        });
      } catch (error) {
        console.warn('Failed to fetch initial network state:', error);
        // Fallback to assuming connected
        setNetworkState(prev => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    getInitialState();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
        connectionType: state.type || 'unknown',
        isLoading: false,
      });
    });

    // Cleanup subscription
    return () => {
      unsubscribe();
    };
  }, []);

  return networkState;
};

/**
 * Simple hook that just returns whether the device is offline
 * Useful for quick offline checks in error handling
 * 
 * @returns {boolean} Whether device is offline
 */
export const useIsOffline = () => {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  
  // Consider offline if not connected OR internet not reachable
  return !isConnected || isInternetReachable === false;
};

/**
 * Utility function to check network status without hooks
 * Useful for one-time checks in error handlers or utility functions
 * 
 * @returns {Promise<Object>} Network state object
 */
export const getNetworkStatus = async () => {
  try {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected ?? true,
      isInternetReachable: state.isInternetReachable ?? true,
      connectionType: state.type || 'unknown',
      isOffline: !state.isConnected || state.isInternetReachable === false,
    };
  } catch (error) {
    console.warn('Failed to fetch network status:', error);
    // Fallback to assuming connected to avoid false negatives
    return {
      isConnected: true,
      isInternetReachable: true,
      connectionType: 'unknown',
      isOffline: false,
    };
  }
};

export default useNetworkStatus;
