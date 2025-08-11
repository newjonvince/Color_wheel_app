import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService, { login as directLogin } from '../services/api';

export default function LoginScreen({ onLoginSuccess, onSignUpPress }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const saveSession = useCallback(async ({ user, token }) => {
    // Persist only non-sensitive user profile in AsyncStorage
    await AsyncStorage.setItem('userData', JSON.stringify(user));
    await AsyncStorage.setItem('isLoggedIn', 'true');
    // Store token securely
    if (token) await SecureStore.setItemAsync('authToken', token, { keychainService: 'fashioncolorwheel.auth' });
  }, []);

  const validate = () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password');
      return false;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password should be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleLogin = useCallback(async () => {
    if (!validate()) return;
    if (loading) return; // guard against rapid taps
    setLoading(true);
    
    // Debug logging to identify the issue
    console.log('🔍 Debug - ApiService:', ApiService);
    console.log('🔍 Debug - ApiService.login:', ApiService.login);
    console.log('🔍 Debug - typeof ApiService.login:', typeof ApiService.login);
    
    try {
      let response;
      
      // Try ApiService.login first, fallback to direct import
      if (typeof ApiService.login === 'function') {
        console.log('✅ Using ApiService.login');
        response = await ApiService.login(email.trim(), password);
      } else if (typeof directLogin === 'function') {
        console.log('⚠️ ApiService.login not available, using direct import');
        response = await directLogin(email.trim(), password);
      } else {
        throw new Error('No login function available. Both ApiService.login and directLogin are undefined.');
      }
      if (response?.success && response?.user) {
        await saveSession({ user: response.user, token: response.token });
        onLoginSuccess?.(response.user);
      } else {
        const msg = response?.message || 'Invalid email or password.';
        Alert.alert('Login Failed', msg);
      }
    } catch (err) {
      console.error('Login error:', err);
      console.error('Error details:', {
        name: err?.name,
        message: err?.message,
        stack: err?.stack
      });
      
      const msg =
        (err?.name === 'TypeError' && /Network/i.test(String(err))) ? 
          'Unable to reach the server. Check your internet connection and try again.' :
        err?.message || 'Something went wrong. Please try again.';
      Alert.alert('Login Error', msg);
    } finally {
      setLoading(false);
    }
  }, [email, password, loading, saveSession, onLoginSuccess]);

  const handleDemoLogin = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Try server-controlled demo login first
      try {
        if (ApiService.demoLogin && typeof ApiService.demoLogin === 'function') {
          const response = await ApiService.demoLogin();
          if (response?.success && response?.user) {
            await saveSession({ user: response.user, token: response.token });
            onLoginSuccess?.(response.user);
            return;
          }
        }
      } catch (serverError) {
        console.log('Server demo login failed, using local fallback:', serverError.message);
      }
      
      // Local demo user fallback
      const demoUser = {
        id: 'demo-user',
        email: 'demo@fashioncolorwheel.com',
        username: 'demo_user',
        location: 'United States',
        birthday: { month: 'January', day: '1', year: '1990' },
        gender: 'Prefer not to say',
        isLoggedIn: true,
        createdAt: new Date().toISOString(),
        demo: true,
      };
      await AsyncStorage.setItem('userData', JSON.stringify(demoUser));
      await AsyncStorage.setItem('isLoggedIn', 'true');
      onLoginSuccess?.(demoUser);
    } catch (err) {
      console.error('Demo login error:', err);
      const demoUser = {
        id: 'demo-user',
        email: 'demo@fashioncolorwheel.com',
        username: 'demo_user',
        location: 'United States',
        birthday: { month: 'January', day: '1', year: '1990' },
        gender: 'Prefer not to say',
        isLoggedIn: true,
        createdAt: new Date().toISOString(),
        demo: true,
      };
      await AsyncStorage.setItem('userData', JSON.stringify(demoUser));
      await AsyncStorage.setItem('isLoggedIn', 'true');
      onLoginSuccess?.(demoUser);
    } finally {
      setLoading(false);
    }
  }, [loading, saveSession, onLoginSuccess]);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/icon.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Fashion Color Wheel</Text>
        <Text style={styles.subtitle}>Discover perfect color combinations</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => { /* focus password input via ref if desired */ }}
          accessibilityLabel="Email input"
          testID="email-input"
        />

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
          accessibilityLabel="Password input"
          testID="password-input"
        />

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Log in"
          testID="login-button"
        >
          {loading ? <ActivityIndicator /> : <Text style={styles.loginButtonText}>Log in</Text>}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.demoButton}
          onPress={handleDemoLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Try Demo Account"
          testID="demo-button"
        >
          <Text style={styles.demoButtonText}>Try Demo Account</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={onSignUpPress} accessibilityRole="button" accessibilityLabel="Sign up">
          <Text style={styles.signUpText}>Sign up</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#D8C7DD', paddingHorizontal: 20 },
  header: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
  form: { flex: 1, justifyContent: 'center' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 15,
    fontSize: 16, backgroundColor: '#f9f9f9', marginBottom: 15,
  },
  loginButton: { backgroundColor: '#e60023', paddingVertical: 18, borderRadius: 25, alignItems: 'center', marginTop: 10 },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 15, color: '#666', fontSize: 14 },
  demoButton: { backgroundColor: '#f9f9f9', paddingVertical: 18, borderRadius: 25, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  demoButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 40 },
  footerText: { fontSize: 16, color: '#666' },
  signUpText: { fontSize: 16, color: '#e60023', fontWeight: 'bold' },
});
