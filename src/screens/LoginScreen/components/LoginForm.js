// LoginForm.js
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { optimizedStyles as styles, optimizedColors } from '../styles';

// Better blur intensity for text readability against bright gradient
const BLUR_INTENSITY = Platform.OS === 'ios' ? 80 : 60; // Higher intensity for better text readability

// Blur container with better text readability
const BlurContainer = ({ intensity, style, children }) => {
  return (
    <BlurView intensity={intensity} tint="light" style={style}>
      {/* Add semi-transparent overlay for better text readability */}
      <View style={{ 
        ...StyleSheet.absoluteFillObject, 
        backgroundColor: 'rgba(255,255,255,0.1)' 
      }} />
      {children}
    </BlurView>
  );
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
