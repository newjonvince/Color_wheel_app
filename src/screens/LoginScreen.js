import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function LoginScreen({ onLoginSuccess, onSignUpPress }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const saveSession = useCallback(async ({ user, token }) => {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      await AsyncStorage.setItem('isLoggedIn', 'true');
      if (token) {
        await SecureStore.setItemAsync('authToken', token, { keychainService: 'fashioncolorwheel.auth' });
        ApiService.setToken(token); // keep axios authorized for subsequent calls
      }
    } catch (e) {
      console.warn('Failed to persist session:', e?.message);
    }
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
    if (!validate() || loading) return;
    setLoading(true);

    try {
      const response = await ApiService.login(email.trim(), password);

      // Accept common backend shapes
      const user = response?.user || response?.data?.user;
      const token = response?.token || response?.data?.token || response?.accessToken;

      if (!user || !token) {
        const msg = response?.message || 'Server did not return user/token.';
        Alert.alert('Login Failed', msg);
        return;
      }

      await saveSession({ user, token });
      onLoginSuccess?.(user);
    } catch (err) {
      console.error('Login error:', err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Something went wrong. Please try again.';
      Alert.alert('Login Error', msg);
    } finally {
      setLoading(false);
    }
  }, [email, password, loading, saveSession, onLoginSuccess]);

  const handleDemoLogin = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    
    console.log('🔍 LoginScreen: Demo login started...');
    
    try {
      console.log('🔍 LoginScreen: Calling ApiService.demoLogin()...');
      const response = await ApiService.demoLogin();
      console.log('🔍 LoginScreen: Demo login response received:', response);
      
      const user = response?.user;
      const token = response?.token;
      
      console.log('🔍 LoginScreen: Extracted user:', user);
      console.log('🔍 LoginScreen: Extracted token:', !!token);
      
      if (user && token) {
        console.log('🔍 LoginScreen: Saving session...');
        await saveSession({ user, token });
        console.log('🔍 LoginScreen: Session saved, calling onLoginSuccess...');
        onLoginSuccess?.(user);
        console.log('🔍 LoginScreen: onLoginSuccess called successfully');
      } else {
        // Local fallback if backend demo login fails
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
      }
    } catch (err) {
      console.error('Demo login error:', err);
      // Fallback to local demo if backend fails
      try {
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
      } catch (fallbackErr) {
        console.error('Demo fallback error:', fallbackErr);
        Alert.alert('Demo Login Error', 'Failed to start demo. Please try again.');
      }
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
  header: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, backgroundColor: '#D8C7DD' },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logoImage: { width: 120, height: 120, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
  form: { flex: 1, justifyContent: 'center', backgroundColor: '#D8C7DD' },
  input: { borderWidth: 1, borderColor: '#E8D5ED', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 15, fontSize: 16, backgroundColor: '#F5F0F7', marginBottom: 15 },
  loginButton: { backgroundColor: '#e60023', paddingVertical: 18, borderRadius: 25, alignItems: 'center', marginTop: 10 },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 15, color: '#666', fontSize: 14 },
  demoButton: { backgroundColor: '#8A2BE2', paddingVertical: 18, borderRadius: 25, alignItems: 'center', borderWidth: 1, borderColor: '#8A2BE2' },
  demoButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 40, backgroundColor: '#D8C7DD' },
  footerText: { fontSize: 16, color: '#666' },
  signUpText: { fontSize: 16, color: '#e60023', fontWeight: 'bold' },
});
