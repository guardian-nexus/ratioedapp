import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

import Logo from '@/components/Logo';
import ShareCard from '@/components/ShareCard';
import GradientButton from '@/components/GradientButton';
import { getScan } from '@/services/supabase';
import { useColors } from '@/hooks/useColors';
import { track, Events } from '@/services/analytics';
import { colors as defaultColors, spacing, typography, borderRadius } from '@/theme';
import { AnalysisResult } from '@/types';

export default function Share() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const viewShotRef = useRef<ViewShot>(null);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadResult();
  }, [scanId]);

  const loadResult = async () => {
    if (!scanId) {
      Alert.alert('Error', 'No scan ID provided');
      router.back();
      return;
    }

    try {
      const data = await getScan(scanId);
      if (data) {
        setResult(data);
      } else {
        Alert.alert('Error', 'Scan not found');
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load scan');
      router.back();
    } finally {
      setLoading(false);
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

  const handleShareInstagram = async () => {
    if (!result) return;

    setSharing(true);
    track(Events.SHARE_TAPPED, { scan_id: scanId, platform: 'instagram' });

    try {
      const uri = await captureCard();
      if (!uri) {
        Alert.alert('Error', 'Failed to capture image');
        return;
      }

      // Check if Instagram is installed
      const instagramUrl = 'instagram://story-camera';
      const canOpen = await Linking.canOpenURL(instagramUrl);

      if (canOpen) {
        // For Instagram Stories, we need to save to camera roll first
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please allow access to your photo library to share to Instagram.'
          );
          return;
        }

        await MediaLibrary.saveToLibraryAsync(uri);

        // Open Instagram Stories
        await Linking.openURL(instagramUrl);

        Alert.alert(
          'Image Saved',
          'Your share card has been saved to your camera roll. Select it in Instagram Stories!',
          [{ text: 'OK' }]
        );
      } else {
        // Instagram not installed, use general share
        Alert.alert(
          'Instagram Not Found',
          'Instagram is not installed. Would you like to share another way?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Share', onPress: () => handleShareGeneral() },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share to Instagram');
    } finally {
      setSharing(false);
    }
  };

  const handleShareGeneral = async () => {
    if (!result) return;

    setSharing(true);
    track(Events.SHARE_TAPPED, { scan_id: scanId, platform: 'general' });

    try {
      const uri = await captureCard();
      if (!uri) {
        Alert.alert('Error', 'Failed to capture image');
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your Ratioed score',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleSaveToPhotos = async () => {
    if (!result) return;

    setSaving(true);
    track(Events.SHARE_TAPPED, { scan_id: scanId, platform: 'save' });

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to save images.'
        );
        return;
      }

      const uri = await captureCard();
      if (!uri) {
        Alert.alert('Error', 'Failed to capture image');
        return;
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Image saved to your camera roll!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save image');
    } finally {
      setSaving(false);
    }
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
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Logo size={24} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Share</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Preview */}
      <View style={styles.previewContainer}>
        <ViewShot
          ref={viewShotRef}
          options={{
            format: 'png',
            quality: 1,
            result: 'tmpfile',
          }}
        >
          <ShareCard result={result} />
        </ViewShot>
      </View>

      {/* Share Options */}
      <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + spacing.md, borderTopColor: colors.border }]}>
        <GradientButton
          title="Share to Instagram"
          icon="logo-instagram"
          onPress={handleShareInstagram}
          loading={sharing}
          disabled={sharing || saving}
        />

        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.surface }]}
            onPress={handleShareGeneral}
            disabled={sharing || saving}
          >
            <Ionicons name="share-outline" size={20} color={colors.text} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>More Options</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.surface }]}
            onPress={handleSaveToPhotos}
            disabled={sharing || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name="download-outline" size={20} color={colors.text} />
            )}
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: defaultColors.text,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  actionsContainer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: defaultColors.border,
    gap: spacing.md,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  secondaryButtonText: {
    fontSize: typography.sm,
    color: defaultColors.text,
    fontWeight: '500',
  },
});
