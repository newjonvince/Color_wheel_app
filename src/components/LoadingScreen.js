// components/LoadingScreen.js - Loading state component
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const LoadingScreen = ({ SafeAreaProvider, SafeAreaView, error }) => (
  <SafeAreaProvider>
    <SafeAreaView style={styles.container}>
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </SafeAreaView>
  </SafeAreaProvider>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  loadingText: { 
    fontSize: 18, 
    color: '#666', 
    textAlign: 'center', 
    marginBottom: 10 
  },
  errorText: { 
    fontSize: 14, 
    color: '#ff6b6b', 
    textAlign: 'center', 
    marginTop: 10 
  },
});
