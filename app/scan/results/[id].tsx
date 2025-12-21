import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Logo from '@/components/Logo';
import GradientButton from '@/components/GradientButton';
import GradientText from '@/components/GradientText';
import { getScan, updateScanLabel } from '@/services/supabase';
import { track, Events } from '@/services/analytics';
import { getScoreColor, getScoreLabel, colors, spacing, typography, borderRadius } from '@/theme';
import { AnalysisResult, Pattern, ConversationVibe } from '@/types';

export default function Results() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState('');
  const [displayScore, setDisplayScore] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);

  // Animation refs
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadResult();
    track(Events.RESULTS_VIEWED, { scan_id: id });
  }, [id]);

  // Animate score count-up when result loads
  useEffect(() => {
    if (result && !animationComplete) {
      const targetScore = result.score;

      // Listen to animated value changes and update display
      const listenerId = scoreAnim.addListener(({ value }) => {
        setDisplayScore(Math.round(value));
      });

      // Count up animation
      Animated.timing(scoreAnim, {
        toValue: targetScore,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // Need false for non-transform values
      }).start(() => {
        // Pop effect when animation completes
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1.15,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.3,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          setAnimationComplete(true);
        });
      });

      return () => {
        scoreAnim.removeListener(listenerId);
      };
    }
  }, [result]);

  const loadResult = async () => {
    if (!id) return;

    try {
      const data = await getScan(id);
      if (data) {
        setResult(data);
        setLabelValue(data.chatLabel || '');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLabel = async () => {
    if (!id || !result) return;

    try {
      await updateScanLabel(id, labelValue);
      setResult({ ...result, chatLabel: labelValue });
      setEditingLabel(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save label');
    }
  };

  const handleShare = () => {
    track(Events.SHARE_TAPPED, { scan_id: id });
    router.push({
      pathname: '/share',
      params: { scanId: id },
    });
  };

  const handleCopy = async () => {
    if (!result) return;

    const text = `${result.summary}\n\nScore: ${result.score}/100 (${result.label})\nMessages: ${result.breakdown.messages.you} you / ${result.breakdown.messages.them} them\n\n- ratioed.app`;

    await Share.share({ message: text });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.gradientStart} />
      </View>
    );
  }

  if (!result) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Result not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.linkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scoreColor = getScoreColor(result.score);
  const label = getScoreLabel(result.score);

  // Calculate ratio
  const youSent = result.breakdown.messages.you;
  const theySent = result.breakdown.messages.them;
  const ratio = theySent > 0
    ? (youSent / theySent).toFixed(1)
    : youSent > 0 ? '∞' : '1.0';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Logo size={24} />
          <Text style={styles.headerTitle}>Results</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Label */}
        <TouchableOpacity
          style={styles.labelContainer}
          onPress={() => setEditingLabel(true)}
        >
          {editingLabel ? (
            <View style={styles.labelEdit}>
              <TextInput
                style={styles.labelInput}
                value={labelValue}
                onChangeText={setLabelValue}
                placeholder="Add a label..."
                placeholderTextColor={colors.textMuted}
                autoFocus
                onBlur={handleSaveLabel}
                onSubmitEditing={handleSaveLabel}
              />
            </View>
          ) : (
            <Text style={styles.labelText}>
              {result.chatLabel || 'Tap to add label'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Summary */}
        <Text style={styles.summary}>{result.summary}</Text>

        {/* Score */}
        <View style={styles.scoreSection}>
          <View style={styles.scoreWrapper}>
            <Animated.View
              style={[
                styles.scoreGlow,
                {
                  opacity: glowAnim,
                  backgroundColor: scoreColor,
                },
              ]}
            />
            <Animated.Text
              style={[
                styles.scoreNumber,
                {
                  color: scoreColor,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {displayScore}
            </Animated.Text>
          </View>
          <Text style={styles.scoreOutOf}>out of 100</Text>
          <Animated.View
            style={[
              styles.labelBadge,
              {
                backgroundColor: scoreColor + '20',
                opacity: animationComplete ? 1 : 0,
              },
            ]}
          >
            <Text style={[styles.labelBadgeText, { color: scoreColor }]}>
              {label}
            </Text>
          </Animated.View>
        </View>

        {/* Ratio Card */}
        <View style={styles.ratioCard}>
          <View style={styles.ratioRow}>
            <View style={styles.ratioStat}>
              <GradientText style={styles.ratioValue}>{youSent}</GradientText>
              <Text style={styles.ratioLabel}>YOU SENT</Text>
            </View>
            <View style={styles.ratioDivider} />
            <View style={styles.ratioStat}>
              <GradientText style={styles.ratioValue}>{theySent}</GradientText>
              <Text style={styles.ratioLabel}>THEY SENT</Text>
            </View>
            <View style={styles.ratioDivider} />
            <View style={styles.ratioStat}>
              <GradientText style={styles.ratioValue}>{ratio}x</GradientText>
              <Text style={styles.ratioLabel}>RATIO</Text>
            </View>
          </View>
        </View>

        {/* Vibe Card */}
        {result.vibe && (
          <VibeCard vibe={result.vibe} />
        )}

        {/* Patterns */}
        {result.patterns && result.patterns.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PATTERNS</Text>
            {result.patterns.map((pattern, index) => (
              <PatternCard key={index} pattern={pattern} />
            ))}
          </View>
        )}

        {/* Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BREAKDOWN</Text>
          <View style={styles.breakdownGrid}>
            <BreakdownCard
              title="Messages"
              you={result.breakdown.messages.you}
              them={result.breakdown.messages.them}
            />
            <BreakdownCard
              title="Words"
              you={result.breakdown.words.you}
              them={result.breakdown.words.them}
            />
            <BreakdownCard
              title="Questions"
              you={result.breakdown.questions.you}
              them={result.breakdown.questions.them}
            />
            <BreakdownCard
              title="Initiations"
              you={result.breakdown.initiations.you}
              them={result.breakdown.initiations.them}
            />
          </View>
        </View>

        {/* Compare CTA */}
        <TouchableOpacity
          style={styles.compareCta}
          onPress={() => {
            Alert.alert(
              'Compare Conversations',
              'This will use 1 scan credit',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Continue',
                  onPress: () => {
                    router.push({
                      pathname: '/scan/compare',
                      params: {
                        existingScanId: id,
                        existingLabel: result?.chatLabel || result?.label || 'Person A',
                      },
                    });
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.compareText}>Compare to another convo?</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.gradientStart} />
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + spacing.md }]}>
        <GradientButton
          title="Share"
          icon="share-social"
          onPress={handleShare}
          style={styles.shareButton}
        />
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
          <Ionicons name="copy-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PatternCard({ pattern }: { pattern: Pattern }) {
  const sentimentColors = {
    positive: colors.scoreGreen,
    neutral: colors.scoreYellow,
    negative: colors.scoreRed,
  };

  return (
    <View style={styles.patternCard}>
      <View
        style={[
          styles.patternDot,
          { backgroundColor: sentimentColors[pattern.sentiment] },
        ]}
      />
      <View style={styles.patternContent}>
        <Text style={styles.patternTitle}>{pattern.title}</Text>
        <Text style={styles.patternDescription}>{pattern.description}</Text>
      </View>
    </View>
  );
}

function BreakdownCard({
  title,
  you,
  them,
}: {
  title: string;
  you: number;
  them: number;
}) {
  const total = you + them;
  const youPercent = total > 0 ? Math.round((you / total) * 100) : 50;
  const themPercent = 100 - youPercent;

  return (
    <View style={styles.breakdownCard}>
      <Text style={styles.breakdownTitle}>{title}</Text>
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownStat}>
          <Text style={styles.breakdownValue}>{you}</Text>
          <Text style={styles.breakdownLabel}>you</Text>
        </View>
        <View style={styles.breakdownStat}>
          <Text style={styles.breakdownValue}>{them}</Text>
          <Text style={styles.breakdownLabel}>them</Text>
        </View>
      </View>
      <View style={styles.breakdownBar}>
        <View
          style={[
            styles.breakdownBarYou,
            { width: `${youPercent}%` },
          ]}
        />
      </View>
    </View>
  );
}

function VibeCard({ vibe }: { vibe: ConversationVibe }) {
  const vibeColors: Record<string, string> = {
    'Flirty': colors.gradientStart,
    'Engaged': colors.scoreGreen,
    'Balanced': colors.scoreGreen,
    'Interested': colors.scoreGreen,
    'Dry': colors.scoreYellow,
    'Mixed': colors.scoreYellow,
    'Low Energy': colors.scoreYellow,
    'Distant': colors.scoreRed,
  };

  const vibeColor = vibeColors[vibe.vibe] || colors.textSecondary;

  return (
    <View style={styles.vibeCard}>
      <View style={styles.vibeHeader}>
        <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
        <Text style={[styles.vibeLabel, { color: vibeColor }]}>{vibe.vibe}</Text>
      </View>
      <Text style={styles.vibeDescription}>{vibe.description}</Text>
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
    fontWeight: typography.semibold,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  labelContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  labelText: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  labelEdit: {
    width: '100%',
  },
  labelInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.md,
    textAlign: 'center',
  },
  summary: {
    fontSize: typography.lg,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 26,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  scoreWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  scoreGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  scoreNumber: {
    fontSize: 96,
    fontWeight: typography.bold,
  },
  scoreOutOf: {
    fontSize: typography.md,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  labelBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  labelBadgeText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  ratioCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  ratioRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  ratioStat: {
    alignItems: 'center',
  },
  ratioValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
  },
  ratioLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  ratioDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontWeight: typography.semibold,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  patternCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  patternDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: spacing.md,
  },
  patternContent: {
    flex: 1,
  },
  patternTitle: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  patternDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '48%',
  },
  breakdownTitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  breakdownStat: {
    alignItems: 'center',
  },
  breakdownValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
  },
  breakdownLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  breakdownBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownBarYou: {
    height: '100%',
    backgroundColor: colors.gradientStart,
    borderRadius: 2,
  },
  compareCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  compareText: {
    fontSize: typography.sm,
    color: colors.gradientStart,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  shareButton: {
    flex: 1,
  },
  copyButton: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Vibe Card styles
  vibeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  vibeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  vibeEmoji: {
    fontSize: 28,
  },
  vibeLabel: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
  },
  vibeDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
