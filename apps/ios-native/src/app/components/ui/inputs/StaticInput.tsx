/**
 * StaticInput for iOS
 * Adapted from: apps/web/src/app/components/ui/inputs/StaticInput.tsx
 *
 * Changes from web:
 * - Replaced HTML input with React Native TextInput
 * - Replaced div with View
 * - Uses BlurView for glassmorphism effect
 * - Uses iOS EyeIcon component
 */

import React, { useState, ReactNode } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { EyeIcon } from '../icons/EyeIcon';

interface StaticInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  variant?: 'default' | 'hideable';
  isHidden?: boolean;
  onToggleHide?: () => void;
}

export function StaticInput({
  label,
  error,
  icon,
  variant = 'default',
  isHidden = false,
  onToggleHide,
  ...props
}: StaticInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
        <BlurView
          style={StyleSheet.absoluteFillObject}
          tint="dark"
          intensity={50}
        />

        {/* Border overlay */}
        <View
          style={[
            styles.borderOverlay,
            isFocused && styles.borderOverlayFocused,
          ]}
        />

        {icon && <View style={styles.iconContainer}>{icon}</View>}

        <TextInput
          style={[
            styles.input,
            icon ? styles.inputWithIcon : styles.inputNoIcon,
            variant === 'hideable' && styles.inputHideable,
          ]}
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {/* Eye icon for hideable variant */}
        {variant === 'hideable' && onToggleHide && (
          <TouchableOpacity
            onPress={onToggleHide}
            style={styles.eyeButton}
            accessibilityLabel={isHidden ? 'Show field' : 'Hide field'}
          >
            <EyeIcon isOpen={isHidden} size={20} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    minHeight: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  inputContainerFocused: {
    // Focus styles handled by border overlay
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  borderOverlayFocused: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  iconContainer: {
    width: 56,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  inputWithIcon: {
    paddingLeft: 8,
    paddingRight: 24,
  },
  inputNoIcon: {
    paddingLeft: 24,
    paddingRight: 24,
  },
  inputHideable: {
    paddingRight: 8,
  },
  eyeButton: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
  },
  error: {
    marginTop: 4,
    fontSize: 14,
    color: '#DC2626',
  },
});

export default StaticInput;
