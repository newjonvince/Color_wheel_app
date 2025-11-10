// screens/LoginScreen/components/LoginFooter.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { optimizedStyles as styles } from '../styles';

export const LoginFooter = React.memo(({ onSignUpPress }) => {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Don't have an account? </Text>
      <TouchableOpacity 
        onPress={onSignUpPress}
        style={styles.signUpButton}
        accessibilityRole="button"
        accessibilityLabel="Sign up for a new account"
        testID="signup-button"
      >
        <Text style={styles.signUpText}>Sign up</Text>
      </TouchableOpacity>
    </View>
  );
});
