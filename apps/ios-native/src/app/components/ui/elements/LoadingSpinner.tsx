/**
 * LoadingSpinner for iOS
 * Adapted from: apps/web/src/app/components/ui/elements/LoadingSpinner.tsx
 *
 * Changes from web:
 * - Replaced div with View
 * - Replaced CSS animation with React Native ActivityIndicator
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  style?: ViewStyle;
}

const sizeMap = {
  sm: 'small' as const,
  md: 'small' as const,
  lg: 'large' as const,
};

export function LoadingSpinner({
  size = 'md',
  color = '#10B981',
  style,
}: LoadingSpinnerProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator
        size={sizeMap[size]}
        color={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LoadingSpinner;
