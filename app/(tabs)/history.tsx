import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import Logo from '@/components/Logo';
import { getScanHistory, deleteScan, deleteAllScans } from '@/services/supabase';
import { useColors } from '@/hooks/useColors';
import { getScoreColor, getScoreLabel, colors as defaultColors, spacing, typography, borderRadius } from '@/theme';
import { AnalysisResult } from '@/types';

// Unified history item type
type HistoryItem =
  | { type: 'single'; scan: AnalysisResult }
  | { type: 'compare'; compareId: string; scans: AnalysisResult[] };

export default function History() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [scans, setScans] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadScans = useCallback(async () => {
    try {
      const history = await getScanHistory();
      setScans(history);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to load history:', error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Group scans into history items (singles and compare pairs)
  const historyItems = useMemo((): HistoryItem[] => {
    const compareGroups = new Map<string, AnalysisResult[]>();
    const singles: AnalysisResult[] = [];

    scans.forEach((scan) => {
      if (scan.compareId) {
        const group = compareGroups.get(scan.compareId) || [];
        group.push(scan);
        compareGroups.set(scan.compareId, group);
      } else {
        singles.push(scan);
      }
    });

    const items: HistoryItem[] = [];

    // Add compare groups
    compareGroups.forEach((groupScans, compareId) => {
      // Only treat as compare if we have exactly 2 scans
      if (groupScans.length === 2) {
        items.push({
          type: 'compare',
          compareId,
          scans: groupScans.sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
        });
      } else {
        // If not exactly 2, treat them as singles
        groupScans.forEach((scan) => items.push({ type: 'single', scan }));
      }
    });

    // Add singles
    singles.forEach((scan) => items.push({ type: 'single', scan }));

    // Sort by most recent
    items.sort((a, b) => {
      const dateA = a.type === 'single' ? a.scan.createdAt : a.scans[0].createdAt;
      const dateB = b.type === 'single' ? b.scan.createdAt : b.scans[0].createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return items;
  }, [scans]);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadScans();
    }, [loadScans])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadScans();
  };

  const handleDeleteScan = (id: string, label?: string) => {
    Alert.alert(
      'Delete Scan',
      `Are you sure you want to delete ${label || 'this scan'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteScan(id);
              setScans((prev) => prev.filter((s) => s.id !== id));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete scan');
            }
          },
        },
      ]
    );
  };

  const handleDeleteCompare = (item: HistoryItem & { type: 'compare' }) => {
    const labelA = item.scans[0].chatLabel || 'Person A';
    const labelB = item.scans[1].chatLabel || 'Person B';

    Alert.alert(
      'Delete Comparison',
      `Are you sure you want to delete this comparison between ${labelA} and ${labelB}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(item.scans.map((s) => deleteScan(s.id)));
              setScans((prev) => prev.filter((s) => s.compareId !== item.compareId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete comparison');
            }
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    if (scans.length === 0) return;

    Alert.alert(
      'Clear All History',
      'Are you sure you want to delete all your scans? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllScans();
              setScans([]);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear history');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderSingleScan = (scan: AnalysisResult) => {
    const scoreColor = getScoreColor(scan.score);
    const label = getScoreLabel(scan.score);

    return (
      <TouchableOpacity
        style={[styles.scanCard, { backgroundColor: colors.surface }]}
        onPress={() => router.push(`/scan/results/${scan.id}`)}
        onLongPress={() => handleDeleteScan(scan.id, scan.chatLabel)}
        activeOpacity={0.7}
      >
        <View style={styles.scanHeader}>
          <Text style={[styles.scanLabel, { color: colors.text }]} numberOfLines={1}>
            {scan.chatLabel || 'Untitled'}
          </Text>
          <Text style={[styles.scanDate, { color: colors.textMuted }]}>{formatDate(scan.createdAt)}</Text>
        </View>
        <View style={styles.scanContent}>
          <View style={styles.scoreContainer}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {scan.score}
            </Text>
            <View style={[styles.labelBadge, { backgroundColor: scoreColor + '20' }]}>
              <Text style={[styles.labelText, { color: scoreColor }]}>{label}</Text>
            </View>
          </View>
          <Text style={[styles.summaryText, { color: colors.textSecondary }]} numberOfLines={2}>
            {scan.summary}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCompare = (item: HistoryItem & { type: 'compare' }) => {
    const scanA = item.scans[0];
    const scanB = item.scans[1];
    const labelA = scanA.chatLabel || 'Person A';
    const labelB = scanB.chatLabel || 'Person B';

    return (
      <TouchableOpacity
        style={[styles.compareCard, { backgroundColor: colors.surface }]}
        onPress={() =>
          router.push({
            pathname: '/scan/compare-results',
            params: {
              scanIdA: scanA.id,
              scanIdB: scanB.id,
              labelA,
              labelB,
            },
          })
        }
        onLongPress={() => handleDeleteCompare(item)}
        activeOpacity={0.7}
      >
        {/* Compare badge */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.compareBadge}
        >
          <Ionicons name="git-compare" size={10} color={colors.background} />
          <Text style={styles.compareBadgeText}>COMPARE</Text>
        </LinearGradient>

        <View style={styles.scanHeader}>
          <Text style={[styles.scanLabel, { color: colors.text }]} numberOfLines={1}>
            {labelA} vs {labelB}
          </Text>
          <Text style={[styles.scanDate, { color: colors.textMuted }]}>{formatDate(scanA.createdAt)}</Text>
        </View>

        <View style={styles.compareScores}>
          <View style={styles.compareScoreItem}>
            <Text style={[styles.comparePersonLabel, { color: colors.textSecondary }]}>{labelA}</Text>
            <Text style={[styles.compareScore, { color: getScoreColor(scanA.score) }]}>
              {scanA.score}
            </Text>
          </View>
          <Text style={[styles.vsText, { color: colors.textMuted }]}>vs</Text>
          <View style={styles.compareScoreItem}>
            <Text style={[styles.comparePersonLabel, { color: colors.textSecondary }]}>{labelB}</Text>
            <Text style={[styles.compareScore, { color: getScoreColor(scanB.score) }]}>
              {scanB.score}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => {
    if (item.type === 'compare') {
      return renderCompare(item);
    }
    return renderSingleScan(item.scan);
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="folder-open-outline" size={64} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No scans yet</Text>
      <Text style={styles.emptySubtitle}>
        Your conversation analyses will appear here
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Logo size={28} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>History</Text>
        </View>
        {scans.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={[styles.clearText, { color: colors.gradientStart }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* History List */}
      <FlatList
        data={historyItems}
        renderItem={renderHistoryItem}
        keyExtractor={(item) =>
          item.type === 'compare' ? item.compareId : item.scan.id
        }
        contentContainerStyle={[
          styles.listContent,
          historyItems.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.gradientStart}
          />
        }
        showsVerticalScrollIndicator={false}
      />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: defaultColors.text,
  },
  clearText: {
    fontSize: typography.sm,
    color: defaultColors.error,
  },
  listContent: {
    padding: spacing.lg,
  },
  emptyList: {
    flex: 1,
  },
  scanCard: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  scanLabel: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: defaultColors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  scanDate: {
    fontSize: typography.xs,
    color: defaultColors.textMuted,
  },
  scanContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
  },
  labelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  labelText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
  summaryText: {
    flex: 1,
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: defaultColors.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  compareCard: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: defaultColors.gradientStart + '40',
    position: 'relative',
    overflow: 'hidden',
  },
  compareBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderBottomLeftRadius: borderRadius.sm,
  },
  compareBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: defaultColors.background,
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
  comparePersonLabel: {
    fontSize: typography.xs,
    color: defaultColors.textSecondary,
    marginBottom: 2,
  },
  compareScore: {
    fontSize: typography.xxl,
    fontWeight: '700',
  },
  vsText: {
    fontSize: typography.sm,
    color: defaultColors.textMuted,
    fontWeight: '600',
  },
});
