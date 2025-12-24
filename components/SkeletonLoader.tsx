// components/SkeletonLoader.tsx
// Animated skeleton placeholder for loading states

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';

import { useColors } from '@/hooks/useColors';
import { borderRadius, spacing } from '@/theme';

interface SkeletonLoaderProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius: radius = borderRadius.sm,
  style,
}: SkeletonLoaderProps) {
  const colors = useColors();
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.surface,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

// Pre-built skeleton for scan cards in history
export function ScanCardSkeleton() {
  const colors = useColors();

  return (
    <View style={[styles.scanCard, { backgroundColor: colors.surface }]}>
      <View style={styles.scanHeader}>
        <SkeletonLoader width={120} height={16} />
        <SkeletonLoader width={60} height={12} />
      </View>
      <View style={styles.scanContent}>
        <View style={styles.scoreContainer}>
          <SkeletonLoader width={48} height={32} borderRadius={borderRadius.md} />
          <SkeletonLoader width={64} height={20} borderRadius={borderRadius.full} style={{ marginTop: spacing.xs }} />
        </View>
        <View style={styles.summaryContainer}>
          <SkeletonLoader width="100%" height={14} />
          <SkeletonLoader width="80%" height={14} style={{ marginTop: spacing.xs }} />
        </View>
      </View>
    </View>
  );
}

// Skeleton for compare cards
export function CompareCardSkeleton() {
  const colors = useColors();

  return (
    <View style={[styles.compareCard, { backgroundColor: colors.surface }]}>
      <View style={styles.scanHeader}>
        <SkeletonLoader width={150} height={16} />
        <SkeletonLoader width={60} height={12} />
      </View>
      <View style={styles.compareScores}>
        <View style={styles.compareScoreItem}>
          <SkeletonLoader width={40} height={12} />
          <SkeletonLoader width={32} height={28} style={{ marginTop: spacing.xs }} />
        </View>
        <SkeletonLoader width={20} height={14} />
        <View style={styles.compareScoreItem}>
          <SkeletonLoader width={40} height={12} />
          <SkeletonLoader width={32} height={28} style={{ marginTop: spacing.xs }} />
        </View>
      </View>
    </View>
  );
}

// History list skeleton (3 cards)
export function HistoryListSkeleton() {
  return (
    <View style={styles.listContainer}>
      <ScanCardSkeleton />
      <ScanCardSkeleton />
      <ScanCardSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  scanCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  scanContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  summaryContainer: {
    flex: 1,
  },
  compareCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  compareScores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  compareScoreItem: {
    alignItems: 'center',
    flex: 1,
  },
});
