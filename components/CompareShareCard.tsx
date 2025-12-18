import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography, borderRadius, getScoreColor, getScoreLabel } from '@/theme';
import { AnalysisResult } from '@/types';

interface CompareShareCardProps {
  resultA: AnalysisResult;
  resultB: AnalysisResult;
  labelA: string;
  labelB: string;
}

export default function CompareShareCard({
  resultA,
  resultB,
  labelA,
  labelB,
}: CompareShareCardProps) {
  const getWinner = () => {
    if (resultA.score > resultB.score + 5) return 'A';
    if (resultB.score > resultA.score + 5) return 'B';
    return 'tie';
  };

  const winner = getWinner();

  const getComparisonSummary = () => {
    if (winner === 'A') {
      return `${labelA}'s conversation is more balanced`;
    } else if (winner === 'B') {
      return `${labelB}'s conversation is more balanced`;
    } else {
      return "Both conversations have similar energy";
    }
  };

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

      {/* Summary */}
      <Text style={styles.summaryText}>{getComparisonSummary()}</Text>

      {/* Scores */}
      <View style={styles.scoresContainer}>
        {/* Person A */}
        <View style={[styles.scoreCard, winner === 'A' && styles.winnerCard]}>
          {winner === 'A' && (
            <View style={styles.winnerBadge}>
              <Ionicons name="trophy" size={10} color={colors.background} />
            </View>
          )}
          <Text style={styles.personLabel}>{labelA}</Text>
          <Text style={[styles.scoreNumber, { color: getScoreColor(resultA.score) }]}>
            {resultA.score}
          </Text>
          <View style={[styles.labelBadge, { backgroundColor: getScoreColor(resultA.score) + '20' }]}>
            <Text style={[styles.labelBadgeText, { color: getScoreColor(resultA.score) }]}>
              {getScoreLabel(resultA.score)}
            </Text>
          </View>
        </View>

        {/* VS */}
        <Text style={styles.vsText}>VS</Text>

        {/* Person B */}
        <View style={[styles.scoreCard, winner === 'B' && styles.winnerCard]}>
          {winner === 'B' && (
            <View style={styles.winnerBadge}>
              <Ionicons name="trophy" size={10} color={colors.background} />
            </View>
          )}
          <Text style={styles.personLabel}>{labelB}</Text>
          <Text style={[styles.scoreNumber, { color: getScoreColor(resultB.score) }]}>
            {resultB.score}
          </Text>
          <View style={[styles.labelBadge, { backgroundColor: getScoreColor(resultB.score) + '20' }]}>
            <Text style={[styles.labelBadgeText, { color: getScoreColor(resultB.score) }]}>
              {getScoreLabel(resultB.score)}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats comparison */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Messages</Text>
          <View style={styles.statValues}>
            <Text style={styles.statValue}>
              {resultA.breakdown.messages.you} / {resultA.breakdown.messages.them}
            </Text>
            <Text style={styles.statVs}>vs</Text>
            <Text style={styles.statValue}>
              {resultB.breakdown.messages.you} / {resultB.breakdown.messages.them}
            </Text>
          </View>
        </View>
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
    width: 360,
    height: 640,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
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
    marginTop: spacing.md,
  },
  fullLogo: {
    width: 160,
    height: 48,
  },
  summaryText: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.gradientStart,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  scoresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    position: 'relative',
  },
  winnerCard: {
    borderWidth: 2,
    borderColor: colors.gradientStart,
  },
  winnerBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gradientStart,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  scoreNumber: {
    fontSize: 40,
    fontWeight: '800',
  },
  labelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  labelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  vsText: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.textMuted,
    marginHorizontal: spacing.sm,
  },
  statsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statRow: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statValue: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
  },
  statVs: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  brandingContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
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
