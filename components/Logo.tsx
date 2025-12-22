import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/ThemeContext';
import { colors as defaultColors } from '@/theme';

interface LogoProps {
  size?: number;
  showText?: boolean;
}

export default function Logo({ size = 32, showText = false }: LogoProps) {
  const colors = useColors();
  const { isDark } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[
        styles.logoWrapper,
        {
          width: size,
          height: size,
          borderRadius: size * 0.2,
        }
      ]}>
        <Image
          source={require('@/assets/r-mark.png')}
          style={{ width: size * 0.9, height: size * 0.9 }}
          resizeMode="contain"
        />
      </View>
      {showText && (
        <Text style={[styles.brandText, { fontSize: size * 0.5, color: colors.text }]}>atioed</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  brandText: {
    color: defaultColors.text,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});
