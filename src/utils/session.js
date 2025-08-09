import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Wipes all local session data securely
 * Removes both AsyncStorage and SecureStore data
 */
export async function wipeLocalSession() {
  try {
    await Promise.all([
      // Remove AsyncStorage items
      AsyncStorage.multiRemove(['userData', 'isLoggedIn']),
      // Remove SecureStore token (catch errors if key doesn't exist)
      SecureStore.deleteItemAsync('authToken').catch(() => {}),
    ]);
    console.log('✅ Local session wiped successfully');
  } catch (error) {
    console.error('❌ Error wiping local session:', error);
    // Still try to remove items individually if batch fails
    try {
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('isLoggedIn');
      await SecureStore.deleteItemAsync('authToken').catch(() => {});
    } catch (fallbackError) {
      console.error('❌ Fallback session wipe also failed:', fallbackError);
    }
  }
}

/**
 * Performs a complete secure logout
 * Calls API logout, wipes local session, and executes callback
 */
export async function performSecureLogout(apiService, onLogout) {
  try {
    // Try to call API logout (don't fail if this fails)
    if (apiService?.logout) {
      try {
        await apiService.logout();
      } catch (apiError) {
        console.warn('⚠️ API logout failed, continuing with local logout:', apiError);
      }
    }

    // Always wipe local session
    await wipeLocalSession();

    // Execute callback if provided
    if (onLogout && typeof onLogout === 'function') {
      onLogout();
    }

    console.log('✅ Secure logout completed');
  } catch (error) {
    console.error('❌ Error during secure logout:', error);
    // Still execute callback even if there were errors
    if (onLogout && typeof onLogout === 'function') {
      onLogout();
    }
  }
}

/**
 * Performs secure account deletion cleanup
 * Wipes local session and executes callback after successful deletion
 */
export async function performSecureAccountDeletion(onAccountDeleted) {
  try {
    // Wipe local session after successful account deletion
    await wipeLocalSession();

    // Execute callback if provided
    if (onAccountDeleted && typeof onAccountDeleted === 'function') {
      onAccountDeleted();
    }

    console.log('✅ Secure account deletion cleanup completed');
  } catch (error) {
    console.error('❌ Error during account deletion cleanup:', error);
    // Still execute callback even if there were errors
    if (onAccountDeleted && typeof onAccountDeleted === 'function') {
      onAccountDeleted();
    }
  }
}
