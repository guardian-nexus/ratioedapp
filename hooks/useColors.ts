// hooks/useColors.ts
import { useTheme } from '@/contexts/ThemeContext';
import { getColors, darkColors } from '@/theme';

/**
 * Hook to get current theme colors
 * Falls back to dark colors if used outside ThemeProvider
 */
export function useColors() {
  try {
    const { isDark } = useTheme();
    return getColors(isDark);
  } catch {
    // Fallback for components rendered outside ThemeProvider
    return darkColors;
  }
}
