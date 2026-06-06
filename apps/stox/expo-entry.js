import 'expo/src/Expo.fx';
import '@expo/metro-runtime';

import { AppRegistry, Platform } from 'react-native';
import { App } from 'expo-router/build/qualified-entry';

AppRegistry.registerComponent('main', () => App);

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const rootTag = document.getElementById('root');

  if (rootTag) {
    AppRegistry.runApplication('main', {
      rootTag,
      hydrate: globalThis.__EXPO_ROUTER_HYDRATE__,
    });
  }
}
