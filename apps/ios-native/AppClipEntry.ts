import { AppRegistry, View, Text } from 'react-native';
import React from 'react';

// Wrap all imports in try/catch to catch module-level errors
// and display them on screen (production builds hide JS errors)
try {
  require('./global.css');
  const { default: AppClip } = require('./AppClip');
  AppRegistry.registerComponent('main', () => AppClip);
} catch (error: any) {
  const errorMessage = error?.message || 'Unknown error';
  const errorStack = (error?.stack || '').substring(0, 800);

  const ErrorScreen = () =>
    React.createElement(View, {
      style: { flex: 1, backgroundColor: '#0a0f1a', justifyContent: 'center', alignItems: 'center', padding: 24 },
    },
      React.createElement(Text, {
        style: { color: '#ef4444', fontSize: 18, fontWeight: '700', marginBottom: 12 },
      }, 'Module Load Error'),
      React.createElement(Text, {
        style: { color: 'white', fontSize: 13, textAlign: 'center', marginBottom: 12 },
      }, errorMessage),
      React.createElement(Text, {
        style: { color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center' },
      }, errorStack),
    );

  AppRegistry.registerComponent('main', () => ErrorScreen);
}
