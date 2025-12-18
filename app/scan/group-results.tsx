import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import Logo from '@/components/Logo';
import GradientButton from '@/components/GradientButton';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { GroupChatResponse, GroupMemberAnalysis, GroupMemberTag } from '@/types';

export default function GroupResults() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ data?: string; label?: string }>();

  // Parse the data from params
  let data: GroupChatResponse | null = null;
  try {
    if (params.data) {
      data = JSON.parse(params.data) as GroupChatResponse;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to parse group results data:', error);
    }
  }

  if (!data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Failed to load results</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getTagColor = (sentiment: GroupMemberTag['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return colors.success;
      case 'negative':
        return colors.gradientStart;
      default:
        return colors.textSecondary;
    }
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const renderMemberCard = (member: GroupMemberAnalysis) => (
    <View key={member.name} style={styles.memberCard}>
      <View style={styles.memberHeader}>
        <View style={styles.memberRank}>
          <Text style={styles.rankText}>{getRankEmoji(member.rank)}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName} numberOfLines={1}>
            {member.name}
          </Text>
          <Text style={styles.memberPercentage}>
            {member.stats.percentage}% of messages
          </Text>
        </View>
        <View style={styles.memberStats}>
          <Text style={styles.statNumber}>{member.stats.messageCount}</Text>
          <Text style={styles.statLabel}>msgs</Text>
        </View>
      </View>

      {/* Tags */}
      <View style={styles.tagsContainer}>
        {member.tags.map((tag, index) => (
          <View
            key={index}
            style={[styles.tag, { borderColor: getTagColor(tag.sentiment) }]}
          >
            <Text style={styles.tagEmoji}>{tag.emoji}</Text>
            <Text style={[styles.tagLabel, { color: getTagColor(tag.sentiment) }]}>
              {tag.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Detailed Stats */}
      <View style={styles.detailedStats}>
        <View style={styles.detailStat}>
          <Text style={styles.detailValue}>{member.stats.wordCount}</Text>
          <Text style={styles.detailLabel}>words</Text>
        </View>
        <View style={styles.detailStat}>
          <Text style={styles.detailValue}>{member.stats.avgWordsPerMessage}</Text>
          <Text style={styles.detailLabel}>avg/msg</Text>
        </View>
        <View style={styles.detailStat}>
          <Text style={styles.detailValue}>{member.stats.questionCount}</Text>
          <Text style={styles.detailLabel}>questions</Text>
        </View>
        {member.stats.mediaCount > 0 && (
          <View style={styles.detailStat}>
            <Text style={styles.detailValue}>{member.stats.mediaCount}</Text>
            <Text style={styles.detailLabel}>media</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Logo size={24} />
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Ionicons name="people" size={32} color={colors.gradientStart} />
          <Text style={styles.title}>{params.label || 'Group Chat'}</Text>
          <Text style={styles.subtitle}>
            {data.totalParticipants} people · {data.totalMessages} messages
          </Text>
        </View>

        {/* Summary Card */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.summaryCard}
        >
          <Text style={styles.summaryText}>{data.summary}</Text>
        </LinearGradient>

        {/* Highlights */}
        {data.highlights.length > 0 && (
          <View style={styles.highlightsSection}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            {data.highlights.map((highlight, index) => (
              <View key={index} style={styles.highlightItem}>
                <Text style={styles.highlightBullet}>•</Text>
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Leaderboard */}
        <View style={styles.leaderboardSection}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          {data.members.map(renderMemberCard)}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { paddingBottom: insets.bottom + spacing.md }]}>
        <GradientButton
          title="Done"
          icon="checkmark"
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  errorText: {
    fontSize: typography.lg,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  backLink: {
    fontSize: typography.md,
    color: colors.gradientStart,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryText: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  highlightsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  highlightItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  highlightBullet: {
    fontSize: typography.md,
    color: colors.gradientStart,
    marginRight: spacing.sm,
  },
  highlightText: {
    flex: 1,
    fontSize: typography.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  leaderboardSection: {
    marginBottom: spacing.lg,
  },
  memberCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  rankText: {
    fontSize: typography.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  memberPercentage: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  memberStats: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    gap: 4,
  },
  tagEmoji: {
    fontSize: 12,
  },
  tagLabel: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },
  detailedStats: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailStat: {
    flex: 1,
    alignItems: 'center',
  },
  detailValue: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  detailLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  bottomCta: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
