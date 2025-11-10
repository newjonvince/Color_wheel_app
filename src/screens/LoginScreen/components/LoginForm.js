// screens/LoginScreen/components/LoginForm.js
import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { optimizedStyles as styles, optimizedColors } from '../styles';

export const LoginForm = React.memo(({ 
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
      {/* Email Input */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={emailRef}
          style={[
            styles.input,
            errors.email ? styles.inputError : null,
            focusedField === 'email' ? styles.inputFocused : null,
          ]}
          value={email}
          onChangeText={onEmailChange}
          onFocus={onEmailFocus}
          onBlur={onBlur}
          placeholder="Email"
          placeholderTextColor={optimizedColors.text.placeholder}
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
        {errors.email ? (
          <Text 
            style={styles.errorText}
            accessibilityRole="alert"
          >
            {errors.email}
          </Text>
        ) : null}
      </View>

      {/* Password Input */}
      <View style={styles.inputContainer}>
        <View style={styles.passwordContainer}>
          <TextInput
            ref={passwordRef}
            style={[
              styles.input,
              errors.password ? styles.inputError : null,
              focusedField === 'password' ? styles.inputFocused : null,
              { paddingRight: 70 }, // Make room for toggle button
            ]}
            value={password}
            onChangeText={onPasswordChange}
            onFocus={onPasswordFocus}
            onBlur={onBlur}
            placeholder="Password"
            placeholderTextColor={optimizedColors.text.placeholder}
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
            style={styles.passwordToggle}
            onPress={onTogglePassword}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            testID="password-toggle"
          >
            <Text style={styles.passwordToggleText}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>
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
