'use client';

import React from 'react';
import { StaticInput } from '../inputs/StaticInput';
import { DropdownPhoneInput } from '../inputs/DropdownPhoneInput';
import { ExpandingInput } from '../inputs/ExpandingInput';
import SocialIcon from './SocialIcon';
import type { ContactEntry, FieldSection } from '@/types/profile';

interface ProfileFieldProps {
  profile: ContactEntry;
  fieldSectionManager: {
    isFieldHidden: (fieldType: string, viewMode: 'Personal' | 'Work') => boolean;
    toggleFieldVisibility: (fieldType: string, viewMode: 'Personal' | 'Work') => void;
  };
  getValue: (fieldType: string, section?: FieldSection) => string;
  onChange: (fieldType: string, value: string, section: FieldSection) => void;
  isUnconfirmed: (fieldType: string) => boolean;
  onConfirm: (fieldType: string) => void;
  currentViewMode: 'Personal' | 'Work';
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

export const ProfileField: React.FC<ProfileFieldProps> = ({
  profile,
  fieldSectionManager,
  getValue,
  onChange,
  isUnconfirmed,
  onConfirm,
  currentViewMode,
}) => {
  const fieldType = profile.fieldType;
  const placeholder = getPlaceholder(fieldType);
  const value = profile.value || '';
  const shouldShowAsHidden = !profile.isVisible;
  const fieldId = `${fieldType}-${profile.section}`;


  return (
    <div className="w-full max-w-[var(--max-content-width,448px)]">
      {fieldType === 'phone' ? (
        <DropdownPhoneInput
          onChange={(value) => {
            // Update the field value through the standard onChange (same as all other fields)
            onChange(fieldType, value, profile.section);
            onConfirm(fieldType);
          }}
          value={value}
          placeholder={placeholder}
          className="w-full"
          autoFocus={false}
          inputProps={{
            id: fieldId,
            autoComplete: "tel",
            className: "w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          }}
        />
      ) : profile.linkType === 'custom' ? (
        <ExpandingInput
          value={value}
          onChange={(value) => {
            onChange(fieldType, value, profile.section);
          }}
          placeholder={placeholder}
          className="w-full"
          variant="hideable"
          isHidden={shouldShowAsHidden}
          onToggleHide={() => {
            fieldSectionManager.toggleFieldVisibility(fieldType, currentViewMode);
          }}
          icon={
            <div
              className="w-5 h-5 flex items-center justify-center relative"
            >
              <SocialIcon
                platform={fieldType}
                username={value}
                size="sm"
                customIcon={profile.icon}
                linkType={profile.linkType}
              />
            </div>
          }
        />
      ) : (
        <StaticInput
          type={fieldType === 'email' ? 'email' : 'text'}
          id={fieldId}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(fieldType, e.target.value, profile.section);
          }}
          placeholder={placeholder}
          className="w-full"
          inputClassName="pl-2 text-base"
          variant="hideable"
          isHidden={shouldShowAsHidden}
          onToggleHide={() => {
            fieldSectionManager.toggleFieldVisibility(fieldType, currentViewMode);
            // Don't auto-confirm when hiding/showing - let user confirm through other actions
          }}
          icon={
            <div
              className="w-5 h-5 flex items-center justify-center relative"
            >
              <SocialIcon 
                platform={fieldType} 
                username={value}
                size="sm" 
              />
              {isUnconfirmed(fieldType) && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full border border-white"></div>
              )}
            </div>
          }
          iconClassName="text-white"
          autoComplete={fieldType === 'email' ? 'email' : undefined}
        />
      )}
    </div>
  );
}; 