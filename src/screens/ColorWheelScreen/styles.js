// screens/ColorWheelScreen/styles.js - Organized styles
import { StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export const WHEEL_SIZE = Math.min(screenWidth * 0.92, 380);

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 24,
  },
  
  // Scheme Selector Styles
  schemeContainer: {
    width: '92%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  schemeButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  schemeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  schemeButtonActive: {
    borderColor: '#0d47a1',
    backgroundColor: '#E3F2FD',
  },
  schemeButtonInactive: {
    borderColor: '#bbb',
    backgroundColor: '#fff',
  },
  schemeButtonText: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  selectedColorPreview: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  // Color Wheel Styles
  wheelContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  cameraButtonsContainer: {
    position: 'absolute',
    bottom: -20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cameraButton: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cameraButtonSpacing: {
    marginRight: 20,
  },

  // Controls Styles
  controlsContainer: {
    width: '92%',
    maxWidth: 520,
    marginTop: 28,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  linkedButtonActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#2e7d32',
  },
  linkedButtonInactive: {
    backgroundColor: '#ffebee',
    borderColor: '#c62828',
  },
  followsActiveButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  followsActiveButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1565c0',
  },
  followsActiveButtonInactive: {
    backgroundColor: '#fff3e0',
    borderColor: '#ef6c00',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginLeft: 8,
    marginRight: 8,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#999',
  },
  actionButtonSpacing: {
    marginRight: 8,
  },
  buttonText: {
    fontWeight: '600',
  },

  // HSL Input Styles
  hslContainer: {
    flexDirection: 'row',
    marginTop: 10,
    marginLeft: 8,
    marginRight: 8,
  },
  hslInputContainer: {
    flex: 1,
  },
  hslInputSpacing: {
    marginRight: 4,
  },
  hslInputSpacingCenter: {
    marginLeft: 4,
    marginRight: 4,
  },
  hslInputSpacingLeft: {
    marginLeft: 4,
  },
  hslLabel: {
    fontSize: 12,
    color: '#555',
  },
  hslInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  // Swatches Styles
  swatchesContainer: {
    width: '92%',
    maxWidth: 520,
    marginTop: 16,
  },
  swatchTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  selectedColorSwatch: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  schemeSwatchesContainer: {
    flexDirection: 'row',
  },
  schemeSwatch: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  schemeSwatchActive: {
    opacity: 1,
  },
  schemeSwatchInactive: {
    opacity: 0.95,
  },
  schemeSwatchSpacing: {
    marginRight: 8,
  },
});
