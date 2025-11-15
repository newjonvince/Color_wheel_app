// styles.js (iOS-focused)
import { StyleSheet, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_SMALL = SCREEN_HEIGHT < 700;

export const optimizedColors = Object.freeze({
  gradientStart: '#ff4fb2', // pink
  gradientMid: '#24d39a',   // teal
  gradientEnd: '#2b4bff',   // blue
  buttonStart: '#FF2D87', // ✅ Hotter pink to match target
  buttonEnd: '#FF4757',   // ✅ More coral/red to match target
  surface: 'rgba(255,255,255,0.12)',
  surfaceBorder: 'rgba(255,255,255,0.22)',
  textPrimary: '#ffffff',
  placeholder: 'rgba(255,255,255,0.7)',
  accent: '#FF2D55',
  primary: '#ffffff',
  shadow: 'rgba(0,0,0,0.22)',
  errorBackground: 'rgba(255, 45, 85, 0.15)', // Semi-transparent red for error banner
});

const iosShadow = {
  shadowColor: optimizedColors.shadow,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.22,
  shadowRadius: 18,
};

export const optimizedStyles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1 },

  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingVertical: 24,
    justifyContent: 'flex-start',
  },

  header: {
    alignItems: 'center',
    paddingTop: IS_SMALL ? 36 : 56,
    paddingBottom: 12,
    minHeight: IS_SMALL ? 220 : 300,
  },

  logoContainer: {
    backgroundColor: '#FFD93D', // ✅ Yellow/gold background like target
    padding: 16, // Slightly more padding
    borderRadius: 24, // Rounder corners
    marginBottom: 16,
    // Add depth like the target
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
  },

  logoImage: {
    width: IS_SMALL ? 120 : 150, // ✅ Slightly larger to match target
    height: IS_SMALL ? 120 : 150,
  },

  title: {
    fontSize: IS_SMALL ? 34 : 40,
    fontWeight: '800', // iOS: SF Font weight
    color: optimizedColors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  subtitle: {
    fontSize: IS_SMALL ? 14 : 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },

  form: {
    marginTop: IS_SMALL ? 6 : 18,
  },

  // Input container is a tiny blurred card (we'll wrap TextInput in BlurView)
  inputWrap: {
    borderRadius: 14,
    marginVertical: 10,
    overflow: 'hidden', // clip blur
  },
  input: {
    backgroundColor: 'transparent', // actual background is BlurView
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: optimizedColors.textPrimary,
    borderRadius: 14,
  },
  inputOverlay: {
    backgroundColor: 'rgba(100, 220, 210, 0.25)', // ✅ Teal tint to match target
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)', // ✅ Subtle white border
    borderRadius: 16, // ✅ Match target's rounder corners
    ...iosShadow,
  },

  gradientWrapper: {
    borderRadius: 36,
    overflow: 'hidden',
    marginVertical: 18,
    marginTop: 26,
  },

  primaryButton: {
    paddingVertical: IS_SMALL ? 12 : 16,
    paddingHorizontal: 20,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...iosShadow,
  },

  primaryButtonText: {
    color: optimizedColors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },

  secondaryButton: {
    alignItems: 'center',
    marginTop: 12,
  },

  secondaryButtonText: {
    color: optimizedColors.textPrimary,
    fontSize: 16,
  },

  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },

  // Additional styles needed by components
  inputContainer: {
    marginVertical: 10,
  },

  inputError: {
    borderColor: optimizedColors.accent,
    borderWidth: 2,
  },

  inputFocused: {
    borderColor: optimizedColors.primary,
    borderWidth: 2,
  },

  passwordContainer: {
    position: 'relative',
  },

  passwordToggle: {
    position: 'absolute',
    right: 18,
    top: '50%',
    transform: [{ translateY: -10 }],
    paddingVertical: 4,
    paddingHorizontal: 4,
  },

  passwordToggleText: {
    color: optimizedColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  errorText: {
    color: optimizedColors.accent,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  activityIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityIndicatorText: {
    color: optimizedColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  errorBanner: {
    backgroundColor: optimizedColors.errorBackground,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  errorBannerText: {
    color: optimizedColors.textPrimary,
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },

  disabledButton: {
    opacity: 0.5,
  },

  disabledButtonText: {
    opacity: 0.7,
  },

  // Footer styles
  footerText: {
    color: optimizedColors.textPrimary,
    fontSize: 14,
  },
  signUpButton: {
    paddingHorizontal: 16,
    paddingVertical: 12, // Increased for 44px minimum touch target
    marginLeft: 6,
    borderRadius: 8,
    minHeight: 44, // Ensure minimum touch target
  },
  signUpText: {
    color: optimizedColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default { optimizedStyles, optimizedColors };
