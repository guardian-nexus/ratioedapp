export const colors = {
  // Base
  background: '#0a0a0a',
  surface: '#1a1a1a',
  surfaceLight: '#2a2a2a',

  // Text
  text: '#ffffff',
  textSecondary: '#888888',
  textMuted: '#666666',

  // Brand gradient (pink to orange)
  gradientStart: '#ec4899', // pink-500
  gradientEnd: '#f97316',   // orange-500

  // Score colors
  scoreGreen: '#22c55e',    // balanced (60-100)
  scoreYellow: '#eab308',   // mixed (40-59)
  scoreRed: '#ef4444',      // one-sided (0-39)

  // Score backgrounds (darker versions)
  scoreGreenBg: '#14532d',
  scoreYellowBg: '#713f12',
  scoreRedBg: '#7f1d1d',

  // UI
  border: '#333333',
  borderLight: '#444444',

  // Status
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  // Font sizes
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  hero: 64,

  // Font weights (as strings for RN)
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Helper function to get score color based on value
export function getScoreColor(score: number): string {
  if (score >= 60) return colors.scoreGreen;
  if (score >= 40) return colors.scoreYellow;
  return colors.scoreRed;
}

// Helper function to get score label
export function getScoreLabel(score: number): 'BALANCED' | 'MIXED' | 'ONE-SIDED AF' {
  if (score >= 60) return 'BALANCED';
  if (score >= 40) return 'MIXED';
  return 'ONE-SIDED AF';
}

export const theme = {
  colors,
  spacing,
  typography,
  borderRadius,
};

export type Theme = typeof theme;
