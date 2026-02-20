/**
 * ChatInput component for iOS
 * Adapted from: apps/web/src/app/components/ui/chat/ChatInput.tsx
 *
 * Changes from web:
 * - Uses ExpandingInput for auto-growing text input
 * - Uses Keyboard events for safe area handling
 * - Replaced div with View/StyleSheet
 */

import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  StyleSheet,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ANIMATION } from '@nektus/shared-client';
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
  keyboardHeight?: Animated.Value;
}

export interface ChatInputHandle {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  sendDisabled = false,
  placeholder = "What would you like to do?",
  fadeIn = false,
  keyboardHeight,
}, ref) {
  const insets = useSafeAreaInsets();
  const expandingInputRef = useRef<{ focus: () => void }>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(fadeIn ? 0 : 1)).current;

  useImperativeHandle(ref, () => ({
    focus: () => expandingInputRef.current?.focus(),
  }));

  // Track keyboard visibility for safe area padding
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Fade in animation
  useEffect(() => {
    if (fadeIn) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION.NAVIGATION_MS,
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

  // Convert onChange format: ChatInput expects (e: { target: { value: string } })
  // but ExpandingInput provides (text: string)
  const handleInputChange = useCallback((text: string) => {
    onChange({ target: { value: text } });
  }, [onChange]);

  // Check if send button should be disabled
  const actualContent = value.replace(/\u200B/g, '').trim();
  const isSendDisabled = !actualContent || sendDisabled;

  // Show empty string when unfocused with no content so native placeholder renders
  const displayValue = !isFocused && !actualContent ? '' : value;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Backdrop blur — absoluteFill covers content + keyboard spacer */}
      <BlurView
        style={StyleSheet.absoluteFillObject}
        tint="light"
        intensity={50}
      />

      {/* Border overlay */}
      <View style={styles.borderOverlay} />

      {/* Content */}
      <View style={[styles.content, { paddingBottom: keyboardVisible ? 12 : Math.max(24, insets.bottom) }]}>
        <View style={styles.inputWrapper}>
          <ExpandingInput
            ref={expandingInputRef}
            value={displayValue}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            editable={!disabled}
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

      {/* Keyboard spacer — inside the blurred container so blur covers it */}
      {keyboardHeight && <Animated.View style={{ height: keyboardHeight }} />}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 12,
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
export type { ChatInputProps };
