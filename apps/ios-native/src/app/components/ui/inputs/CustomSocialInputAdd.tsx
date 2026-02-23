/**
 * CustomSocialInputAdd for iOS
 * Adapted from: apps/web/src/app/components/ui/inputs/CustomSocialInputAdd.tsx
 *
 * Changes from web:
 * - Uses React Native components
 * - Uses iOS DropdownSelector
 * - Uses SocialIcon component for icons
 */

import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
} from 'react-native';
import { DropdownSelector, DropdownOption } from './DropdownSelector';
import SocialIcon from '../elements/SocialIcon';
import { BaseTextInput } from './BaseTextInput';
import { fontStyles } from '../Typography';

export interface CustomSocialInputAddRef {
  focus: () => void;
}

interface CustomSocialInputAddProps {
  platform: string;
  username: string;
  onPlatformChange: (platform: string) => void;
  onUsernameChange: (username: string) => void;
  autoFocus?: boolean;
  onSubmit?: () => void;
  onBlur?: () => void;
  /** Called when dropdown is about to open - use to mark internal interaction */
  onDropdownOpen?: () => void;
}

// Social network options with icons
const SOCIAL_NETWORK_OPTIONS: DropdownOption[] = [
  { label: 'Facebook', value: 'facebook', icon: <SocialIcon platform="facebook" size="sm" /> },
  { label: 'Instagram', value: 'instagram', icon: <SocialIcon platform="instagram" size="sm" /> },
  { label: 'X', value: 'x', icon: <SocialIcon platform="x" size="sm" /> },
  { label: 'LinkedIn', value: 'linkedin', icon: <SocialIcon platform="linkedin" size="sm" /> },
  { label: 'Snapchat', value: 'snapchat', icon: <SocialIcon platform="snapchat" size="sm" /> },
  { label: 'WhatsApp', value: 'whatsapp', icon: <SocialIcon platform="whatsapp" size="sm" /> },
  { label: 'Telegram', value: 'telegram', icon: <SocialIcon platform="telegram" size="sm" /> },
  { label: 'WeChat', value: 'wechat', icon: <SocialIcon platform="wechat" size="sm" /> },
];

export const CustomSocialInputAdd = forwardRef<CustomSocialInputAddRef, CustomSocialInputAddProps>(({
  platform,
  username,
  onPlatformChange,
  onUsernameChange,
  autoFocus = false,
  onSubmit,
  onBlur,
  onDropdownOpen,
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <View style={[styles.glowWrapper, isFocused && styles.glowWrapperFocused]}>
      <View style={styles.container}>
        {/* Base bg-black/40 overlay to match web */}
        <View style={styles.baseOverlay} />

        {/* Focus darkening overlay - adds 10% to reach bg-black/50 */}
        {isFocused && <View style={styles.focusOverlay} />}

        {/* Border overlay */}
        <View
          style={[
            styles.borderOverlay,
            isFocused && styles.borderOverlayFocused,
          ]}
        />

        <View style={styles.content}>
        {/* Social Network Selector */}
        <DropdownSelector
          options={SOCIAL_NETWORK_OPTIONS}
          value={platform}
          onChange={onPlatformChange}
          placeholder="Select"
          onBeforeOpen={onDropdownOpen}
          onAfterChange={() => inputRef.current?.focus()}
        />

        {/* Username Input */}
        <BaseTextInput
          ref={inputRef}
          style={styles.input}
          value={username}
          onChangeText={onUsernameChange}
          placeholder="Username"
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          blurOnSubmit={true}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
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
    height: 56,
    minHeight: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  baseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // bg-black/40 to match web unfocused
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
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 16,
    ...fontStyles.regular,
    textAlignVertical: 'center',
  },
});

export default CustomSocialInputAdd;
