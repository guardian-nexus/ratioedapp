import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/services/auth';
import { CreditsProvider } from '@/hooks/useCredits';
import ErrorBoundary from '@/components/ErrorBoundary';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <AuthProvider>
            <CreditsProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="scan/upload" options={{ presentation: 'card' }} />
                <Stack.Screen name="scan/compare" options={{ presentation: 'card' }} />
                <Stack.Screen name="scan/analyzing" options={{ gestureEnabled: false, animation: 'fade' }} />
                <Stack.Screen name="scan/results/[id]" options={{ presentation: 'card' }} />
                <Stack.Screen name="scan/compare-results" options={{ presentation: 'card' }} />
                <Stack.Screen name="scan/group-results" options={{ presentation: 'card' }} />
                <Stack.Screen name="share" options={{ presentation: 'modal' }} />
                <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
                <Stack.Screen name="store/tokens" options={{ presentation: 'modal' }} />
              </Stack>
            </CreditsProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
