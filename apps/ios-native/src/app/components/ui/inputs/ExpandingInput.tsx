/**
 * ExpandingInput - Auto-expanding textarea with optional icon and visibility toggle
 * Unified component for bio fields, custom links, and other expanding text inputs
 *
 * Adapted from: apps/web/src/app/components/ui/inputs/ExpandingInput.tsx
 */

import React, { useState, useCallback, useRef, useImperativeHandle, forwardRef, ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
} from 'react-native';
import { EyeIcon } from '../elements/EyeIcon';
import { ThemedTextInput } from './ThemedTextInput';

export interface ExpandingInputRef {
  focus: () => void;
}

interface ExpandingInputProps extends Omit<TextInputProps, 'onChange'> {
  value?: string;
  onChange?: (text: string) => void;
  label?: string;
  placeholder?: string;
  variant?: 'default' | 'hideable' | 'white';
  isHidden?: boolean;
  onToggleHide?: () => void;
  icon?: ReactNode;
  maxHeight?: number;
  /** When provided, pressing return submits instead of adding newline */
  onSubmit?: () => void;
  /** Called when input loses focus */
  onInputBlur?: () => void;
  /** If true, uses single line mode (no expanding) */
  singleLine?: boolean;
}

/**
 * Auto-resizing textarea component
 * - Basic usage: Simple expanding textarea for bio, etc.
 * - With icon: Add icon on the left side
 * - With visibility toggle: Add eye icon on the right for hide/show
 */
export const ExpandingInput = forwardRef<ExpandingInputRef, ExpandingInputProps>(({
  value,
  onChange,
  label,
  placeholder,
  variant = 'default',
  isHidden = false,
  onToggleHide,
  icon,
  maxHeight = 200,
  onSubmit,
  onInputBlur,
  singleLine = false,
  ...props
}, ref) => {
  // Start with 0 - let content size determine actual height
  const [contentHeight, setContentHeight] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onInputBlur?.();
  }, [onInputBlur]);

  const isWhiteVariant = variant === 'white';
  const hasIconOrToggle = icon || (variant === 'hideable' && onToggleHide);

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
    },
    [onChange]
  );

  // Calculate container height: content + padding, min 56px
  const containerHeight = Math.max(56, contentHeight + 24);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.glowWrapper, isFocused && !isWhiteVariant && styles.glowWrapperFocused]}>
        <View style={[styles.container, { minHeight: containerHeight }]}>
          {/* Base background overlay */}
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

          {/* Content wrapper */}
          <View style={[
            styles.contentWrapper,
            hasIconOrToggle ? styles.contentWrapperWithExtras : null,
          ]}>
            {/* Icon on the left */}
            {icon && (
              <View style={styles.iconContainer}>
                {icon}
              </View>
            )}

            {/* TextInput */}
            <ThemedTextInput
              ref={inputRef}
              style={[
                styles.input,
                isWhiteVariant ? styles.whiteText : styles.darkText,
                icon ? styles.inputWithIcon : null,
                !icon && !hasIconOrToggle ? styles.inputNoExtras : null,
              ]}
              value={value}
              onChangeText={handleChangeText}
              onContentSizeChange={singleLine ? undefined : handleContentSizeChange}
              placeholder={placeholder}
              placeholderTextColor={isWhiteVariant ? '#9CA3AF' : 'rgba(255, 255, 255, 0.4)'}
              colorTheme={isWhiteVariant ? 'dark' : 'light'}
              multiline={!singleLine}
              scrollEnabled={false}
              returnKeyType={onSubmit ? 'done' : undefined}
              onSubmitEditing={onSubmit}
              blurOnSubmit={!!onSubmit}
              onFocus={() => setIsFocused(true)}
              onBlur={handleBlur}
              {...props}
            />

            {/* Hide/Show toggle on the right */}
            {onToggleHide && variant === 'hideable' && (
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
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
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
  container: {
    minHeight: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  baseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // bg-black/40
  },
  whiteBaseOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 1)', // white background for white variant
  },
  focusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // +10% to reach bg-black/50 on focus
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
  },
  whiteBorder: {
    borderColor: 'rgba(229, 231, 235, 1)', // border-gray-200
  },
  whiteBorderFocused: {
    borderColor: 'rgba(209, 213, 219, 1)', // border-gray-300
  },
  darkBorder: {
    borderColor: 'rgba(255, 255, 255, 0.2)', // border-white/20
  },
  darkBorderFocused: {
    borderColor: 'rgba(255, 255, 255, 0.4)', // border-white/40
  },
  contentWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24, // px-6 on web
    paddingVertical: 12, // py-3 on web
  },
  contentWrapperWithExtras: {
    paddingHorizontal: 0, // Icon/eye handle their own padding
  },
  iconContainer: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    padding: 0,
    textAlignVertical: 'center',
  },
  inputWithIcon: {
    paddingRight: 8,
  },
  inputNoExtras: {
    // No extra padding needed - contentWrapper already provides paddingHorizontal: 24
  },
  whiteText: {
    color: '#111827', // text-gray-900
  },
  darkText: {
    color: '#ffffff',
  },
  eyeButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
  },
});

ExpandingInput.displayName = 'ExpandingInput';

export default ExpandingInput;
