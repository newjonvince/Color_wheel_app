// utils/ImagePickerUtils.js - Enhanced image picker with comprehensive permission handling
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

/**
 * Enhanced image picker with comprehensive permission handling and user-friendly error messages
 */
export class ImagePickerUtils {
  
  /**
   * Request camera permissions with user-friendly messaging
   */
  static async requestCameraPermissions() {
    try {
      // Check if ImagePicker is available
      if (!ImagePicker || typeof ImagePicker.requestCameraPermissionsAsync !== 'function') {
        throw new Error('Camera functionality not available on this device');
      }

      const result = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!result.granted) {
        Alert.alert(
          'Camera Permission Required',
          'We need camera access to help you extract colors from photos. You can enable this in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => Linking.openSettings().catch(() => {
                Alert.alert('Unable to open settings', 'Please open your device settings manually and enable camera access for this app.');
              })
            }
          ]
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('🚨 Camera permission error:', error);
      Alert.alert(
        'Camera Error',
        'Unable to access camera permissions. Please check your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  /**
   * Request media library permissions with user-friendly messaging
   */
  static async requestMediaLibraryPermissions() {
    try {
      // Check if ImagePicker is available
      if (!ImagePicker || typeof ImagePicker.requestMediaLibraryPermissionsAsync !== 'function') {
        throw new Error('Photo library functionality not available on this device');
      }

      const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!result.granted) {
        Alert.alert(
          'Photo Library Permission Required',
          'We need access to your photo library to help you extract colors from your images. You can enable this in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => Linking.openSettings().catch(() => {
                Alert.alert('Unable to open settings', 'Please open your device settings manually and enable photo library access for this app.');
              })
            }
          ]
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('🚨 Media library permission error:', error);
      Alert.alert(
        'Photo Library Error',
        'Unable to access photo library permissions. Please check your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  /**
   * Launch camera with comprehensive error handling
   */
  static async launchCamera(options = {}) {
    try {
      // Request permissions first
      const hasPermission = await this.requestCameraPermissions();
      if (!hasPermission) {
        return { canceled: true, error: 'Permission denied' };
      }

      // Validate ImagePicker functionality
      if (!ImagePicker.launchCameraAsync || typeof ImagePicker.launchCameraAsync !== 'function') {
        throw new Error('Camera functionality not available');
      }

      const defaultOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'Images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        exif: false,
      };

      const result = await ImagePicker.launchCameraAsync({
        ...defaultOptions,
        ...options
      });

      // Validate result structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid camera result');
      }

      if (result.canceled) {
        return { canceled: true };
      }

      // Validate assets array
      if (!Array.isArray(result.assets) || result.assets.length === 0) {
        throw new Error('No image captured');
      }

      const asset = result.assets[0];
      if (!asset || !asset.uri || typeof asset.uri !== 'string' || asset.uri.length === 0) {
        throw new Error('Invalid image data');
      }

      return { 
        canceled: false, 
        asset: {
          uri: asset.uri,
          width: asset.width || 0,
          height: asset.height || 0,
          type: asset.type || 'image',
        }
      };

    } catch (error) {
      console.error('🚨 Camera launch error:', error);
      
      Alert.alert(
        'Camera Error',
        'Unable to take a photo. Please try again or use the photo library instead.',
        [{ text: 'OK' }]
      );
      
      return { canceled: true, error: error.message };
    }
  }

  /**
   * Launch image library with comprehensive error handling
   */
  static async launchImageLibrary(options = {}) {
    try {
      // Request permissions first
      const hasPermission = await this.requestMediaLibraryPermissions();
      if (!hasPermission) {
        return { canceled: true, error: 'Permission denied' };
      }

      // Validate ImagePicker functionality
      if (!ImagePicker.launchImageLibraryAsync || typeof ImagePicker.launchImageLibraryAsync !== 'function') {
        throw new Error('Photo library functionality not available');
      }

      const defaultOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'Images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        exif: false,
      };

      const result = await ImagePicker.launchImageLibraryAsync({
        ...defaultOptions,
        ...options
      });

      // Validate result structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid library result');
      }

      if (result.canceled) {
        return { canceled: true };
      }

      // Validate assets array
      if (!Array.isArray(result.assets) || result.assets.length === 0) {
        throw new Error('No image selected');
      }

      const asset = result.assets[0];
      if (!asset || !asset.uri || typeof asset.uri !== 'string' || asset.uri.length === 0) {
        throw new Error('Invalid image data');
      }

      return { 
        canceled: false, 
        asset: {
          uri: asset.uri,
          width: asset.width || 0,
          height: asset.height || 0,
          type: asset.type || 'image',
        }
      };

    } catch (error) {
      console.error('🚨 Image library launch error:', error);
      
      Alert.alert(
        'Photo Library Error',
        'Unable to access your photo library. Please try again or take a new photo instead.',
        [{ text: 'OK' }]
      );
      
      return { canceled: true, error: error.message };
    }
  }

  /**
   * Show image picker options with user-friendly interface
   */
  static showImagePickerOptions(onImageSelected, onCancel) {
    Alert.alert(
      'Select Image',
      'Choose how you\'d like to add an image for color extraction:',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const result = await this.launchCamera();
            if (!result.canceled && result.asset) {
              onImageSelected?.(result.asset);
            } else if (result.error) {
              onCancel?.(result.error);
            }
          }
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const result = await this.launchImageLibrary();
            if (!result.canceled && result.asset) {
              onImageSelected?.(result.asset);
            } else if (result.error) {
              onCancel?.(result.error);
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: onCancel
        }
      ]
    );
  }
}

export default ImagePickerUtils;
