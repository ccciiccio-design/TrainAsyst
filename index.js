import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Forziamo Metro a includere fisicamente React e React DOM nel bundle finale
if (Platform.OS === 'web') {
  const React = require('react');
  const ReactDOM = require('react-dom/client');
  
  // Se per qualche motivo l'ambiente globale non è allineato, lo agganciamo noi
  window.React = React;
  window.ReactDOM = ReactDOM;
}

import App from './App';

registerRootComponent(App);