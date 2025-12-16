import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/safeApiService';
import { safeStorage } from '../utils/safeStorage';
import { safeApiCall } from '../utils/apiHelpers';

function UserSettingsScreen({ currentUser, onLogout, onAccountDeleted }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [shareDataEnabled, setShareDataEnabled] = useState(false);
  const [savingToggle, setSavingToggle] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load user settings from server on mount
  React.useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    setLoadingSettings(true);
    
    const result = await safeApiCall(
      () => ApiService.request('/users/preferences'),
      { 
        errorMessage: 'Failed to load user settings',
        showAlert: false // Don't show alert, just log error
      }
    );
    
    if (result.success) {
      // DEFENSIVE: Ensure preferences object exists and has expected shape
      const preferences = result.data?.preferences || {};
      setNotificationsEnabled(preferences.notifications_enabled ?? true);
      setShareDataEnabled(preferences.share_data_enabled ?? false);
    } else {
      console.error('Failed to load user settings:', result.error);
      // Keep defaults on error
    }
    
    setLoadingSettings(false);
  };

  // Optimistic UI update for settings with rollback on failure
  async function updateSetting(key, value) {
    const prev = key === 'notifications_enabled' ? notificationsEnabled : shareDataEnabled;
    
    // Optimistically update UI
    key === 'notifications_enabled' ? setNotificationsEnabled(value) : setShareDataEnabled(value);
    setSavingToggle(key);
    
    try {
      // Save to backend
      await ApiService.ready; // ensure token is loaded from SecureStore first
      await ApiService.updateSettings({ [key]: value });
    } catch (error) {
      console.error('Failed to save setting:', error);
      // Rollback on failure
      key === 'notifications_enabled' ? setNotificationsEnabled(prev) : setShareDataEnabled(prev);
      Alert.alert('Oops', 'Could not save your setting. Try again.');
    } finally {
      setSavingToggle(null);
    }
  }

  const handleDeleteAccount = async () => {
    // Prevent double submission
    if (isDeleting) return;
    
    // Validate confirmation text with trimming
    if (deleteConfirmationText.trim().toLowerCase() !== 'delete my account') {
      Alert.alert('Confirmation Required', 'Please type "delete my account" to confirm.');
      return;
    }

    setIsDeleting(true);
    try {
      // Call API to delete account
      await ApiService.ready; // ensure token is loaded from SecureStore first
      await ApiService.deleteAccount();
      
      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: async () => {
              setShowDeleteConfirmation(false);
              // SAFETY: Secure account deletion with error handling
              try {
                // Clear all auth data after successful account deletion
                await safeStorage.clearAuth();
                await ApiService.logout();
                
                // Call the callback to update UI
                if (onAccountDeleted && typeof onAccountDeleted === 'function') {
                  onAccountDeleted();
                }
              } catch (error) {
                console.error('Secure account deletion cleanup failed:', error);
                // Fallback to direct callback if secure cleanup fails
                if (onAccountDeleted && typeof onAccountDeleted === 'function') {
                  onAccountDeleted();
                }
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert(
        'Error',
        'Failed to delete account. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const showDeleteAccountConfirmation = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and will remove:\n\n• Your profile and preferences\n• All saved color matches and boards\n• Your community posts and likes\n• All app data associated with your account',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => setShowDeleteConfirmation(true)
        }
      ]
    );
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      await ApiService.ready; // ensure token is loaded from SecureStore first
      await ApiService.requestDataExport();
      Alert.alert(
        'Export Requested', 
        'We\'ll email you a download link within 24 hours.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Data export error:', error);
      Alert.alert('Error', 'Failed to request data export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Manage your account and preferences</Text>
      </View>

      {/* User Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.userInitial}>
              {currentUser?.name?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{currentUser?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{currentUser?.email}</Text>
          </View>
        </View>
      </View>

      {/* Privacy & Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Data</Text>
        
        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={handleExportData}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel="Export my data - request a download of all your account data"
        >
          <View style={styles.settingLeft}>
            <Ionicons name="download-outline" size={20} color="#666" />
            <Text style={styles.settingText}>Export My Data</Text>
            {exporting && (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginLeft: 8 }} />
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <View 
          style={styles.settingItem}
          accessibilityRole="switch"
          accessibilityLabel="Push notifications toggle"
        >
          <View style={styles.settingLeft}>
            <Ionicons name="notifications-outline" size={20} color="#666" />
            <Text style={styles.settingText}>Push Notifications</Text>
            {(savingToggle === 'notifications_enabled' || loadingSettings) && (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginLeft: 8 }} />
            )}
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={(v) => updateSetting('notifications_enabled', v)}
            disabled={savingToggle === 'notifications_enabled' || loadingSettings}
          />
        </View>

        <View 
          style={styles.settingItem}
          accessibilityRole="switch"
          accessibilityLabel="Share usage data toggle"
        >
          <View style={styles.settingLeft}>
            <Ionicons name="analytics-outline" size={20} color="#666" />
            <Text style={styles.settingText}>Share Usage Data</Text>
            {(savingToggle === 'share_data_enabled' || loadingSettings) && (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginLeft: 8 }} />
            )}
          </View>
          <Switch
            value={shareDataEnabled}
            onValueChange={(v) => updateSetting('share_data_enabled', v)}
            disabled={savingToggle === 'share_data_enabled' || loadingSettings}
          />
        </View>
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="help-circle-outline" size={20} color="#666" />
            <Text style={styles.settingText}>Help & FAQ</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="mail-outline" size={20} color="#666" />
            <Text style={styles.settingText}>Contact Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="document-text-outline" size={20} color="#666" />
            <Text style={styles.settingText}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="document-outline" size={20} color="#666" />
            <Text style={styles.settingText}>Terms of Service</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Actions</Text>
        
        <TouchableOpacity
          style={styles.settingItem}
          onPress={async () => {
            // SAFETY: Secure logout with error handling
            try {
              // Use ApiService's built-in logout method
              await ApiService.logout();
              
              // Call the callback to update UI
              if (onLogout && typeof onLogout === 'function') {
                onLogout();
              }
            } catch (error) {
              console.error('Secure logout failed:', error);
              // Fallback to direct callback if secure logout fails
              if (onLogout && typeof onLogout === 'function') {
                onLogout();
              }
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign out of your account"
        >
          <View style={styles.settingLeft}>
            <Ionicons name="log-out-outline" size={20} color="#666" />
            <Text style={styles.settingText}>Sign Out</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingItem, styles.dangerItem]} 
          onPress={showDeleteAccountConfirmation}
          accessibilityRole="button"
          accessibilityLabel="Permanently delete account - this action cannot be undone"
        >
          <View style={styles.settingLeft}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={[styles.settingText, styles.dangerText]}>Delete Account</Text>
          </View>
          <Ionicons name="alert-circle-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteConfirmation}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'fullScreen'}
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowDeleteConfirmation(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <View style={styles.modalCloseButton} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.warningContainer}>
              <Ionicons name="warning" size={48} color="#FF3B30" />
              <Text style={styles.warningTitle}>This action is permanent</Text>
              <Text style={styles.warningText}>
                Deleting your account will permanently remove all your data including:
              </Text>
            </View>

            <View style={styles.dataList}>
              <Text style={styles.dataItem}>• Your profile and account information</Text>
              <Text style={styles.dataItem}>• All saved color matches and palettes</Text>
              <Text style={styles.dataItem}>• Your personal boards and collections</Text>
              <Text style={styles.dataItem}>• Community posts and interactions</Text>
              <Text style={styles.dataItem}>• App preferences and settings</Text>
            </View>

            <Text style={styles.confirmationLabel}>
              To confirm, type "delete my account" below:
            </Text>
            
            <TextInput
              style={styles.confirmationInput}
              value={deleteConfirmationText}
              onChangeText={setDeleteConfirmationText}
              placeholder="delete my account"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[
                styles.deleteButton,
                deleteConfirmationText.toLowerCase() !== 'delete my account' && styles.deleteButtonDisabled
              ]}
              onPress={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmationText.toLowerCase() !== 'delete my account'}
            >
              {isDeleting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.deleteButtonText}>Permanently Delete Account</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  dangerItem: {
    borderBottomColor: '#FFE5E5',
  },
  dangerText: {
    color: '#FF3B30',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    width: 60,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  warningContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginTop: 15,
    marginBottom: 10,
  },
  warningText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  dataList: {
    backgroundColor: '#f8f8f8',
    padding: 20,
    borderRadius: 10,
    marginVertical: 20,
  },
  dataItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  confirmationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  confirmationInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 30,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
  },
  deleteButtonDisabled: {
    backgroundColor: '#ccc',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UserSettingsScreen;
