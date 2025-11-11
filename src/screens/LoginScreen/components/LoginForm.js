// LoginForm.js
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { optimizedStyles as styles, optimizedColors } from '../styles';

// Performance-aware blur intensity based on device capabilities
const getBlurIntensity = () => {
  // Use lower intensity on older iOS devices for better performance
  if (Platform.OS === 'ios') {
    // iOS 14+ can handle higher intensity better
    const iosVersion = parseInt(Platform.Version, 10);
    return iosVersion >= 14 ? 60 : 20;
  }
  // Android or other platforms use moderate intensity
  return 40;
};

const BLUR_INTENSITY = getBlurIntensity();

// Low-end blur fallback helper
const BlurContainer = ({ intensity, style, children, lowEndFallback = false }) => {
  if (lowEndFallback) {
    return <View style={[{ backgroundColor: 'rgba(255,255,255,0.06)' }, style]}>{children}</View>;
  }
  return <BlurView intensity={intensity} tint="light" style={style}>{children}</BlurView>;
};

const LoginForm = React.memo(({ 
  email,
  password,
  showPassword,
  errors,
  focusedField,
  emailRef,
  passwordRef,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onEmailFocus,
  onPasswordFocus,
  onBlur,
  onFocusNext,
  onSubmit,
}) => {
  return (
    <>
      {/* Email */}
      <View style={styles.inputWrap}>
        <BlurContainer intensity={BLUR_INTENSITY} style={styles.inputOverlay}>
          <TextInput
            ref={emailRef}
            placeholder="Email"
            placeholderTextColor={optimizedColors.placeholder}
            style={[
              styles.input,
              errors.email ? styles.inputError : null,
              focusedField === 'email' ? styles.inputFocused : null,
            ]}
            value={email}
            onChangeText={onEmailChange}
            onFocus={onEmailFocus}
            onBlur={onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={onFocusNext}
            accessibilityLabel="Email input"
            accessibilityHint="Enter your email address"
            testID="email-input"
            blurOnSubmit={false}
          />
        </BlurContainer>
        {errors.email ? (
          <Text 
            style={styles.errorText}
            accessibilityRole="alert"
          >
            {errors.email}
          </Text>
        ) : null}
      </View>

      {/* Password with right-hand "Show" control */}
      <View style={styles.inputWrap}>
        <BlurContainer intensity={BLUR_INTENSITY} style={styles.inputOverlay}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              ref={passwordRef}
              placeholder="Password"
              placeholderTextColor={optimizedColors.placeholder}
              style={[
                styles.input,
                { flex: 1 },
                errors.password ? styles.inputError : null,
                focusedField === 'password' ? styles.inputFocused : null,
              ]}
              value={password}
              onChangeText={onPasswordChange}
              onFocus={onPasswordFocus}
              onBlur={onBlur}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              accessibilityLabel="Password input"
              accessibilityHint="Enter your password"
              testID="password-input"
            />
            <TouchableOpacity 
              onPress={onTogglePassword} 
              style={{ paddingHorizontal: 16 }}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              testID="password-toggle"
            >
              <Text style={{ color: optimizedColors.textPrimary, fontWeight: '600' }}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>
        </BlurContainer>
        {errors.password ? (
          <Text 
            style={styles.errorText}
            accessibilityRole="alert"
          >
            {errors.password}
          </Text>
        ) : null}
      </View>
    </>
  );
});

// Default export
export default LoginForm;

// Named export for backward compatibility
export { LoginForm };
