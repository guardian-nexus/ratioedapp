import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GradientButton from '@/components/GradientButton';
import GradientText from '@/components/GradientText';
import CreditBadge from '@/components/CreditBadge';
import { useCredits } from '@/hooks/useCredits';
import { useColors } from '@/hooks/useColors';
import { spacing, typography, borderRadius, colors as defaultColors } from '@/theme';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { credits, isSubscribed, canScan, canCompare } = useCredits();
  const colors = useColors();

  const handleUpload = () => {
    if (!canScan) {
      router.push('/store/tokens');
      return;
    }
    router.push('/scan/upload');
  };

  const handleCompare = () => {
    if (!canCompare) {
      router.push('/store/tokens');
      return;
    }
    router.push('/scan/compare');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <CreditBadge
          credits={credits}
          isSubscribed={isSubscribed}
          onPress={() => router.push('/store/tokens')}
        />
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require('@/assets/r-mark.png')}
            style={styles.logoMark}
            resizeMode="contain"
          />
        </View>

        {/* Tagline */}
        <View style={styles.taglineSection}>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>are they</Text>
          <GradientText style={styles.taglineGradient}>matching</GradientText>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>your energy?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Upload your texts. Get the receipts.
          </Text>
        </View>

        {/* Preview Card */}
        <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
          <View style={styles.previewRow}>
            <View style={styles.previewStat}>
              <GradientText style={styles.previewValue}>47</GradientText>
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>YOU SENT</Text>
            </View>
            <View style={[styles.previewDivider, { backgroundColor: colors.border }]} />
            <View style={styles.previewStat}>
              <GradientText style={styles.previewValue}>12</GradientText>
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>THEY SENT</Text>
            </View>
            <View style={[styles.previewDivider, { backgroundColor: colors.border }]} />
            <View style={styles.previewStat}>
              <GradientText style={styles.previewValue}>3.9x</GradientText>
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>RATIO</Text>
            </View>
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={styles.ctaSection}>
          <GradientButton
            title="Upload Screenshots"
            icon="camera"
            onPress={handleUpload}
            style={styles.primaryButton}
          />
          <GradientButton
            title="Compare Two Convos"
            icon="git-compare"
            onPress={handleCompare}
            variant="outline"
            badge="2 tokens"
            style={styles.secondaryButton}
          />
        </View>

        {/* Supported Apps */}
        <View style={styles.appsSection}>
          <Text style={[styles.appsTitle, { color: colors.text }]}>Works with any chat app</Text>
          <Text style={[styles.appsList, { color: colors.textSecondary }]}>
            iMessage  WhatsApp  Instagram  Discord  Tinder  Slack  more
          </Text>
          <Text style={[styles.privacyText, { color: colors.textMuted }]}>Screenshots never stored</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background,
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  logoMark: {
    width: 120,
    height: 120,
  },
  taglineSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  tagline: {
    fontSize: typography.xl,
    color: defaultColors.textSecondary,
    textAlign: 'center',
  },
  taglineGradient: {
    fontSize: 36,
    fontWeight: typography.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.md,
    color: defaultColors.textSecondary,
    marginTop: spacing.lg,
  },
  previewCard: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  previewStat: {
    alignItems: 'center',
  },
  previewValue: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
  },
  previewLabel: {
    fontSize: typography.xs,
    color: defaultColors.textSecondary,
    marginTop: spacing.xs,
  },
  previewDivider: {
    width: 1,
    height: 40,
    backgroundColor: defaultColors.border,
  },
  ctaSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  primaryButton: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
  },
  appsSection: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  appsTitle: {
    fontSize: typography.sm,
    color: defaultColors.text,
    marginBottom: spacing.sm,
  },
  appsList: {
    fontSize: typography.xs,
    color: defaultColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  privacyText: {
    fontSize: typography.xs,
    color: defaultColors.textMuted,
  },
});
