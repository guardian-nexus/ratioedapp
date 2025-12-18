import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { useAuth } from '@/services/auth';
import { colors } from '@/theme';

const HAS_ONBOARDED_KEY = 'ratioed_has_onboarded';
const MIN_SPLASH_DURATION = 1500; // 1.5 seconds minimum splash

export default function Index() {
  const { user, loading } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [splashComplete, setSplashComplete] = useState(false);

  // Minimum splash duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashComplete(true);
    }, MIN_SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  // Check if user has completed onboarding
  useEffect(() => {
    async function checkOnboarding() {
      try {
        const value = await SecureStore.getItemAsync(HAS_ONBOARDED_KEY);
        setHasOnboarded(value === 'true');
      } catch {
        setHasOnboarded(false);
      } finally {
        setCheckingOnboarding(false);
      }
    }
    checkOnboarding();
  }, []);

  // Show splash screen while loading OR minimum duration not met
  if (loading || checkingOnboarding || !splashComplete) {
    return (
      <View style={styles.container}>
        <Image
          source={require('@/assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={colors.gradientStart} style={styles.loader} />
      </View>
    );
  }

  // First time user - show onboarding
  if (!hasOnboarded) {
    return <Redirect href="/onboarding" />;
  }

  // Not authenticated - show auth screen
  if (!user) {
    return <Redirect href="/auth" />;
  }

  // Authenticated - go to main tabs
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  loader: {
    marginTop: 24,
  },
});
