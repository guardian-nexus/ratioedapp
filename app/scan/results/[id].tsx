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
import { getScan, updateScanLabel, getTrendData, TrendData } from '@/services/supabase';
import { useColors } from '@/hooks/useColors';
import { track, Events } from '@/services/analytics';
import { getScoreColor, getScoreLabel, colors as defaultColors, spacing, typography, borderRadius } from '@/theme';
import { AnalysisResult, Pattern, ConversationVibe } from '@/types';

export default function Results() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState('');
  const [displayScore, setDisplayScore] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [trendData, setTrendData] = useState<TrendData | null>(null);

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

        // Load trend data if there's a label
        if (data.chatLabel) {
          const trend = await getTrendData(id, data.chatLabel);
          setTrendData(trend);
        }
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

      // Refresh trend data with new label
      if (labelValue) {
        const trend = await getTrendData(id, labelValue);
        setTrendData(trend);
      } else {
        setTrendData(null);
      }
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
        <ActivityIndicator size="large" color={defaultColors.gradientStart} />
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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Logo size={24} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Results</Text>
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
                style={[styles.labelInput, { backgroundColor: colors.surface, color: colors.text }]}
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
            <Text style={[styles.labelText, { color: colors.textSecondary }]}>
              {result.chatLabel || 'Tap to add label'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Summary */}
        <Text style={[styles.summary, { color: colors.text }]}>{result.summary}</Text>

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
          <Text style={[styles.scoreOutOf, { color: colors.textSecondary }]}>out of 100</Text>
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
        <View style={[styles.ratioCard, { backgroundColor: colors.surface }]}>
          <View style={styles.ratioRow}>
            <View style={styles.ratioStat}>
              <GradientText style={styles.ratioValue}>{youSent}</GradientText>
              <Text style={[styles.ratioLabel, { color: colors.textSecondary }]}>YOU SENT</Text>
            </View>
            <View style={[styles.ratioDivider, { backgroundColor: colors.border }]} />
            <View style={styles.ratioStat}>
              <GradientText style={styles.ratioValue}>{theySent}</GradientText>
              <Text style={[styles.ratioLabel, { color: colors.textSecondary }]}>THEY SENT</Text>
            </View>
            <View style={[styles.ratioDivider, { backgroundColor: colors.border }]} />
            <View style={styles.ratioStat}>
              <GradientText style={styles.ratioValue}>{ratio}x</GradientText>
              <Text style={[styles.ratioLabel, { color: colors.textSecondary }]}>RATIO</Text>
            </View>
          </View>
        </View>

        {/* Vibe Card */}
        {result.vibe && (
          <VibeCard vibe={result.vibe} />
        )}

        {/* Trend Card */}
        {trendData && trendData.trend !== 'new' && trendData.previousScans.length > 0 && (
          <TrendCard trendData={trendData} currentScore={result.score} />
        )}

        {/* Patterns */}
        {result.patterns && result.patterns.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PATTERNS</Text>
            {result.patterns.map((pattern, index) => (
              <PatternCard key={index} pattern={pattern} />
            ))}
          </View>
        )}

        {/* Breakdown */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>BREAKDOWN</Text>
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
            {result.breakdown.responseTimes &&
              (result.breakdown.responseTimes.you !== null || result.breakdown.responseTimes.them !== null) && (
              <ResponseTimeCard
                youMins={result.breakdown.responseTimes.you}
                themMins={result.breakdown.responseTimes.them}
              />
            )}
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
          <Ionicons name="arrow-forward" size={16} color={defaultColors.gradientStart} />
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + spacing.md, borderTopColor: colors.border }]}>
        <GradientButton
          title="Share"
          icon="share-social"
          onPress={handleShare}
          style={styles.shareButton}
        />
        <TouchableOpacity style={[styles.copyButton, { backgroundColor: colors.surface }]} onPress={handleCopy}>
          <Ionicons name="copy-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PatternCard({ pattern }: { pattern: Pattern }) {
  const colors = useColors();
  const sentimentColors = {
    positive: defaultColors.scoreGreen,
    neutral: defaultColors.scoreYellow,
    negative: defaultColors.scoreRed,
  };

  return (
    <View style={[styles.patternCard, { backgroundColor: colors.surface }]}>
      <View
        style={[
          styles.patternDot,
          { backgroundColor: sentimentColors[pattern.sentiment] },
        ]}
      />
      <View style={styles.patternContent}>
        <Text style={[styles.patternTitle, { color: colors.text }]}>{pattern.title}</Text>
        <Text style={[styles.patternDescription, { color: colors.textSecondary }]}>{pattern.description}</Text>
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
  const colors = useColors();
  const total = you + them;
  const youPercent = total > 0 ? Math.round((you / total) * 100) : 50;
  const themPercent = 100 - youPercent;

  return (
    <View style={[styles.breakdownCard, { backgroundColor: colors.surface }]}>
      <Text style={[styles.breakdownTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownStat}>
          <Text style={[styles.breakdownValue, { color: colors.text }]}>{you}</Text>
          <Text style={[styles.breakdownLabel, { color: colors.textMuted }]}>you</Text>
        </View>
        <View style={styles.breakdownStat}>
          <Text style={[styles.breakdownValue, { color: colors.text }]}>{them}</Text>
          <Text style={[styles.breakdownLabel, { color: colors.textMuted }]}>them</Text>
        </View>
      </View>
      <View style={[styles.breakdownBar, { backgroundColor: colors.border }]}>
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
  const colors = useColors();
  const vibeColors: Record<string, string> = {
    'Flirty': defaultColors.gradientStart,
    'Engaged': defaultColors.scoreGreen,
    'Balanced': defaultColors.scoreGreen,
    'Interested': defaultColors.scoreGreen,
    'Dry': defaultColors.scoreYellow,
    'Mixed': defaultColors.scoreYellow,
    'Low Energy': defaultColors.scoreYellow,
    'Distant': defaultColors.scoreRed,
  };

  const vibeColor = vibeColors[vibe.vibe] || defaultColors.textSecondary;

  return (
    <View style={[styles.vibeCard, { backgroundColor: colors.surface }]}>
      <View style={styles.vibeHeader}>
        <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
        <Text style={[styles.vibeLabel, { color: vibeColor }]}>{vibe.vibe}</Text>
      </View>
      <Text style={[styles.vibeDescription, { color: colors.textSecondary }]}>{vibe.description}</Text>
    </View>
  );
}

function ResponseTimeCard({
  youMins,
  themMins,
}: {
  youMins: number | null;
  themMins: number | null;
}) {
  const colors = useColors();

  const formatTime = (mins: number | null): string => {
    if (mins === null) return '—';
    if (mins < 1) return '<1m';
    if (mins < 60) return `${Math.round(mins)}m`;
    const hours = mins / 60;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  // Determine who's faster for color coding
  const youFaster = youMins !== null && themMins !== null && youMins < themMins;
  const themFaster = youMins !== null && themMins !== null && themMins < youMins;

  return (
    <View style={[styles.breakdownCard, { backgroundColor: colors.surface }]}>
      <View style={styles.responseTimeHeader}>
        <Text style={[styles.breakdownTitle, { color: colors.textSecondary }]}>Avg Reply Time</Text>
        <Ionicons name="time-outline" size={14} color={colors.textMuted} />
      </View>
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownStat}>
          <Text style={[
            styles.breakdownValue,
            { color: youFaster ? defaultColors.scoreGreen : colors.text }
          ]}>
            {formatTime(youMins)}
          </Text>
          <Text style={[styles.breakdownLabel, { color: colors.textMuted }]}>you</Text>
        </View>
        <View style={styles.breakdownStat}>
          <Text style={[
            styles.breakdownValue,
            { color: themFaster ? defaultColors.scoreGreen : colors.text }
          ]}>
            {formatTime(themMins)}
          </Text>
          <Text style={[styles.breakdownLabel, { color: colors.textMuted }]}>them</Text>
        </View>
      </View>
    </View>
  );
}

function TrendCard({
  trendData,
  currentScore,
}: {
  trendData: TrendData;
  currentScore: number;
}) {
  const colors = useColors();

  const getTrendInfo = () => {
    switch (trendData.trend) {
      case 'improving':
        return {
          icon: 'trending-up' as const,
          color: defaultColors.scoreGreen,
          label: 'Improving',
          description: `Up ${Math.abs(trendData.scoreChange)} points from last scan`,
        };
      case 'declining':
        return {
          icon: 'trending-down' as const,
          color: defaultColors.scoreRed,
          label: 'Declining',
          description: `Down ${Math.abs(trendData.scoreChange)} points from last scan`,
        };
      default:
        return {
          icon: 'remove' as const,
          color: defaultColors.scoreYellow,
          label: 'Stable',
          description: 'Similar to your last scan',
        };
    }
  };

  const info = getTrendInfo();
  const scanCount = trendData.previousScans.length;

  return (
    <View style={[styles.trendCard, { backgroundColor: colors.surface }]}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleRow}>
          <Ionicons name={info.icon} size={20} color={info.color} />
          <Text style={[styles.trendLabel, { color: info.color }]}>{info.label}</Text>
        </View>
        <Text style={[styles.trendScanCount, { color: colors.textMuted }]}>
          {scanCount} previous {scanCount === 1 ? 'scan' : 'scans'}
        </Text>
      </View>
      <Text style={[styles.trendDescription, { color: colors.textSecondary }]}>
        {info.description}
      </Text>

      {/* Mini score history */}
      <View style={styles.trendHistory}>
        {trendData.previousScans.slice(-3).map((scan, index) => (
          <View key={scan.id} style={styles.trendHistoryItem}>
            <Text style={[styles.trendHistoryScore, { color: getScoreColor(scan.score) }]}>
              {scan.score}
            </Text>
            <Text style={[styles.trendHistoryDate, { color: colors.textMuted }]}>
              {formatDate(scan.createdAt)}
            </Text>
          </View>
        ))}
        <View style={styles.trendHistoryItem}>
          <View style={[styles.trendHistoryCurrent, { borderColor: info.color }]}>
            <Text style={[styles.trendHistoryScore, { color: getScoreColor(currentScore) }]}>
              {currentScore}
            </Text>
          </View>
          <Text style={[styles.trendHistoryDate, { color: colors.textMuted }]}>Now</Text>
        </View>
      </View>
    </View>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: defaultColors.textSecondary,
    fontSize: typography.md,
  },
  linkText: {
    color: defaultColors.gradientStart,
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
    color: defaultColors.text,
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
    color: defaultColors.textSecondary,
  },
  labelEdit: {
    width: '100%',
  },
  labelInput: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: defaultColors.text,
    fontSize: typography.md,
    textAlign: 'center',
  },
  summary: {
    fontSize: typography.lg,
    color: defaultColors.text,
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
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: typography.bold,
  },
  scoreOutOf: {
    fontSize: typography.md,
    color: defaultColors.textSecondary,
    marginTop: spacing.sm,
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
    backgroundColor: defaultColors.surface,
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
    color: defaultColors.textSecondary,
    marginTop: spacing.xs,
  },
  ratioDivider: {
    width: 1,
    height: 40,
    backgroundColor: defaultColors.border,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sm,
    color: defaultColors.textMuted,
    fontWeight: typography.semibold,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  patternCard: {
    flexDirection: 'row',
    backgroundColor: defaultColors.surface,
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
    color: defaultColors.text,
    marginBottom: spacing.xs,
  },
  patternDescription: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    lineHeight: 20,
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  breakdownCard: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '48%',
  },
  breakdownTitle: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    marginBottom: spacing.sm,
  },
  responseTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    color: defaultColors.text,
  },
  breakdownLabel: {
    fontSize: typography.xs,
    color: defaultColors.textMuted,
  },
  breakdownBar: {
    height: 4,
    backgroundColor: defaultColors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownBarYou: {
    height: '100%',
    backgroundColor: defaultColors.gradientStart,
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
    color: defaultColors.gradientStart,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: defaultColors.border,
  },
  shareButton: {
    flex: 1,
  },
  copyButton: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    backgroundColor: defaultColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Vibe Card styles
  vibeCard: {
    backgroundColor: defaultColors.surface,
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
    color: defaultColors.textSecondary,
    textAlign: 'center',
  },
  // Trend Card styles
  trendCard: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  trendTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trendLabel: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  trendScanCount: {
    fontSize: typography.xs,
    color: defaultColors.textMuted,
  },
  trendDescription: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    marginBottom: spacing.lg,
  },
  trendHistory: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: spacing.md,
  },
  trendHistoryItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  trendHistoryScore: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
  },
  trendHistoryDate: {
    fontSize: typography.xs,
    color: defaultColors.textMuted,
  },
  trendHistoryCurrent: {
    borderWidth: 2,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
