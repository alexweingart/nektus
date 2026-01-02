/**
 * ExpandingInput - Auto-expanding TextInput for iOS
 * Adapted from: apps/web/src/app/components/ui/inputs/ExpandingInput.tsx
 *
 * Changes from web:
 * - Replaced textarea with React Native TextInput (multiline)
 * - Replaced CSS with StyleSheet
 * - Removed forwardRef (simplified)
 * - Removed onInput auto-resize (RN handles this natively)
 * - Removed DOM manipulation for height adjustment
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';

interface ExpandingInputProps extends Omit<TextInputProps, 'onChange'> {
  value?: string;
  onChange?: (text: string) => void;
  onChangeEvent?: (e: { target: { value: string } }) => void;
  placeholder?: string;
  variant?: 'default' | 'white';
  disabled?: boolean;
  maxHeight?: number;
}

export function ExpandingInput({
  value,
  onChange,
  onChangeEvent,
  placeholder,
  variant = 'default',
  disabled = false,
  maxHeight = 120,
  ...props
}: ExpandingInputProps) {
  const [height, setHeight] = useState(56);
  const isWhiteVariant = variant === 'white';

  const handleContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const newHeight = Math.min(
        Math.max(56, e.nativeEvent.contentSize.height + 24),
        maxHeight
      );
      setHeight(newHeight);
    },
    [maxHeight]
  );

  const handleChangeText = useCallback(
    (text: string) => {
      if (onChange) {
        onChange(text);
      }
      if (onChangeEvent) {
        onChangeEvent({ target: { value: text } });
      }
    },
    [onChange, onChangeEvent]
  );

  return (
    <View style={[styles.container, { height }]}>
      {/* Backdrop blur */}
      <BlurView
        style={StyleSheet.absoluteFillObject}
        blurType={isWhiteVariant ? 'light' : 'dark'}
        blurAmount={16}
        reducedTransparencyFallbackColor={
          isWhiteVariant ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.4)'
        }
      />

      {/* Border overlay */}
      <View
        style={[
          styles.borderOverlay,
          isWhiteVariant ? styles.whiteBorder : styles.darkBorder,
        ]}
      />

      <TextInput
        style={[
          styles.input,
          isWhiteVariant ? styles.whiteText : styles.darkText,
        ]}
        value={value}
        onChangeText={handleChangeText}
        onContentSizeChange={handleContentSizeChange}
        placeholder={placeholder}
        placeholderTextColor={isWhiteVariant ? '#9CA3AF' : 'rgba(255, 255, 255, 0.4)'}
        multiline
        editable={!disabled}
        textAlignVertical="center"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
  },
  whiteBorder: {
    borderColor: 'rgba(229, 231, 235, 1)',
  },
  darkBorder: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  input: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  whiteText: {
    color: '#111827',
  },
  darkText: {
    color: '#ffffff',
  },
});

export default ExpandingInput;
