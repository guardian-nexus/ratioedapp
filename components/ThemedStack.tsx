// components/ThemedStack.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme';

export default function ThemedStack() {
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
    </>
  );
}
