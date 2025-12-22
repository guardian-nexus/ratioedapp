import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

import Logo from '@/components/Logo';
import GradientButton from '@/components/GradientButton';
import { useColors } from '@/hooks/useColors';
import { colors as defaultColors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');

const HAS_ONBOARDED_KEY = 'ratioed_has_onboarded';

interface Slide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

const slides: Slide[] = [
  {
    id: '1',
    icon: 'camera',
    title: 'Upload your texts',
    subtitle: 'Screenshot your conversations or upload a chat export file',
  },
  {
    id: '2',
    icon: 'chatbubbles',
    title: 'Analyze any chat',
    subtitle: '1-on-1 convos with screenshots or text exports. Group chats with text exports.',
  },
  {
    id: '3',
    icon: 'analytics',
    title: 'Get the receipts',
    subtitle: 'See exactly who sends more messages, words, and questions',
  },
  {
    id: '4',
    icon: 'scale',
    title: 'See the balance',
    subtitle: 'Find out if they\'re matching your energy or if you\'re carrying',
  },
  {
    id: '5',
    icon: 'share-social',
    title: 'Share the results',
    subtitle: 'Show your friends what you\'re dealing with',
  },
];

export default function Onboarding() {
  const colors = useColors();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      // Complete onboarding
      await SecureStore.setItemAsync(HAS_ONBOARDED_KEY, 'true');
      router.replace('/auth');
    }
  };

  const handleSkip = async () => {
    await SecureStore.setItemAsync(HAS_ONBOARDED_KEY, 'true');
    router.replace('/auth');
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      <View style={styles.iconContainer}>
        <Ionicons name={item.icon} size={80} color={colors.gradientStart} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {slides.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === currentIndex && styles.activeDot,
          ]}
        />
      ))}
    </View>
  );

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Logo size={40} showText />
        {!isLastSlide && (
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />

      {/* Bottom */}
      <View style={styles.bottom}>
        {renderDots()}
        <GradientButton
          title={isLastSlide ? 'Get Started' : 'Next'}
          onPress={handleNext}
          icon={isLastSlide ? 'arrow-forward' : undefined}
          style={styles.button}
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  skipText: {
    color: defaultColors.textSecondary,
    fontSize: typography.md,
  },
  slide: {
    width,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: defaultColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    color: defaultColors.text,
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    color: defaultColors.textSecondary,
    fontSize: typography.lg,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  bottom: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: defaultColors.border,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: defaultColors.gradientStart,
    width: 24,
  },
  button: {
    width: '100%',
  },
});
