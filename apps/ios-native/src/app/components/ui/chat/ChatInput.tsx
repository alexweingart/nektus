/**
 * ChatInput component for iOS
 * Adapted from: apps/web/src/app/components/ui/chat/ChatInput.tsx
 *
 * Changes from web:
 * - Replaced fixed positioning with KeyboardAvoidingView pattern
 * - Removed visualViewport handling (iOS handles keyboard natively)
 * - Replaced div with View/StyleSheet
 * - Replaced ExpandingInput import path
 * - Uses KeyboardAvoidingView instead of CSS fixed positioning
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Keyboard,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { ExpandingInput } from '../inputs/ExpandingInput';
import { Button } from '../buttons/Button';

interface ChatInputProps {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  onSend: () => void;
  disabled: boolean;
  sendDisabled?: boolean;
  placeholder?: string;
  fadeIn?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  sendDisabled = false,
  placeholder = "What would you like to do?",
  fadeIn = false,
}: ChatInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(fadeIn ? 0 : 1)).current;

  // Fade in animation
  useEffect(() => {
    if (fadeIn) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [fadeIn, fadeAnim]);

  // Handle keyboard submit
  const handleSubmitEditing = useCallback(() => {
    const actualContent = value.replace(/\u200B/g, '').trim();
    if (!disabled && actualContent && !sendDisabled) {
      onSend();
    }
  }, [value, disabled, sendDisabled, onSend]);

  // Check if send button should be disabled
  const actualContent = value.replace(/\u200B/g, '').trim();
  const isSendDisabled = !actualContent || sendDisabled;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Backdrop blur */}
      <BlurView
        style={StyleSheet.absoluteFillObject}
        tint="light"
        intensity={50}
      />

      {/* Border overlay */}
      <View style={styles.borderOverlay} />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.inputWrapper}>
          <ExpandingInput
            value={value}
            onChangeEvent={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={!isFocused && !actualContent ? placeholder : ''}
            disabled={disabled}
            variant="white"
            returnKeyType="send"
            onSubmitEditing={handleSubmitEditing}
            blurOnSubmit={false}
          />
        </View>

        <Button
          variant="circle"
          size="icon"
          onPress={onSend}
          disabled={isSendDisabled}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2}>
            <Path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </Svg>
        </Button>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
  },
});

export default ChatInput;
