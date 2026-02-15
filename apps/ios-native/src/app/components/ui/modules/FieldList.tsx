/**
 * FieldList for iOS
 * Adapted from: apps/web/src/app/components/ui/layout/FieldList.tsx
 *
 * Changes from web:
 * - Replaced div with View
 * - Replaced space-y-5 with gap style
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface FieldListProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Simple wrapper for a list of fields with consistent spacing
 * Use this inside FieldSection components when you need to render multiple fields
 */
export function FieldList({ children, style }: FieldListProps) {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20, // Equivalent to space-y-5 (1.25rem = 20px)
  },
});

export default FieldList;
