import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet, Text, Platform } from 'react-native';

import { initDatabase } from './src/database/database';
import { SettingsProvider } from './src/context/SettingsContext';
import MainNavigator from './src/navigation/MainNavigator';
import { colors } from './src/theme/colors';

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        if (Platform.OS === 'web') {
          console.warn('Running on web - SQLite not supported. App may have limited functionality.');
          setError('Web platform is not fully supported. This app requires SQLite which only works on iOS/Android. Please run on a mobile device or simulator.');
          return;
        }
        await initDatabase();
        setIsDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setError(`Database initialization failed: ${error}`);
      }
    };

    setupDatabase();
  }, []);

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>
          Please use iOS Simulator, Android Emulator, or a physical device.
        </Text>
      </View>
    );
  }

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <NavigationContainer>
          <MainNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  errorSubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});
