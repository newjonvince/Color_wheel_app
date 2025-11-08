// screens/LoginScreen/styles.js - Organized styles
import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#e60023',
  secondary: '#8A2BE2',
  background: '#D8C7DD',
  surface: '#F5F0F7',
  border: '#E8D5ED',
  text: {
    primary: '#333',
    secondary: '#666',
    white: '#fff',
  },
  error: '#d32f2f',
  success: '#2e7d32',
  disabled: 'rgba(0,0,0,0.6)',
};

export const styles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },

  // Header styles
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    minHeight: 300,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 40,
  },

  // Form styles
  form: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 400,
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  
  // Error message styles
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: 5,
    marginLeft: 20,
    fontWeight: '500',
  },
  
  // Password visibility toggle
  passwordContainer: {
    position: 'relative',
  },
  passwordToggle: {
    position: 'absolute',
    right: 20,
    top: 15,
    padding: 5,
  },
  passwordToggleText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Button styles
  loginButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: colors.text.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Loading indicator
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.text.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },

  // Divider styles
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 15,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },

  // Demo button styles
  demoButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  demoButtonText: {
    color: colors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Footer styles
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 20,
  },
  footerText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  signUpText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
  },
  signUpButton: {
    padding: 5,
  },

  // Accessibility styles
  accessibilityFocus: {
    borderColor: colors.primary,
    borderWidth: 3,
  },
  
  // Error banner styles
  errorBanner: {
    backgroundColor: colors.error,
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorBannerText: {
    color: colors.text.white,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginLeft: 10,
  },
  errorBannerIcon: {
    color: colors.text.white,
  },
});
