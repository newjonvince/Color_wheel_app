import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function LoginScreen({ onLoginSuccess, onSignUpPress }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      // Authenticate with backend API
      const response = await ApiService.login(email, password);
      
      if (response.success && response.user) {
        // Store user data locally for offline access
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.setItem('authToken', response.token);
        
        onLoginSuccess(response.user);
      } else {
        Alert.alert('Login Failed', response.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.message.includes('fetch')) {
        Alert.alert('Connection Error', 'Unable to connect to server. Please check your internet connection.');
      } else {
        Alert.alert('Login Error', error.message || 'Something went wrong. Please try again.');
      }
    }

    setLoading(false);
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    
    try {
      // Try to login with demo account from database
      const response = await ApiService.login('demo@fashioncolorwheel.com', 'demo123');
      
      if (response.success && response.user) {
        // Store user data locally
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.setItem('authToken', response.token);
        
        onLoginSuccess(response.user);
      } else {
        // Fallback to local demo user if database demo doesn't exist
        const demoUser = {
          id: 'demo-user',
          email: 'demo@fashioncolorwheel.com',
          username: 'demo_user',
          location: 'United States',
          birthday: { month: 'January', day: '1', year: '1990' },
          gender: 'Prefer not to say',
          isLoggedIn: true,
          createdAt: new Date().toISOString()
        };

        await AsyncStorage.setItem('userData', JSON.stringify(demoUser));
        await AsyncStorage.setItem('isLoggedIn', 'true');
        onLoginSuccess(demoUser);
      }
    } catch (error) {
      console.error('Demo login error:', error);
      // Fallback to offline demo user
      const demoUser = {
        id: 'demo-user',
        email: 'demo@fashioncolorwheel.com',
        username: 'demo_user',
        location: 'United States',
        birthday: { month: 'January', day: '1', year: '1990' },
        gender: 'Prefer not to say',
        isLoggedIn: true,
        createdAt: new Date().toISOString()
      };

      await AsyncStorage.setItem('userData', JSON.stringify(demoUser));
      await AsyncStorage.setItem('isLoggedIn', 'true');
      onLoginSuccess(demoUser);
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>🎨</Text>
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
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity 
          style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginButtonText}>
            {loading ? 'Logging in...' : 'Log in'}
          </Text>
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
        >
          <Text style={styles.demoButtonText}>Try Demo Account</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={onSignUpPress}>
          <Text style={styles.signUpText}>Sign up</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 15,
  },
  loginButton: {
    backgroundColor: '#e60023',
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
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
    color: '#666',
    fontSize: 14,
  },
  demoButton: {
    backgroundColor: '#f9f9f9',
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  demoButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 16,
    color: '#666',
  },
  signUpText: {
    fontSize: 16,
    color: '#e60023',
    fontWeight: 'bold',
  },
});
