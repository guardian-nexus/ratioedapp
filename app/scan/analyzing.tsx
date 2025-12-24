import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Animated } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Logo from '@/components/Logo';
import { analyzeConversation, analyzeTextContent, analyzeGroupChat, getErrorMessage, isMaintenanceError } from '@/services/claude';
import { saveScan } from '@/services/supabase';
import { useCredits } from '@/hooks/useCredits';
import { useColors } from '@/hooks/useColors';
import { track, Events, trackScanStarted, trackScanCompleted, trackError } from '@/services/analytics';
import { colors as defaultColors, spacing, typography } from '@/theme';
import { GroupChatResponse } from '@/types';

// Note: Token deduction happens server-side in the analyze-scan edge function

const TIPS = [
  'Upload up to 8 screenshots for better analysis',
  // TODO: Uncomment when targeting Android
  // 'Android users can use "Scroll capture" for longer convos',
  'Works best with 1-on-1 conversations',
  'The more messages, the more accurate the score',
  'Share your results to see what friends think',
];

const STEPS = [
  'Extracting messages',
  'Analyzing conversation',
  'Generating insights',
];

export default function Analyzing() {
  const params = useLocalSearchParams<{
    images?: string;
    label?: string;
    roastMode?: string;
    // Compare mode params
    compareMode?: string;
    imagesA?: string;
    imagesB?: string;
    labelA?: string;
    labelB?: string;
    // Compare with existing scan params (from results screen)
    compareWithExisting?: string;
    existingScanId?: string;
    // Chat export mode params
    textContent?: string;
    chatExportMode?: string;
    // Group chat mode params
    groupChatMode?: string;
  }>();

  const isCompareMode = params.compareMode === '1';
  const isCompareWithExisting = params.compareWithExisting === '1';
  const isChatExportMode = params.chatExportMode === '1';
  const isGroupChatMode = params.groupChatMode === '1';
  const colors = useColors();
  const { refreshCredits } = useCredits();

  // Calculate image count for dynamic wait message
  const getImageCount = (): number => {
    if (isCompareMode) {
      const imagesA = JSON.parse(params.imagesA || '[]') as string[];
      const imagesB = JSON.parse(params.imagesB || '[]') as string[];
      return imagesA.length + imagesB.length;
    } else if (isCompareWithExisting) {
      const imagesB = JSON.parse(params.imagesB || '[]') as string[];
      return imagesB.length;
    } else if (params.images) {
      const images = JSON.parse(params.images || '[]') as string[];
      return images.length;
    }
    return 0;
  };

  const getWaitMessage = (): string => {
    if (isChatExportMode || isGroupChatMode) {
      return 'Reading through your conversation...';
    }
    const count = getImageCount();
    if (count <= 2) {
      return 'This usually takes about a minute';
    } else if (count <= 5) {
      return 'This usually takes 1-2 minutes';
    } else {
      return 'More screenshots = more to read — hang tight!';
    }
  };
  const [currentTip, setCurrentTip] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const hasStarted = useRef(false);

  // Pulsing animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  // Start pulsing animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Rotate tips (every 6 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % TIPS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Run analysis
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    runAnalysis();
  }, []);

  const runAnalysis = async () => {
    try {
      if (isCompareWithExisting) {
        await runCompareWithExistingAnalysis();
      } else if (isCompareMode) {
        await runCompareAnalysis();
      } else if (isGroupChatMode) {
        await runGroupChatAnalysis();
      } else if (isChatExportMode) {
        await runChatExportAnalysis();
      } else {
        await runSingleAnalysis();
      }
    } catch (error) {
      const message = getErrorMessage(error);
      trackError('scan_failed', message);
      track(Events.SCAN_FAILED, { error: message });

      // Handle specific errors
      if (message.includes('scan credits')) {
        Alert.alert('Not Enough Credits', message, [
          { text: 'Get More', onPress: () => router.replace('/store/tokens') },
        ]);
        return;
      }

      // Handle rate limiting with retry option
      if (error instanceof Error && error.message === 'RATE_LIMITED') {
        Alert.alert(
          'High Demand',
          "We're experiencing high traffic right now. Want to try again?",
          [
            { text: 'Go Back', style: 'cancel', onPress: () => router.back() },
            { text: 'Try Again', onPress: () => runAnalysis() },
          ]
        );
        return;
      }

      // Handle maintenance/API errors with a friendlier message
      if (isMaintenanceError(error)) {
        Alert.alert(
          'Service Temporarily Unavailable',
          message,
          [
            { text: 'Go Back', onPress: () => router.back() },
          ]
        );
        return;
      }

      Alert.alert('Analysis Failed', message, [
        { text: 'Try Again', onPress: () => router.back() },
      ]);
    }
  };

  const runSingleAnalysis = async () => {
    const images = JSON.parse(params.images || '[]') as string[];
    const roastMode = params.roastMode === '1';
    const label = params.label || undefined;

    if (images.length === 0) {
      throw new Error('No images provided');
    }

    // Track start
    trackScanStarted(images.length, roastMode);

    // Step 1: Extracting messages
    setCurrentStep(0);
    await new Promise((r) => setTimeout(r, 500));

    // Step 2: Analyzing conversation
    setCurrentStep(1);
    const result = await analyzeConversation(images, roastMode);

    // Step 3: Generating insights / Saving
    setCurrentStep(2);
    const saved = await saveScan(result, label, images.length);

    // Track completion
    trackScanCompleted(result.score, roastMode);

    // Refresh credits (token was deducted server-side)
    await refreshCredits();

    // Navigate to results
    router.replace(`/scan/results/${saved.id}`);
  };

  const runGroupChatAnalysis = async () => {
    const textContent = params.textContent || '';
    const label = params.label || 'Group Chat';

    if (!textContent) {
      throw new Error('No text content provided');
    }

    // Track start
    track(Events.SCAN_STARTED, { mode: 'group_chat' });

    // Step 1: Parsing messages
    setCurrentStep(0);
    await new Promise((r) => setTimeout(r, 300));

    // Step 2: Analyzing conversation
    setCurrentStep(1);
    const result: GroupChatResponse = await analyzeGroupChat(textContent);

    // Step 3: Done
    setCurrentStep(2);

    // Track completion
    track(Events.SCAN_COMPLETED, { mode: 'group_chat', participants: result.totalParticipants });

    // Refresh credits
    await refreshCredits();

    // Navigate to group results with data
    router.replace({
      pathname: '/scan/group-results',
      params: {
        data: JSON.stringify(result),
        label,
      },
    });
  };

  const runChatExportAnalysis = async () => {
    const textContent = params.textContent || '';
    const label = params.label || undefined;

    if (!textContent) {
      throw new Error('No text content provided');
    }

    // Track start
    track(Events.SCAN_STARTED, { mode: 'chat_export' });

    // Step 1: Parsing messages
    setCurrentStep(0);
    await new Promise((r) => setTimeout(r, 300));

    // Step 2: Analyzing conversation
    setCurrentStep(1);
    const result = await analyzeTextContent(textContent);

    // Step 3: Saving
    setCurrentStep(2);
    const saved = await saveScan(result, label, 0); // 0 screenshots for chat export

    // Track completion
    trackScanCompleted(result.score, false);

    // Refresh credits
    await refreshCredits();

    // Navigate to results
    router.replace(`/scan/results/${saved.id}`);
  };

  const runCompareAnalysis = async () => {
    const imagesA = JSON.parse(params.imagesA || '[]') as string[];
    const imagesB = JSON.parse(params.imagesB || '[]') as string[];
    const labelA = params.labelA || 'Person A';
    const labelB = params.labelB || 'Person B';

    if (imagesA.length === 0 || imagesB.length === 0) {
      throw new Error('Images required for both conversations');
    }

    // Track start
    trackScanStarted(imagesA.length + imagesB.length, false);

    // Step 1: Analyzing first conversation
    setCurrentStep(0);
    const resultA = await analyzeConversation(imagesA, false);

    // Brief delay between API calls to avoid rate limits
    await new Promise((r) => setTimeout(r, 2000));

    // Step 2: Analyzing second conversation (sequential to avoid rate limits)
    setCurrentStep(1);
    const resultB = await analyzeConversation(imagesB, false);

    // Step 3: Saving both scans with shared compare_id
    setCurrentStep(2);
    const compareId = `compare_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const [savedA, savedB] = await Promise.all([
      saveScan(resultA, labelA, imagesA.length, compareId),
      saveScan(resultB, labelB, imagesB.length, compareId),
    ]);

    // Track completion
    track(Events.SCAN_COMPLETED, {
      mode: 'compare',
      scoreA: resultA.score,
      scoreB: resultB.score,
    });

    // Refresh credits
    await refreshCredits();

    // Navigate to compare results
    router.replace({
      pathname: '/scan/compare-results',
      params: {
        scanIdA: savedA.id,
        scanIdB: savedB.id,
        labelA,
        labelB,
      },
    });
  };

  // Compare with existing scan (from results screen) - only analyzes Person B
  const runCompareWithExistingAnalysis = async () => {
    const existingScanId = params.existingScanId;
    const imagesB = JSON.parse(params.imagesB || '[]') as string[];
    const labelA = params.labelA || 'Person A';
    const labelB = params.labelB || 'Person B';

    if (!existingScanId) {
      throw new Error('Existing scan ID required');
    }

    if (imagesB.length === 0) {
      throw new Error('Images required for second conversation');
    }

    // Track start
    trackScanStarted(imagesB.length, false);
    track(Events.SCAN_STARTED, { mode: 'compare_with_existing' });

    // Step 1: Extracting messages
    setCurrentStep(0);
    await new Promise((r) => setTimeout(r, 500));

    // Step 2: Analyzing Person B conversation only (1 token)
    setCurrentStep(1);
    const resultB = await analyzeConversation(imagesB, false);

    // Step 3: Saving Person B scan with compare_id linking to existing scan
    setCurrentStep(2);
    const compareId = `compare_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const savedB = await saveScan(resultB, labelB, imagesB.length, compareId);

    // Update existing scan with the same compare_id (optional - links them together)
    // Note: This could be done server-side if needed

    // Track completion
    track(Events.SCAN_COMPLETED, {
      mode: 'compare_with_existing',
      scoreB: resultB.score,
    });

    // Refresh credits
    await refreshCredits();

    // Navigate to compare results using existing scan ID for Person A
    router.replace({
      pathname: '/scan/compare-results',
      params: {
        scanIdA: existingScanId,
        scanIdB: savedB.id,
        labelA,
        labelB,
      },
    });
  };

  const renderStep = (step: string, index: number) => {
    const isCompleted = index < currentStep;
    const isActive = index === currentStep;

    return (
      <View key={index} style={styles.stepRow}>
        <View style={styles.stepIconContainer}>
          {isCompleted ? (
            <Ionicons name="checkmark-circle" size={22} color={defaultColors.success} />
          ) : isActive ? (
            <Ionicons name="arrow-forward-circle" size={22} color={defaultColors.gradientStart} />
          ) : (
            <Ionicons name="ellipse-outline" size={22} color={colors.textMuted} />
          )}
        </View>
        <Text
          style={[
            styles.stepText,
            { color: colors.textMuted },
            isCompleted && styles.stepCompleted,
            isActive && { color: colors.text, fontWeight: typography.medium },
          ]}
        >
          {step}
          {isActive && '...'}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Pulsing Logo with Glow */}
        <View style={styles.logoWrapper}>
          <Animated.View
            style={[
              styles.logoGlow,
              {
                opacity: glowAnim,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Logo size={80} />
          </Animated.View>
        </View>

        {/* Progress Steps */}
        <View style={styles.stepsContainer}>
          {STEPS.map((step, index) => renderStep(step, index))}
        </View>

        {/* Wait Time Notice */}
        <Text style={[styles.waitNotice, { color: colors.textSecondary }]}>
          {getWaitMessage()}
        </Text>

        {/* Tips */}
        <View style={[styles.tipContainer, { backgroundColor: colors.surface }]}>
          <Text style={styles.tipLabel}>Tip:</Text>
          <Text style={[styles.tipText, { color: colors.text }]}>{TIPS[currentTip]}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: defaultColors.gradientStart,
  },
  stepsContainer: {
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  stepIconContainer: {
    width: 28,
    alignItems: 'center',
  },
  stepText: {
    fontSize: typography.md,
    color: defaultColors.textMuted,
    marginLeft: spacing.sm,
  },
  stepCompleted: {
    color: defaultColors.success,
  },
  stepActive: {
    color: defaultColors.text,
    fontWeight: typography.medium,
  },
  tipContainer: {
    marginTop: spacing.lg,
    backgroundColor: defaultColors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    maxWidth: 300,
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipLabel: {
    fontSize: typography.sm,
    color: defaultColors.gradientStart,
    fontWeight: typography.semibold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  tipText: {
    fontSize: typography.sm,
    color: defaultColors.text,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  waitNotice: {
    fontSize: typography.sm,
    color: defaultColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
