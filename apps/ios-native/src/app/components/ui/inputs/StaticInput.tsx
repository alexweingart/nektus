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
import { EyeIcon } from '../elements/EyeIcon';
import { ThemedTextInput } from './ThemedTextInput';

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

      <View style={[styles.glowWrapper, isFocused && styles.glowWrapperFocused]}>
        <View style={styles.inputContainer}>
          {/* Base bg-black/40 overlay to match other inputs */}
          <View style={styles.baseOverlay} />

          {/* Focus darkening overlay - adds 10% to reach bg-black/50 */}
          {isFocused && <View style={styles.focusOverlay} />}

          {/* Border overlay */}
          <View
            style={[
              styles.borderOverlay,
              isFocused ? styles.borderOverlayFocused : null,
            ]}
          />

        {icon && <View style={styles.iconContainer}>{icon}</View>}

        <ThemedTextInput
          style={[
            styles.input,
            icon ? styles.inputWithIcon : styles.inputNoIcon,
            variant === 'hideable' && styles.inputHideable,
          ]}
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          returnKeyType="done"
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
  glowWrapper: {
    borderRadius: 28,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 20,
  },
  glowWrapperFocused: {
    shadowOpacity: 0.15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    minHeight: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  baseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // bg-black/40
  },
  focusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // +10% to reach bg-black/50 on focus
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
