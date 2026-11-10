// screens/ColorWheelScreen/styles.js
import { StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// The wheel sits inside a card (16px padding) inside a 12px screen gutter
export const WHEEL_SIZE = Math.min(screenWidth - 56, 360);

export const colorWheelColors = {
  text: '#1F2328',
  textSecondary: '#6B7280',
  borderLight: '#D9DEE3',
  borderDefault: '#E5E7EB',
  card: '#FFFFFF',
  pill: '#F3F4F6',
  pillOn: '#1F2328',
  primary: '#1F2328',
  iconPrimary: '#333',
  shadowColor: '#000',
};

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 12,
    paddingBottom: 32,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colorWheelColors.card,
    borderRadius: 24,
    padding: 16,
    shadowColor: colorWheelColors.shadowColor,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // Wheel
  wheelContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  // Compact tools row under the wheel
  toolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colorWheelColors.pill,
  },
  toolIconButton: {
    width: 38,
    height: 38,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  toolPillOn: {
    backgroundColor: colorWheelColors.pillOn,
  },
  toolPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colorWheelColors.text,
  },
  toolPillTextOn: {
    color: '#FFFFFF',
  },

  stepLabel: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colorWheelColors.text,
  },

  // 1. Pick a color
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colorWheelColors.borderDefault,
  },
  hexInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colorWheelColors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    textAlign: 'center',
    color: colorWheelColors.text,
    fontVariant: ['tabular-nums'],
  },

  // HSL inputs (HSLInputs.js)
  hslContainer: {
    flexDirection: 'row',
    marginTop: 10,
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
    color: colorWheelColors.textSecondary,
    marginBottom: 4,
  },
  hslInput: {
    borderWidth: 1,
    borderColor: colorWheelColors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: colorWheelColors.text,
  },

  // 2. Palette type dropdown
  dropdown: {
    height: 48,
    borderWidth: 1,
    borderColor: colorWheelColors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 16,
    color: colorWheelColors.text,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '75%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colorWheelColors.text,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sheetRowText: {
    fontSize: 16,
    color: colorWheelColors.text,
  },
  sheetRowTextOn: {
    fontWeight: '700',
  },
  sheetRowHint: {
    fontSize: 12,
    color: colorWheelColors.textSecondary,
    marginTop: 2,
  },

  // Palette bar
  paletteBar: {
    flexDirection: 'row',
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 12,
  },
  paletteSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteActiveRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  paletteHexRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  paletteHex: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: colorWheelColors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: colorWheelColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colorWheelColors.borderLight,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: colorWheelColors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  photoLabel: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colorWheelColors.text,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
