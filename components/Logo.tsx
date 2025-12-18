import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

import { colors } from '@/theme';

interface LogoProps {
  size?: number;
  showText?: boolean;
}

export default function Logo({ size = 32, showText = false }: LogoProps) {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/r-mark.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      {showText && (
        <Text style={[styles.brandText, { fontSize: size * 0.5 }]}>atioed</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    color: colors.text,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});
