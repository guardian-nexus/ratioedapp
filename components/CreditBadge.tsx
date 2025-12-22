import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { colors as defaultColors, spacing, typography, borderRadius } from '@/theme';

interface CreditBadgeProps {
  credits: number;
  isSubscribed?: boolean;
  onPress?: () => void;
}

export default function CreditBadge({ credits, isSubscribed = false, onPress }: CreditBadgeProps) {
  const colors = useColors();

  const content = (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Ionicons
        name={isSubscribed ? 'infinite' : 'scan'}
        size={16}
        color={colors.text}
      />
      <Text style={[styles.text, { color: colors.text }]}>
        {isSubscribed ? 'Unlimited' : `${credits} scan${credits !== 1 ? 's' : ''}`}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: defaultColors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  text: {
    color: defaultColors.text,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
});
