/**
 * ProfileField for iOS
 * Adapted from: apps/web/src/app/components/ui/elements/ProfileField.tsx
 *
 * Changes from web:
 * - Uses React Native components
 * - Uses iOS input components (SingleLineInput, DropdownPhoneInput, ExpandingInput)
 * - Drag handle implemented via ref/props instead of data-* attributes
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SingleLineInput } from '../inputs/SingleLineInput';
import { DropdownPhoneInput } from '../inputs/DropdownPhoneInput';
import { ExpandingInput } from '../inputs/ExpandingInput';
import SocialIcon from './SocialIcon';
import type { ContactEntry, FieldSection } from '@nektus/shared-types';

interface FieldSectionManager {
  isFieldHidden: (fieldType: string, viewMode: 'Personal' | 'Work') => boolean;
  toggleFieldVisibility: (fieldType: string, viewMode: 'Personal' | 'Work') => void;
}

interface ProfileFieldProps {
  profile: ContactEntry;
  fieldSectionManager: FieldSectionManager;
  getValue: (fieldType: string, section?: FieldSection) => string;
  onChange: (fieldType: string, value: string, section: FieldSection) => void;
  currentViewMode: 'Personal' | 'Work';
  isDraggable?: boolean;
  isBeingDragged?: boolean;
}

const getPlaceholder = (fieldType: string): string => {
  switch (fieldType) {
    case 'phone':
      return 'Phone number';
    case 'email':
      return 'Email address';
    case 'x':
      return 'X username';
    case 'wechat':
      return 'WeChat ID';
    case 'whatsapp':
      return 'WhatsApp number';
    default:
      return `${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} username`;
  }
};

export function ProfileField({
  profile,
  fieldSectionManager,
  getValue: _getValue,
  onChange,
  currentViewMode,
  isDraggable = false,
  isBeingDragged = false,
}: ProfileFieldProps) {
  const fieldType = profile.fieldType;
  const placeholder = getPlaceholder(fieldType);
  const value = profile.value || '';
  const shouldShowAsHidden = !profile.isVisible;

  // Handle placeholder for drag & drop
  if (fieldType === 'placeholder') {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder} />
      </View>
    );
  }

  // Phone input
  if (fieldType === 'phone') {
    return (
      <View style={styles.container}>
        <DropdownPhoneInput
          value={value}
          onChange={(newValue) => {
            onChange(fieldType, newValue, profile.section);
          }}
          placeholder={placeholder}
        />
      </View>
    );
  }

  // Custom link input (expanding with icon and visibility toggle)
  if (profile.linkType === 'custom') {
    return (
      <View style={styles.container}>
        <ExpandingInput
          value={value.replace(/^https?:\/\//i, '')}
          onChange={(newValue) => {
            const stripped = newValue.replace(/^https?:\/\//i, '');
            onChange(fieldType, stripped ? `https://${stripped}` : '', profile.section);
          }}
          placeholder="example.com/username"
          variant="hideable"
          isHidden={shouldShowAsHidden}
          onToggleHide={() => {
            fieldSectionManager.toggleFieldVisibility(fieldType, currentViewMode);
          }}
          icon={
            <View style={styles.iconWrapper}>
              <SocialIcon
                platform={fieldType}
                username={value}
                size="sm"
                customIcon={profile.icon}
                linkType={profile.linkType}
              />
            </View>
          }
        />
      </View>
    );
  }

  // Standard input with icon and visibility toggle
  return (
    <View style={styles.container}>
      <SingleLineInput
        value={value}
        onChangeText={(newValue) => {
          onChange(fieldType, newValue, profile.section);
        }}
        placeholder={placeholder}
        variant="hideable"
        isHidden={shouldShowAsHidden}
        onToggleHide={() => {
          fieldSectionManager.toggleFieldVisibility(fieldType, currentViewMode);
        }}
        keyboardType={fieldType === 'email' ? 'email-address' : 'default'}
        autoCapitalize={fieldType === 'email' ? 'none' : 'sentences'}
        autoCorrect={false}
        icon={
          <View style={styles.iconWrapper}>
            <SocialIcon
              platform={fieldType}
              username={value}
              size="sm"
              customIcon={profile.icon}
              linkType={profile.linkType}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 448,
  },
  placeholder: {
    height: 56, // 3.5rem
    width: '100%',
  },
  iconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
});

export default ProfileField;
