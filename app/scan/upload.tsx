import React, { useState, useEffect } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Logo from '@/components/Logo';
import GradientButton from '@/components/GradientButton';
import CreditBadge from '@/components/CreditBadge';
import { useCredits } from '@/hooks/useCredits';
import { track, Events } from '@/services/analytics';
import { colors, spacing, typography, borderRadius } from '@/theme';

type UploadMode = 'screenshots' | 'chatExport' | 'groupChat';

const MAX_IMAGES = 8;

export default function Upload() {
  const insets = useSafeAreaInsets();
  const { credits, isSubscribed, canScan } = useCredits();
  const params = useLocalSearchParams<{ sharedImages?: string }>();

  const [uploadMode, setUploadMode] = useState<UploadMode>('screenshots');
  const [images, setImages] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const [roastMode, setRoastMode] = useState(false);
  const [chatExportFile, setChatExportFile] = useState<{ name: string; uri: string } | null>(null);

  // Handle shared images from share extension
  useEffect(() => {
    if (params.sharedImages) {
      try {
        const sharedImageUris = JSON.parse(params.sharedImages) as string[];
        if (sharedImageUris.length > 0) {
          setImages(sharedImageUris.slice(0, MAX_IMAGES));
          track(Events.SCREENSHOT_ADDED, {
            count: sharedImageUris.length,
            source: 'share_extension',
          });
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Failed to parse shared images:', error);
        }
      }
    }
  }, [params.sharedImages]);

  const pickImages = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert('Maximum reached', `You can only upload ${MAX_IMAGES} screenshots`);
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
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
      track(Events.SCREENSHOT_ADDED, { count: newImages.length });
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const pickChatExport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/plain',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setChatExportFile({ name: file.name, uri: file.uri });
        track(Events.SCREENSHOT_ADDED, { type: 'chat_export', fileName: file.name });
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to pick document:', error);
      }
      Alert.alert('Error', 'Failed to select file. Please try again.');
    }
  };

  const removeChatExport = () => {
    setChatExportFile(null);
  };

  const handleAnalyze = async () => {
    if (uploadMode === 'screenshots') {
      if (images.length === 0) {
        Alert.alert('No screenshots', 'Please add at least one screenshot');
        return;
      }
    } else {
      if (!chatExportFile) {
        Alert.alert('No file selected', 'Please select a chat export file');
        return;
      }
    }

    if (!canScan) {
      router.push('/store/tokens');
      return;
    }

    if (uploadMode === 'chatExport' && chatExportFile) {
      // Read the file content and pass it to analyzing
      try {
        const content = await FileSystem.readAsStringAsync(chatExportFile.uri);
        router.push({
          pathname: '/scan/analyzing',
          params: {
            textContent: content,
            label,
            chatExportMode: '1',
          },
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to read the chat export file. Please try again.');
        return;
      }
    } else if (uploadMode === 'groupChat' && chatExportFile) {
      // Read the file content and pass it to analyzing for group chat
      try {
        const content = await FileSystem.readAsStringAsync(chatExportFile.uri);
        router.push({
          pathname: '/scan/analyzing',
          params: {
            textContent: content,
            label,
            groupChatMode: '1',
          },
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to read the chat export file. Please try again.');
        return;
      }
    } else {
      // Navigate to analyzing with image data
      router.push({
        pathname: '/scan/analyzing',
        params: {
          images: JSON.stringify(images),
          label,
          roastMode: roastMode ? '1' : '0',
        },
      });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Logo size={24} />
          <Text style={styles.headerTitle}>Upload</Text>
        </View>
        <CreditBadge credits={credits} isSubscribed={isSubscribed} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Label Input */}
        <View style={styles.labelSection}>
          <TextInput
            style={styles.labelInput}
            placeholder="e.g., Jake from Hinge"
            placeholderTextColor={colors.textMuted}
            value={label}
            onChangeText={setLabel}
            maxLength={50}
          />
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity
            style={[styles.modeTab, uploadMode === 'screenshots' && styles.modeTabActive]}
            onPress={() => setUploadMode('screenshots')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="images"
              size={16}
              color={uploadMode === 'screenshots' ? colors.text : colors.textMuted}
            />
            <Text style={[styles.modeTabText, uploadMode === 'screenshots' && styles.modeTabTextActive]}>
              Screenshots
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, uploadMode === 'chatExport' && styles.modeTabActive]}
            onPress={() => setUploadMode('chatExport')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="document-text"
              size={16}
              color={uploadMode === 'chatExport' ? colors.text : colors.textMuted}
            />
            <Text style={[styles.modeTabText, uploadMode === 'chatExport' && styles.modeTabTextActive]}>
              1-on-1
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, uploadMode === 'groupChat' && styles.modeTabActive]}
            onPress={() => setUploadMode('groupChat')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="people"
              size={16}
              color={uploadMode === 'groupChat' ? colors.text : colors.textMuted}
            />
            <Text style={[styles.modeTabText, uploadMode === 'groupChat' && styles.modeTabTextActive]}>
              Group
            </Text>
          </TouchableOpacity>
        </View>

        {uploadMode === 'screenshots' ? (
          <>
            {/* Roast Mode Toggle */}
            <TouchableOpacity
              style={styles.roastToggle}
              onPress={() => {
                setRoastMode(!roastMode);
                track(Events.ROAST_MODE_TOGGLED, { enabled: !roastMode });
              }}
              activeOpacity={0.7}
            >
              <View style={styles.roastContent}>
                <Text style={styles.roastEmoji}>🔥</Text>
                <View>
                  <Text style={styles.roastTitle}>Roast Mode</Text>
                  <Text style={styles.roastSubtitle}>Get funny commentary</Text>
                </View>
              </View>
              <View style={[styles.toggle, roastMode && styles.toggleActive]}>
                <View style={[styles.toggleCircle, roastMode && styles.toggleCircleActive]} />
              </View>
            </TouchableOpacity>

            {/* Instructions */}
            <View style={styles.instructionsSection}>
              <Text style={styles.instructionText}>
                Add 1-8 screenshots of your conversation
              </Text>
              <Text style={styles.creditNotice}>Uses 1 scan credit</Text>
            </View>

            {/* Image Grid */}
            <View style={styles.gridContainer}>
              <View style={styles.grid}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
                  const image = images[index];
                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.gridItem}
                      onPress={image ? () => removeImage(index) : pickImages}
                      activeOpacity={0.7}
                    >
                      {image ? (
                        <>
                          <Image source={{ uri: image }} style={styles.image} />
                          <View style={styles.removeButton}>
                            <Ionicons name="close" size={16} color={colors.text} />
                          </View>
                        </>
                      ) : (
                        <View style={styles.placeholder}>
                          <Ionicons name="add" size={32} color={colors.textMuted} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        ) : uploadMode === 'chatExport' ? (
          <>
            {/* Chat Export Instructions */}
            <View style={styles.chatExportInfo}>
              <Text style={styles.chatExportTitle}>Upload a chat export</Text>
              <Text style={styles.chatExportDesc}>
                Export your 1-on-1 chat as a .txt file from any messaging app
              </Text>
              <View style={styles.chatExportSteps}>
                <Text style={styles.chatExportStep}>WhatsApp: Chat → More → Export Chat</Text>
                <Text style={styles.chatExportStep}>Telegram: Chat → Export Chat History</Text>
                <Text style={styles.chatExportStep}>Instagram: Settings → Your Activity → Download</Text>
                <Text style={styles.chatExportStep}>Messenger, Discord, Signal, etc.</Text>
              </View>
              <Text style={styles.creditNotice}>Uses 1 scan credit</Text>
            </View>

            {/* File Picker */}
            {chatExportFile ? (
              <View style={styles.selectedFileContainer}>
                <View style={styles.selectedFile}>
                  <Ionicons name="document-text" size={24} color={colors.gradientStart} />
                  <Text style={styles.selectedFileName} numberOfLines={1}>
                    {chatExportFile.name}
                  </Text>
                  <TouchableOpacity onPress={removeChatExport} style={styles.removeFileButton}>
                    <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.filePickerButton} onPress={pickChatExport} activeOpacity={0.7}>
                <Ionicons name="cloud-upload-outline" size={40} color={colors.textMuted} />
                <Text style={styles.filePickerText}>Tap to select a .txt file</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {/* Group Chat Instructions */}
            <View style={styles.chatExportInfo}>
              <Text style={styles.chatExportTitle}>Analyze a group chat</Text>
              <Text style={styles.chatExportDesc}>
                See who's carrying the convo, who's a lurker, and who only sends memes
              </Text>
              <View style={styles.chatExportSteps}>
                <Text style={styles.chatExportStep}>WhatsApp: Group → Export Chat</Text>
                <Text style={styles.chatExportStep}>Telegram, Discord, Messenger, etc.</Text>
                <Text style={styles.chatExportStep}>Any .txt export with names + messages</Text>
              </View>
              <Text style={styles.creditNotice}>Uses 1 scan credit</Text>
            </View>

            {/* File Picker */}
            {chatExportFile ? (
              <View style={styles.selectedFileContainer}>
                <View style={styles.selectedFile}>
                  <Ionicons name="document-text" size={24} color={colors.gradientStart} />
                  <Text style={styles.selectedFileName} numberOfLines={1}>
                    {chatExportFile.name}
                  </Text>
                  <TouchableOpacity onPress={removeChatExport} style={styles.removeFileButton}>
                    <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.filePickerButton} onPress={pickChatExport} activeOpacity={0.7}>
                <Ionicons name="cloud-upload-outline" size={40} color={colors.textMuted} />
                <Text style={styles.filePickerText}>Tap to select a .txt file</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { paddingBottom: insets.bottom + spacing.md }]}>
        <GradientButton
          title="Analyze"
          icon="analytics"
          onPress={handleAnalyze}
          disabled={uploadMode === 'screenshots' ? images.length === 0 : !chatExportFile}
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
  labelSection: {
    marginBottom: spacing.lg,
  },
  labelInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.md,
  },
  gridContainer: {
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 9 / 16,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
  },
  instructionsSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  instructionText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  roastToggle: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  roastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  roastEmoji: {
    fontSize: 24,
  },
  roastTitle: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  roastSubtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: colors.gradientStart,
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
  },
  toggleCircleActive: {
    transform: [{ translateX: 22 }],
  },
  creditNotice: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  bottomCta: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  modeTabActive: {
    backgroundColor: colors.background,
  },
  modeTabText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  modeTabTextActive: {
    color: colors.text,
    fontWeight: typography.medium,
  },
  chatExportInfo: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  chatExportTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chatExportDesc: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  chatExportSteps: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chatExportStep: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'left',
  },
  filePickerButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  filePickerText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  selectedFileContainer: {
    marginBottom: spacing.lg,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  selectedFileName: {
    flex: 1,
    fontSize: typography.md,
    color: colors.text,
  },
  removeFileButton: {
    padding: spacing.xs,
  },
});
