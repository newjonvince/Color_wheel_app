// services/secureStore.js
import * as SecureStore from 'expo-secure-store';

export const saveToken = (token) => SecureStore.setItemAsync('authToken', token);
export const getToken = () => SecureStore.getItemAsync('authToken');
export const deleteToken = () => SecureStore.deleteItemAsync('authToken');
