/**
 * ProfileField for iOS
 * Adapted from: apps/web/src/app/components/ui/elements/ProfileField.tsx
 *
 * Changes from web:
 * - Uses React Native components
 * - Uses iOS input components (StaticInput, DropdownPhoneInput, ExpandingInput)
 * - Simplified drag-and-drop handling (handled at parent level)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StaticInput } from '../inputs/StaticInput';
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
  isUnconfirmed: (fieldType: string) => boolean;
  onConfirm: (fieldType: string) => void;
  currentViewMode: 'Personal' | 'Work';
  isDraggable?: boolean;
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
  isUnconfirmed,
  onConfirm,
  currentViewMode,
  isDraggable = false,
}: ProfileFieldProps) {
  const fieldType = profile.fieldType;
  const placeholder = getPlaceholder(fieldType);
  const value = profile.value || '';
  const shouldShowAsHidden = !profile.isVisible;

  // Handle placeholder for drag & drop
  if (fieldType === 'placeholder') {
    return <View style={styles.placeholder} />;
  }

  // Phone input
  if (fieldType === 'phone') {
    return (
      <View style={styles.container}>
        <DropdownPhoneInput
          value={value}
          onChange={(newValue) => {
            onChange(fieldType, newValue, profile.section);
            onConfirm(fieldType);
          }}
          placeholder={placeholder}
        />
      </View>
    );
  }

  // Custom link input (expanding)
  if (profile.linkType === 'custom') {
    return (
      <View style={styles.container}>
        <ExpandingInput
          value={value}
          onChange={(newValue) => {
            onChange(fieldType, newValue, profile.section);
          }}
          placeholder={placeholder}
          variant="default"
        />
      </View>
    );
  }

  // Standard input with icon
  return (
    <View style={styles.container}>
      <StaticInput
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
            {isUnconfirmed(fieldType) && <View style={styles.unconfirmedDot} />}
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
    height: 56,
    width: '100%',
  },
  iconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unconfirmedDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
});

export default ProfileField;
