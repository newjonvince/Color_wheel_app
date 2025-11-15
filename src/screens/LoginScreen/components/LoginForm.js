// LoginForm.js
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { optimizedStyles as styles, optimizedColors } from '../styles';

// ✅ Match the target design - solid translucent backgrounds instead of blur
const InputContainer = ({ style, children }) => {
  return (
    <View style={[{
      backgroundColor: 'rgba(100, 220, 210, 0.25)', // Teal/cyan tint
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)', // Subtle white border
      ...Platform.select({
        ios: {
          shadowColor: 'rgba(0, 0, 0, 0.15)',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 12,
        },
        android: {
          elevation: 4,
        }
      })
    }, style]}>
      {children}
    </View>
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
        <InputContainer style={styles.inputOverlay}>
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
            accessibilityRequired={true} // ✅ Mark as required field
            accessibilityInvalid={!!errors.email} // ✅ Indicate validation state
            testID="email-input"
            blurOnSubmit={false}
          />
        </InputContainer>
        {errors.email ? (
          <Text 
            style={styles.errorText}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite" // ✅ Announce field errors to screen readers
          >
            {errors.email}
          </Text>
        ) : null}
      </View>

      {/* Password with right-hand "Show" control */}
      <View style={styles.inputWrap}>
        <InputContainer style={styles.inputOverlay}>
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
              accessibilityRequired={true} // ✅ Mark as required field
              accessibilityInvalid={!!errors.password} // ✅ Indicate validation state
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
        </InputContainer>
        {errors.password ? (
          <Text 
            style={styles.errorText}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite" // ✅ Announce field errors to screen readers
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
