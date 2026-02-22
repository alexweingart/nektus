/**
 * ToggleSetting for iOS
 * Adapted from: apps/web/src/app/components/ui/controls/ToggleSetting.tsx
 *
 * Changes from web:
 * - Replaced div with View
 * - Replaced web button with React Native Switch
 * - Replaced Tailwind with StyleSheet
 */

import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { textSizes, fontStyles } from '../Typography';

interface ToggleSettingProps {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ToggleSetting({
  label,
  enabled,
  onChange,
  disabled = false,
}: ToggleSettingProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={enabled}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#ffffff' }}
        thumbColor={enabled ? '#6B7280' : '#ffffff'}
        ios_backgroundColor="rgba(255, 255, 255, 0.2)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  label: {
    ...textSizes.sm,
    ...fontStyles.regular,
    color: '#ffffff',
  },
});

export default ToggleSetting;
