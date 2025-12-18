import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

import Logo from '@/components/Logo';
import GradientButton from '@/components/GradientButton';
import GradientText from '@/components/GradientText';
import CompareShareCard from '@/components/CompareShareCard';
import { getScan } from '@/services/supabase';
import { track, Events } from '@/services/analytics';
import { getScoreColor, getScoreLabel, colors, spacing, typography, borderRadius } from '@/theme';
import { AnalysisResult } from '@/types';

export default function CompareResults() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    scanIdA: string;
    scanIdB: string;
    labelA: string;
    labelB: string;
  }>();

  const [resultA, setResultA] = useState<AnalysisResult | null>(null);
  const [resultB, setResultB] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    loadResults();
    track('compare_results_viewed', {
      scan_id_a: params.scanIdA,
      scan_id_b: params.scanIdB,
    });
  }, []);

  const loadResults = async () => {
    try {
      const [dataA, dataB] = await Promise.all([
        getScan(params.scanIdA),
        getScan(params.scanIdB),
      ]);

      if (dataA && dataB) {
        setResultA(dataA);
        setResultB(dataB);
      } else {
        Alert.alert('Error', 'Failed to load comparison results');
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load results');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getWinner = () => {
    if (!resultA || !resultB) return null;

    // Higher score = more balanced = better
    if (resultA.score > resultB.score + 5) return 'A';
    if (resultB.score > resultA.score + 5) return 'B';
    return 'tie';
  };

  const getComparisonSummary = () => {
    if (!resultA || !resultB) return '';

    const winner = getWinner();
    const labelA = params.labelA || 'Person A';
    const labelB = params.labelB || 'Person B';

    if (winner === 'A') {
      return `${labelA}'s conversation is more balanced`;
    } else if (winner === 'B') {
      return `${labelB}'s conversation is more balanced`;
    } else {
      return "Both conversations have similar energy";
    }
  };

  const captureCard = async (): Promise<string | null> => {
    if (!viewShotRef.current) return null;

    try {
      const uri = await viewShotRef.current.capture?.();
      return uri || null;
    } catch (error) {
      if (__DEV__) {
        console.error('Capture error:', error);
      }
      return null;
    }
  };

  const handleShare = async () => {
    if (!resultA || !resultB) return;

    setSharing(true);
    setShowShareCard(true);
    track(Events.SHARE_TAPPED, { type: 'compare' });

    // Wait for card to render
    await new Promise((r) => setTimeout(r, 100));

    try {
      const uri = await captureCard();
      setShowShareCard(false);

      if (!uri) {
        Alert.alert('Error', 'Failed to capture image');
        return;
      }

      // Check if Instagram is installed
      const instagramUrl = 'instagram://story-camera';
      const canOpen = await Linking.canOpenURL(instagramUrl);

      if (canOpen) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please allow access to your photo library to share to Instagram.'
          );
          return;
        }

        await MediaLibrary.saveToLibraryAsync(uri);
        await Linking.openURL(instagramUrl);

        Alert.alert(
          'Image Saved',
          'Your compare card has been saved to your camera roll. Select it in Instagram Stories!',
          [{ text: 'OK' }]
        );
      } else {
        // Use general share
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert('Error', 'Sharing is not available on this device');
          return;
        }

        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your comparison',
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    } finally {
      setSharing(false);
      setShowShareCard(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.gradientStart} />
      </View>
    );
  }

  if (!resultA || !resultB) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Results not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.linkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const winner = getWinner();
  const labelA = params.labelA || 'Person A';
  const labelB = params.labelB || 'Person B';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Logo size={24} />
          <Text style={styles.headerTitle}>Compare</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.summarySection}>
          <GradientText style={styles.summaryText}>
            {getComparisonSummary()}
          </GradientText>
        </View>

        {/* Score Comparison */}
        <View style={styles.scoresContainer}>
          {/* Person A */}
          <View style={[styles.scoreCard, winner === 'A' && styles.winnerCard]}>
            {winner === 'A' && (
              <View style={styles.winnerBadge}>
                <Ionicons name="trophy" size={12} color={colors.background} />
              </View>
            )}
            <Text style={styles.personLabel}>{labelA}</Text>
            <Text style={[styles.scoreNumber, { color: getScoreColor(resultA.score) }]}>
              {resultA.score}
            </Text>
            <Text style={styles.scoreOutOf}>out of 100</Text>
            <View style={[styles.labelBadge, { backgroundColor: getScoreColor(resultA.score) + '20' }]}>
              <Text style={[styles.labelBadgeText, { color: getScoreColor(resultA.score) }]}>
                {getScoreLabel(resultA.score)}
              </Text>
            </View>
          </View>

          {/* VS */}
          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          {/* Person B */}
          <View style={[styles.scoreCard, winner === 'B' && styles.winnerCard]}>
            {winner === 'B' && (
              <View style={styles.winnerBadge}>
                <Ionicons name="trophy" size={12} color={colors.background} />
              </View>
            )}
            <Text style={styles.personLabel}>{labelB}</Text>
            <Text style={[styles.scoreNumber, { color: getScoreColor(resultB.score) }]}>
              {resultB.score}
            </Text>
            <Text style={styles.scoreOutOf}>out of 100</Text>
            <View style={[styles.labelBadge, { backgroundColor: getScoreColor(resultB.score) + '20' }]}>
              <Text style={[styles.labelBadgeText, { color: getScoreColor(resultB.score) }]}>
                {getScoreLabel(resultB.score)}
              </Text>
            </View>
          </View>
        </View>

        {/* Breakdown Comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BREAKDOWN</Text>

          <ComparisonRow
            label="Messages Sent"
            valueA={resultA.breakdown.messages.you}
            valueB={resultB.breakdown.messages.you}
            labelA={labelA}
            labelB={labelB}
          />
          <ComparisonRow
            label="Messages Received"
            valueA={resultA.breakdown.messages.them}
            valueB={resultB.breakdown.messages.them}
            labelA={labelA}
            labelB={labelB}
          />
          <ComparisonRow
            label="Words Sent"
            valueA={resultA.breakdown.words.you}
            valueB={resultB.breakdown.words.you}
            labelA={labelA}
            labelB={labelB}
          />
          <ComparisonRow
            label="Questions Asked"
            valueA={resultA.breakdown.questions.you}
            valueB={resultB.breakdown.questions.you}
            labelA={labelA}
            labelB={labelB}
          />
        </View>

        {/* View Individual Results */}
        <View style={styles.linksSection}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push(`/scan/results/${params.scanIdA}`)}
          >
            <Text style={styles.linkButtonText}>View {labelA}'s full results</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.gradientStart} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push(`/scan/results/${params.scanIdB}`)}
          >
            <Text style={styles.linkButtonText}>View {labelB}'s full results</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.gradientStart} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { paddingBottom: insets.bottom + spacing.md }]}>
        <GradientButton
          title="Share"
          icon="share-social"
          onPress={handleShare}
          loading={sharing}
          disabled={sharing}
          style={styles.shareButton}
        />
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Hidden share card for capture */}
      {showShareCard && (
        <View style={styles.hiddenCard}>
          <ViewShot
            ref={viewShotRef}
            options={{
              format: 'png',
              quality: 1,
              result: 'tmpfile',
            }}
          >
            <CompareShareCard
              resultA={resultA}
              resultB={resultB}
              labelA={labelA}
              labelB={labelB}
            />
          </ViewShot>
        </View>
      )}
    </View>
  );
}

function ComparisonRow({
  label,
  valueA,
  valueB,
  labelA,
  labelB,
}: {
  label: string;
  valueA: number;
  valueB: number;
  labelA: string;
  labelB: string;
}) {
  const total = valueA + valueB;
  const percentA = total > 0 ? Math.round((valueA / total) * 100) : 50;

  return (
    <View style={styles.comparisonRow}>
      <Text style={styles.comparisonLabel}>{label}</Text>
      <View style={styles.comparisonValues}>
        <View style={styles.comparisonValue}>
          <Text style={styles.comparisonValueText}>{valueA}</Text>
          <Text style={styles.comparisonValueLabel}>{labelA}</Text>
        </View>
        <View style={styles.comparisonBar}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.comparisonBarFill, { width: `${percentA}%` }]}
          />
        </View>
        <View style={styles.comparisonValue}>
          <Text style={styles.comparisonValueText}>{valueB}</Text>
          <Text style={styles.comparisonValueLabel}>{labelB}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: typography.md,
  },
  linkText: {
    color: colors.gradientStart,
    fontSize: typography.md,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  summarySection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  summaryText: {
    fontSize: typography.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
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
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gradientStart,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '800',
  },
  scoreOutOf: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  labelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  labelBadgeText: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  vsContainer: {
    paddingHorizontal: spacing.md,
  },
  vsText: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.textMuted,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  comparisonRow: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  comparisonLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  comparisonValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonValue: {
    width: 60,
    alignItems: 'center',
  },
  comparisonValueText: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  comparisonValueLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  comparisonBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  comparisonBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  linksSection: {
    gap: spacing.sm,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  linkButtonText: {
    fontSize: typography.sm,
    color: colors.gradientStart,
  },
  bottomCta: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    gap: spacing.md,
  },
  shareButton: {
    flex: 1,
  },
  doneButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
  },
  hiddenCard: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
});
