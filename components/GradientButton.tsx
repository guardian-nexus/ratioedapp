import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { colors as defaultColors, spacing, typography, borderRadius } from '@/theme';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  variant?: 'filled' | 'outline';
  badge?: string;
}

export default function GradientButton({
  title,
  onPress,
  icon,
  disabled = false,
  loading = false,
  style,
  variant = 'filled',
  badge,
}: GradientButtonProps) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.outlineContainer, { borderColor: colors.gradientStart }, isDisabled && styles.disabled, style]}
        activeOpacity={0.8}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={colors.gradientStart}
            style={styles.icon}
          />
        )}
        <Text style={[styles.outlineText, { color: colors.text }]}>{title}</Text>
        {badge && (
          <Text style={[styles.badge, { color: colors.textSecondary }]}>{badge}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.container, isDisabled && styles.disabled, style]}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            {icon && (
              <Ionicons
                name={icon}
                size={20}
                color={colors.text}
                style={styles.icon}
              />
            )}
            <Text style={styles.text}>{title}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  text: {
    color: defaultColors.text,
    fontSize: typography.md,
    fontWeight: typography.semibold,
  },
  icon: {
    marginRight: spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  outlineContainer: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: defaultColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: 'transparent',
  },
  outlineText: {
    color: defaultColors.text,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  badge: {
    marginLeft: spacing.sm,
    color: defaultColors.textSecondary,
    fontSize: typography.sm,
  },
});
