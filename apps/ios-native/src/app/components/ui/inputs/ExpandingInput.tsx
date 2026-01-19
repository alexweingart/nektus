/**
 * ExpandingInput - Auto-expanding TextInput for iOS
 * Adapted from: apps/web/src/app/components/ui/inputs/ExpandingInput.tsx
 *
 * Web approach:
 * - Uses textarea with rows={1} to start single line
 * - min-h-[56px] container with py-3 px-6 (12px/24px padding)
 * - Textarea has lineHeight: '1' and minimal padding
 * - Expands via onInput setting height to scrollHeight
 */

import React, { useState, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
} from 'react-native';

export interface ExpandingInputRef {
  focus: () => void;
}

interface ExpandingInputProps extends Omit<TextInputProps, 'onChange'> {
  value?: string;
  onChange?: (text: string) => void;
  onChangeEvent?: (e: { target: { value: string } }) => void;
  placeholder?: string;
  variant?: 'default' | 'white';
  disabled?: boolean;
  maxHeight?: number;
}

export const ExpandingInput = forwardRef<ExpandingInputRef, ExpandingInputProps>(({
  value,
  onChange,
  onChangeEvent,
  placeholder,
  variant = 'default',
  disabled = false,
  maxHeight = 200,
  ...props
}, ref) => {
  // Start with 0 - let content size determine actual height
  const [contentHeight, setContentHeight] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const isWhiteVariant = variant === 'white';
  const inputRef = useRef<TextInput>(null);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const handleContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const newContentHeight = Math.min(e.nativeEvent.contentSize.height, maxHeight - 24); // 24 = padding
      setContentHeight(newContentHeight);
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

  // Calculate container height: content + padding, min 56px
  const containerHeight = Math.max(56, contentHeight + 24);

  return (
    <View style={[styles.glowWrapper, isFocused && styles.glowWrapperFocused]}>
      <View style={[styles.container, { minHeight: containerHeight }]}>
        {/* Base bg-black/40 overlay to match web */}
        <View style={[
          styles.baseOverlay,
          isWhiteVariant && styles.whiteBaseOverlay,
        ]} />

        {/* Focus darkening overlay - adds 10% to reach bg-black/50 */}
        {isFocused && !isWhiteVariant && <View style={styles.focusOverlay} />}

        {/* Border overlay */}
        <View
          style={[
            styles.borderOverlay,
            isWhiteVariant ? styles.whiteBorder : styles.darkBorder,
            isFocused && (isWhiteVariant ? styles.whiteBorderFocused : styles.darkBorderFocused),
          ]}
        />

        {/* Content wrapper for vertical centering */}
        <View style={styles.contentWrapper}>
          <TextInput
            ref={inputRef}
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
            scrollEnabled={false}
            editable={!disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
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
  container: {
    minHeight: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  baseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // bg-black/40 to match web
  },
  whiteBaseOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 1)', // white background for white variant
  },
  focusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // +10% to reach bg-black/50
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
  },
  whiteBorder: {
    borderColor: 'rgba(229, 231, 235, 1)',
  },
  whiteBorderFocused: {
    borderColor: 'rgba(209, 213, 219, 1)',
  },
  darkBorder: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  darkBorderFocused: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24, // px-6 on web
    paddingVertical: 12, // py-3 on web
  },
  input: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20, // Approximate single line height
    padding: 0, // Minimal padding like web's padding: '2px'
    textAlignVertical: 'center',
  },
  whiteText: {
    color: '#111827',
  },
  darkText: {
    color: '#ffffff',
  },
});

export default ExpandingInput;
