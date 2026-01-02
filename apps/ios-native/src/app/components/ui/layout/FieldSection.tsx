/**
 * FieldSection for iOS
 * Adapted from: apps/web/src/app/components/ui/layout/FieldSection.tsx
 *
 * Changes from web:
 * - Replaced div with View
 * - Uses iOS Typography components
 * - Replaced Tailwind with StyleSheet
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from '@react-native-community/blur';

interface FieldSectionProps {
  title?: string;
  topContent?: React.ReactNode;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
  bottomButton?: React.ReactNode;
}

export function FieldSection({
  title,
  topContent,
  isEmpty,
  emptyText,
  children,
  bottomButton,
}: FieldSectionProps) {
  return (
    <View style={styles.container}>
      {/* Section Header */}
      {title && (
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}

      {/* Optional Top Content (e.g., calendar/location chips before main content) */}
      {topContent && !isEmpty && (
        <View style={styles.topContent}>
          {topContent}
        </View>
      )}

      {/* Content or Empty State */}
      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <BlurView
            style={StyleSheet.absoluteFillObject}
            blurType="dark"
            blurAmount={16}
            reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.6)"
          />
          <View style={styles.emptyContent}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.childrenContainer}>
          {children}
        </View>
      )}

      {/* Optional Bottom Button */}
      {bottomButton && (
        <View style={styles.bottomButton}>
          {bottomButton}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  topContent: {
    marginBottom: 20,
  },
  emptyContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyContent: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  childrenContainer: {
    gap: 20,
  },
  bottomButton: {
    marginTop: 20,
  },
});

export default FieldSection;
