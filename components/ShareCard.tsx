import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, typography, borderRadius, getScoreColor, getScoreLabel } from '@/theme';
import { AnalysisResult } from '@/types';

interface ShareCardProps {
  result: AnalysisResult;
}

export default function ShareCard({ result }: ShareCardProps) {
  const scoreColor = getScoreColor(result.score);
  const label = getScoreLabel(result.score);

  // Calculate ratio
  const youSent = result.breakdown.messages.you;
  const theySent = result.breakdown.messages.them;
  const ratio = theySent > 0
    ? (youSent / theySent).toFixed(1)
    : youSent > 0 ? '∞' : '1.0';

  return (
    <View style={styles.card}>
      {/* Background gradient overlay */}
      <LinearGradient
        colors={['rgba(236, 72, 153, 0.1)', 'rgba(249, 115, 22, 0.05)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientOverlay}
      />

      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/full-logo-transparent.png')}
          style={styles.fullLogo}
          resizeMode="contain"
        />
      </View>

      {/* Score Section */}
      <View style={styles.scoreSection}>
        <Text style={[styles.scoreNumber, { color: scoreColor }]}>
          {result.score}
        </Text>
        <Text style={styles.scoreOutOf}>out of 100</Text>
        <View style={[styles.labelBadge, { backgroundColor: scoreColor + '20' }]}>
          <Text style={[styles.labelBadgeText, { color: scoreColor }]}>
            {label}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{result.breakdown.messages.you}</Text>
          <Text style={styles.statLabel}>you sent</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{result.breakdown.messages.them}</Text>
          <Text style={styles.statLabel}>they sent</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValueGradient}>{ratio}x</Text>
          <Text style={styles.statLabel}>ratio</Text>
        </View>
      </View>

      {/* Summary Quote */}
      <View style={styles.summaryContainer}>
        <Text style={styles.quoteOpen}>"</Text>
        <Text style={styles.summaryText} numberOfLines={3}>
          {result.summary}
        </Text>
        <Text style={styles.quoteClose}>"</Text>
      </View>

      {/* Branding */}
      <View style={styles.brandingContainer}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.brandingLine}
        />
        <Text style={styles.brandingText}>ratioed.app</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 360, // Will be scaled up for export
    height: 640,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  fullLogo: {
    width: 180,
    height: 54,
  },
  scoreSection: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  scoreNumber: {
    fontSize: 120,
    fontWeight: '800',
  },
  scoreOutOf: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    marginTop: -spacing.md,
  },
  labelBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  labelBadgeText: {
    fontSize: typography.lg,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  statValueGradient: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.gradientStart,
  },
  statLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  summaryContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    position: 'relative',
  },
  quoteOpen: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    fontSize: 32,
    color: colors.gradientStart,
    fontWeight: '700',
    opacity: 0.5,
  },
  summaryText: {
    fontSize: typography.md,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  quoteClose: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.md,
    fontSize: 32,
    color: colors.gradientEnd,
    fontWeight: '700',
    opacity: 0.5,
  },
  brandingContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  brandingLine: {
    width: 60,
    height: 3,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  brandingText: {
    fontSize: typography.md,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
