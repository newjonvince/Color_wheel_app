// index.js - App entry point with performance optimizations
import { enableScreens } from 'react-native-screens';
enableScreens(true);

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
