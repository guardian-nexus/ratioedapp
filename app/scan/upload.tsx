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
import { File } from 'expo-file-system/next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Logo from '@/components/Logo';
import GradientButton from '@/components/GradientButton';
import CreditBadge from '@/components/CreditBadge';
import { useCredits } from '@/hooks/useCredits';
import { track, Events } from '@/services/analytics';
import { colors as defaultColors, spacing, typography, borderRadius } from '@/theme';
import { useColors } from '@/hooks/useColors';

type ConversationType = 'oneOnOne' | 'group';
type UploadMethod = 'screenshots' | 'textFile';

const MAX_IMAGES = 8;

export default function Upload() {
  const insets = useSafeAreaInsets();
  const { credits, isSubscribed, canScan } = useCredits();
  const colors = useColors();
  const params = useLocalSearchParams<{ sharedImages?: string; prefillLabel?: string }>();

  const [conversationType, setConversationType] = useState<ConversationType>('oneOnOne');
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('screenshots');
  const [images, setImages] = useState<string[]>([]);
  const [label, setLabel] = useState(params.prefillLabel || '');
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
    // Validate input based on upload method
    if (uploadMethod === 'screenshots') {
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

    // Handle text file uploads
    if (uploadMethod === 'textFile' && chatExportFile) {
      try {
        const file = new File(chatExportFile.uri);
        const content = await file.text();
        router.push({
          pathname: '/scan/analyzing',
          params: {
            textContent: content,
            label,
            chatExportMode: conversationType === 'oneOnOne' ? '1' : '0',
            groupChatMode: conversationType === 'group' ? '1' : '0',
          },
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to read the chat export file. Please try again.');
        return;
      }
    } else {
      // Handle screenshots (1-on-1 only)
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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Logo size={24} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Upload</Text>
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
            style={[styles.labelInput, { backgroundColor: colors.surface, color: colors.text }]}
            placeholder="e.g., Jake from Hinge"
            placeholderTextColor={colors.textMuted}
            value={label}
            onChangeText={setLabel}
            maxLength={50}
          />
        </View>

        {/* Conversation Type Toggle */}
        <View style={[styles.modeToggleContainer, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.modeTab, conversationType === 'oneOnOne' && [styles.modeTabActive, { backgroundColor: colors.background }]]}
            onPress={() => {
              setConversationType('oneOnOne');
              // Reset to screenshots when switching to 1-on-1
              setUploadMethod('screenshots');
              setChatExportFile(null);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chatbubbles"
              size={16}
              color={conversationType === 'oneOnOne' ? colors.text : colors.textMuted}
            />
            <Text style={[styles.modeTabText, conversationType === 'oneOnOne' && [styles.modeTabTextActive, { color: colors.text }]]}>
              1-on-1
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, conversationType === 'group' && [styles.modeTabActive, { backgroundColor: colors.background }]]}
            onPress={() => {
              setConversationType('group');
              // Group only supports text file
              setUploadMethod('textFile');
              setImages([]);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="people"
              size={16}
              color={conversationType === 'group' ? colors.text : colors.textMuted}
            />
            <Text style={[styles.modeTabText, conversationType === 'group' && [styles.modeTabTextActive, { color: colors.text }]]}>
              Group Chat
            </Text>
          </TouchableOpacity>
        </View>

        {/* Upload Method Toggle (only for 1-on-1) */}
        {conversationType === 'oneOnOne' && (
          <View style={styles.uploadMethodContainer}>
            <TouchableOpacity
              style={[styles.uploadMethodTab, { borderColor: colors.border }, uploadMethod === 'screenshots' && styles.uploadMethodTabActive]}
              onPress={() => {
                setUploadMethod('screenshots');
                setChatExportFile(null);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="images"
                size={14}
                color={uploadMethod === 'screenshots' ? colors.gradientStart : colors.textMuted}
              />
              <Text style={[styles.uploadMethodText, uploadMethod === 'screenshots' && styles.uploadMethodTextActive]}>
                Screenshots
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadMethodTab, { borderColor: colors.border }, uploadMethod === 'textFile' && styles.uploadMethodTabActive]}
              onPress={() => {
                setUploadMethod('textFile');
                setImages([]);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="document-text"
                size={14}
                color={uploadMethod === 'textFile' ? colors.gradientStart : colors.textMuted}
              />
              <Text style={[styles.uploadMethodText, uploadMethod === 'textFile' && styles.uploadMethodTextActive]}>
                Text Export
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content based on conversation type and upload method */}
        {conversationType === 'oneOnOne' && uploadMethod === 'screenshots' && (
          <>
            {/* Roast Mode Toggle */}
            <TouchableOpacity
              style={[styles.roastToggle, { backgroundColor: colors.surface }]}
              onPress={() => {
                setRoastMode(!roastMode);
                track(Events.ROAST_MODE_TOGGLED, { enabled: !roastMode });
              }}
              activeOpacity={0.7}
            >
              <View style={styles.roastContent}>
                <Text style={styles.roastEmoji}>🔥</Text>
                <View>
                  <Text style={[styles.roastTitle, { color: colors.text }]}>Roast Mode</Text>
                  <Text style={[styles.roastSubtitle, { color: colors.textSecondary }]}>Get funny commentary</Text>
                </View>
              </View>
              <View style={[styles.toggle, { backgroundColor: colors.border }, roastMode && styles.toggleActive]}>
                <View style={[styles.toggleCircle, roastMode && styles.toggleCircleActive]} />
              </View>
            </TouchableOpacity>

            {/* Instructions */}
            <View style={styles.instructionsSection}>
              <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                Add 1-8 screenshots of your 1-on-1 conversation
              </Text>
              <Text style={[styles.creditNotice, { color: colors.textMuted }]}>Uses 1 scan credit</Text>
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
                        <View style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <Ionicons name="add" size={32} color={colors.textMuted} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {conversationType === 'oneOnOne' && uploadMethod === 'textFile' && (
          <>
            {/* Chat Export Instructions */}
            <View style={[styles.chatExportInfo, { backgroundColor: colors.surface }]}>
              <Text style={[styles.chatExportTitle, { color: colors.text }]}>Upload a chat export</Text>
              <Text style={[styles.chatExportDesc, { color: colors.textSecondary }]}>
                Export your 1-on-1 chat as a .txt file from any messaging app
              </Text>
              <View style={styles.chatExportSteps}>
                <Text style={[styles.chatExportStep, { color: colors.textMuted }]}>WhatsApp: Chat → More → Export Chat</Text>
                <Text style={[styles.chatExportStep, { color: colors.textMuted }]}>Telegram: Chat → Export Chat History</Text>
                <Text style={[styles.chatExportStep, { color: colors.textMuted }]}>Instagram: Settings → Your Activity → Download</Text>
                <Text style={[styles.chatExportStep, { color: colors.textMuted }]}>Messenger, Discord, Signal, etc.</Text>
              </View>
              <Text style={[styles.creditNotice, { color: colors.textMuted }]}>Uses 1 scan credit</Text>
            </View>

            {/* File Picker */}
            {chatExportFile ? (
              <View style={styles.selectedFileContainer}>
                <View style={[styles.selectedFile, { backgroundColor: colors.surface }]}>
                  <Ionicons name="document-text" size={24} color={colors.gradientStart} />
                  <Text style={[styles.selectedFileName, { color: colors.text }]} numberOfLines={1}>
                    {chatExportFile.name}
                  </Text>
                  <TouchableOpacity onPress={removeChatExport} style={styles.removeFileButton}>
                    <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={[styles.filePickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={pickChatExport} activeOpacity={0.7}>
                <Ionicons name="cloud-upload-outline" size={40} color={colors.textMuted} />
                <Text style={[styles.filePickerText, { color: colors.textMuted }]}>Tap to select a .txt file</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {conversationType === 'group' && (
          <>
            {/* Group Chat Instructions */}
            <View style={[styles.chatExportInfo, { backgroundColor: colors.surface }]}>
              <Text style={[styles.chatExportTitle, { color: colors.text }]}>Analyze a group chat</Text>
              <Text style={[styles.chatExportDesc, { color: colors.textSecondary }]}>
                See who's carrying the convo, who's a lurker, and who only sends memes
              </Text>
              <View style={styles.chatExportSteps}>
                <Text style={[styles.chatExportStep, { color: colors.textMuted }]}>WhatsApp: Group → Export Chat</Text>
                <Text style={[styles.chatExportStep, { color: colors.textMuted }]}>Telegram, Discord, Messenger, etc.</Text>
                <Text style={[styles.chatExportStep, { color: colors.textMuted }]}>Any .txt export with names + messages</Text>
              </View>
              {/* TODO: Uncomment when adding Android screenshot support for group chats
              <Text style={styles.chatExportNote}>
                📱 Screenshots coming soon — for now, export as text
              </Text>
              */}
              <Text style={[styles.creditNotice, { color: colors.textMuted }]}>Uses 1 scan credit</Text>
            </View>

            {/* File Picker */}
            {chatExportFile ? (
              <View style={styles.selectedFileContainer}>
                <View style={[styles.selectedFile, { backgroundColor: colors.surface }]}>
                  <Ionicons name="document-text" size={24} color={colors.gradientStart} />
                  <Text style={[styles.selectedFileName, { color: colors.text }]} numberOfLines={1}>
                    {chatExportFile.name}
                  </Text>
                  <TouchableOpacity onPress={removeChatExport} style={styles.removeFileButton}>
                    <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={[styles.filePickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={pickChatExport} activeOpacity={0.7}>
                <Ionicons name="cloud-upload-outline" size={40} color={colors.textMuted} />
                <Text style={[styles.filePickerText, { color: colors.textMuted }]}>Tap to select a .txt file</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <GradientButton
          title="Analyze"
          icon="analytics"
          onPress={handleAnalyze}
          disabled={uploadMethod === 'screenshots' ? images.length === 0 : !chatExportFile}
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
  labelSection: {
    marginBottom: spacing.lg,
  },
  labelInput: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: defaultColors.text,
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
    backgroundColor: defaultColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: defaultColors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
  },
  instructionsSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  instructionText: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  roastToggle: {
    backgroundColor: defaultColors.surface,
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
    color: defaultColors.text,
  },
  roastSubtitle: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: defaultColors.border,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: defaultColors.gradientStart,
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: defaultColors.text,
  },
  toggleCircleActive: {
    transform: [{ translateX: 22 }],
  },
  creditNotice: {
    fontSize: typography.sm,
    color: defaultColors.textMuted,
    textAlign: 'center',
  },
  bottomCta: {
    padding: spacing.lg,
    backgroundColor: defaultColors.background,
    borderTopWidth: 1,
    borderTopColor: defaultColors.border,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: defaultColors.surface,
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
    backgroundColor: defaultColors.background,
  },
  modeTabText: {
    fontSize: typography.sm,
    color: defaultColors.textMuted,
  },
  modeTabTextActive: {
    color: defaultColors.text,
    fontWeight: typography.medium,
  },
  chatExportInfo: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  chatExportTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: defaultColors.text,
    marginBottom: spacing.sm,
  },
  chatExportDesc: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
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
    color: defaultColors.textMuted,
    textAlign: 'left',
  },
  chatExportNote: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  uploadMethodContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  uploadMethodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: defaultColors.border,
    backgroundColor: 'transparent',
  },
  uploadMethodTabActive: {
    borderColor: defaultColors.gradientStart,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
  },
  uploadMethodText: {
    fontSize: typography.sm,
    color: defaultColors.textMuted,
  },
  uploadMethodTextActive: {
    color: defaultColors.gradientStart,
    fontWeight: typography.medium,
  },
  filePickerButton: {
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: defaultColors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  filePickerText: {
    fontSize: typography.sm,
    color: defaultColors.textMuted,
    marginTop: spacing.sm,
  },
  selectedFileContainer: {
    marginBottom: spacing.lg,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: defaultColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  selectedFileName: {
    flex: 1,
    fontSize: typography.md,
    color: defaultColors.text,
  },
  removeFileButton: {
    padding: spacing.xs,
  },
});
