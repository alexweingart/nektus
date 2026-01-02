/**
 * CustomSocialInputAdd for iOS
 * Adapted from: apps/web/src/app/components/ui/inputs/CustomSocialInputAdd.tsx
 *
 * Changes from web:
 * - Uses React Native components
 * - Uses iOS DropdownSelector
 * - Uses SocialIcon component for icons
 */

import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { DropdownSelector, DropdownOption } from './DropdownSelector';
import SocialIcon from '../elements/SocialIcon';

interface CustomSocialInputAddProps {
  platform: string;
  username: string;
  onPlatformChange: (platform: string) => void;
  onUsernameChange: (username: string) => void;
  autoFocus?: boolean;
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

export function CustomSocialInputAdd({
  platform,
  username,
  onPlatformChange,
  onUsernameChange,
  autoFocus = false,
}: CustomSocialInputAddProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.container}>
      <BlurView
        style={StyleSheet.absoluteFillObject}
        blurType="dark"
        blurAmount={16}
        reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.4)"
      />

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
          onAfterChange={() => inputRef.current?.focus()}
        />

        {/* Username Input */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={username}
          onChangeText={onUsernameChange}
          placeholder="Username"
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    minHeight: 56,
    borderRadius: 28,
    overflow: 'hidden',
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
    fontWeight: '500',
  },
});

export default CustomSocialInputAdd;
