import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Logo from '@/components/Logo';
import GradientButton from '@/components/GradientButton';
import CreditBadge from '@/components/CreditBadge';
import { useCredits } from '@/hooks/useCredits';
import { useColors } from '@/hooks/useColors';
import { track, Events } from '@/services/analytics';
import { colors as defaultColors, spacing, typography, borderRadius } from '@/theme';

const MAX_IMAGES = 8;

interface PersonData {
  label: string;
  images: string[];
}

export default function Compare() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { credits, isSubscribed, canCompare, canScan } = useCredits();

  // Check if coming from results screen with existing scan
  const params = useLocalSearchParams<{
    existingScanId?: string;
    existingLabel?: string;
  }>();
  const hasExistingScan = !!params.existingScanId;

  const [personA, setPersonA] = useState<PersonData>({
    label: params.existingLabel || '',
    images: []
  });
  const [personB, setPersonB] = useState<PersonData>({ label: '', images: [] });

  const pickImages = async (person: 'A' | 'B') => {
    const current = person === 'A' ? personA : personB;
    const remaining = MAX_IMAGES - current.images.length;

    if (remaining <= 0) {
      Alert.alert('Maximum reached', `You can only upload ${MAX_IMAGES} screenshots per person`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newImages = result.assets.map((asset) => asset.uri);
      const setter = person === 'A' ? setPersonA : setPersonB;

      setter((prev) => ({
        ...prev,
        images: [...prev.images, ...newImages].slice(0, MAX_IMAGES),
      }));

      track(Events.SCREENSHOT_ADDED, { count: newImages.length, person });
    }
  };

  const removeImage = (person: 'A' | 'B', index: number) => {
    const setter = person === 'A' ? setPersonA : setPersonB;
    setter((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleCompare = () => {
    // When coming from results, Person A is already scanned - only need Person B images
    if (hasExistingScan) {
      if (personB.images.length === 0) {
        Alert.alert('Missing screenshots', 'Please add screenshots for the second conversation');
        return;
      }

      // Only need 1 credit since Person A is already scanned
      if (!canScan) {
        router.push('/store/tokens');
        return;
      }

      track(Events.COMPARE_MODE_USED, { fromResults: true });

      // Navigate to analyzing with compare-with-existing mode
      router.push({
        pathname: '/scan/analyzing',
        params: {
          compareWithExisting: '1',
          existingScanId: params.existingScanId,
          labelA: personA.label || 'Person A',
          imagesB: JSON.stringify(personB.images),
          labelB: personB.label || 'Person B',
        },
      });
    } else {
      // Regular compare mode - both conversations are new
      if (personA.images.length === 0 || personB.images.length === 0) {
        Alert.alert('Missing screenshots', 'Please add screenshots for both conversations');
        return;
      }

      if (!canCompare) {
        router.push('/store/tokens');
        return;
      }

      track(Events.COMPARE_MODE_USED, { fromResults: false });

      // Navigate to analyzing with compare mode data
      router.push({
        pathname: '/scan/analyzing',
        params: {
          compareMode: '1',
          imagesA: JSON.stringify(personA.images),
          imagesB: JSON.stringify(personB.images),
          labelA: personA.label || 'Person A',
          labelB: personB.label || 'Person B',
        },
      });
    }
  };

  // Locked section for pre-filled Person A (when coming from results)
  const renderLockedPersonSection = () => (
    <View style={[styles.personSection, styles.lockedSection, { backgroundColor: colors.surface }]}>
      <View style={styles.personHeader}>
        <Text style={[styles.personTitle, { color: colors.text }]}>Person A</Text>
        <View style={styles.lockedLabelContainer}>
          <Text style={[styles.lockedLabel, { color: colors.text }]}>{personA.label || 'Person A'}</Text>
          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
        </View>
      </View>

      <View style={styles.lockedContent}>
        <View style={styles.lockedIconContainer}>
          <Ionicons name="checkmark-circle" size={32} color={colors.success} />
        </View>
        <Text style={[styles.lockedText, { color: colors.text }]}>Already scanned</Text>
        <Text style={[styles.lockedSubtext, { color: colors.textSecondary }]}>Results from your previous scan will be used</Text>
      </View>
    </View>
  );

  const renderPersonSection = (
    person: 'A' | 'B',
    data: PersonData,
    setData: React.Dispatch<React.SetStateAction<PersonData>>
  ) => (
    <View style={[styles.personSection, { backgroundColor: colors.surface }]}>
      <View style={styles.personHeader}>
        <Text style={[styles.personTitle, { color: colors.text }]}>Person {person}</Text>
        <TextInput
          style={[styles.personLabel, { backgroundColor: colors.background, color: colors.text }]}
          placeholder={`e.g., ${person === 'A' ? 'Jake' : 'Mike'}`}
          placeholderTextColor={colors.textMuted}
          value={data.label}
          onChangeText={(text) => setData((prev) => ({ ...prev, label: text }))}
          maxLength={20}
        />
      </View>

      <View style={styles.imageGrid}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
          const image = data.images[index];
          return (
            <TouchableOpacity
              key={index}
              style={styles.gridItem}
              onPress={image ? () => removeImage(person, index) : () => pickImages(person)}
              activeOpacity={0.7}
            >
              {image ? (
                <>
                  <Image source={{ uri: image }} style={styles.thumbnail} />
                  <View style={styles.removeButton}>
                    <Ionicons name="close" size={12} color={colors.text} />
                  </View>
                </>
              ) : (
                <View style={[styles.placeholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="add" size={20} color={colors.textMuted} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.gridHint, { color: colors.textMuted }]}>Add 1-8 screenshots</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Logo size={24} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Compare</Text>
        </View>
        <CreditBadge credits={credits} isSubscribed={isSubscribed} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {hasExistingScan
            ? 'Add screenshots from another conversation to compare'
            : 'Upload screenshots from two different conversations to see who\'s putting in more effort'}
        </Text>

        {hasExistingScan ? renderLockedPersonSection() : renderPersonSection('A', personA, setPersonA)}

        <View style={styles.vsContainer}>
          <View style={[styles.vsLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.vsText, { color: colors.textSecondary }]}>VS</Text>
          <View style={[styles.vsLine, { backgroundColor: colors.border }]} />
        </View>

        {renderPersonSection('B', personB, setPersonB)}

        <Text style={[styles.creditNotice, { color: colors.textMuted }]}>
          Uses {hasExistingScan ? '1 scan credit' : '2 scan credits'}
        </Text>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <GradientButton
          title="Compare"
          icon="git-compare"
          onPress={handleCompare}
          disabled={hasExistingScan
            ? personB.images.length === 0
            : personA.images.length === 0 || personB.images.length === 0}
        />
      </View>
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
  description: {
    fontSize: typography.md,
    color: defaultColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  personSection: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  lockedSection: {
    borderWidth: 1,
    borderColor: defaultColors.success + '40',
  },
  lockedLabelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  lockedLabel: {
    color: defaultColors.text,
    fontSize: typography.sm,
  },
  lockedContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  lockedIconContainer: {
    marginBottom: spacing.sm,
  },
  lockedText: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: defaultColors.text,
    marginBottom: spacing.xs,
  },
  lockedSubtext: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    textAlign: 'center',
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  personTitle: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: defaultColors.text,
  },
  personLabel: {
    flex: 1,
    backgroundColor: defaultColors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: defaultColors.text,
    fontSize: typography.sm,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  gridItem: {
    width: '23%',
    aspectRatio: 9 / 16,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: defaultColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: defaultColors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.sm,
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridHint: {
    fontSize: typography.xs,
    color: defaultColors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: defaultColors.border,
  },
  vsText: {
    marginHorizontal: spacing.md,
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: defaultColors.textSecondary,
  },
  creditNotice: {
    fontSize: typography.sm,
    color: defaultColors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  bottomCta: {
    padding: spacing.lg,
    backgroundColor: defaultColors.background,
    borderTopWidth: 1,
    borderTopColor: defaultColors.border,
  },
});
