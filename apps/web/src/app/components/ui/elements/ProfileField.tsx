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
  currentViewMode: 'Personal' | 'Work';

  // Drag & Drop props
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

export const ProfileField: React.FC<ProfileFieldProps> = ({
  profile,
  fieldSectionManager,
  getValue: _getValue,
  onChange,
  currentViewMode,
  isDraggable = false,
}) => {
  const fieldType = profile.fieldType;
  const placeholder = getPlaceholder(fieldType);
  const value = profile.value || '';
  const shouldShowAsHidden = !profile.isVisible;
  const fieldId = `${fieldType}-${profile.section}`;

  // Handle placeholder for drag & drop
  if (fieldType === 'placeholder') {
    return (
      <div className="w-full max-w-[var(--max-content-width,448px)]">
        <div style={{ height: '3.5rem' }} className="w-full" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[var(--max-content-width,448px)]">
      {fieldType === 'phone' ? (
        <DropdownPhoneInput
          onChange={(value) => {
            // Update the field value through the standard onChange (same as all other fields)
            onChange(fieldType, value, profile.section);
          }}
          value={value}
          placeholder={placeholder}
          className="w-full"
          autoFocus={false}
          inputProps={{
            id: fieldId,
            autoComplete: "tel"
          }}
          onDropdownTouchMove={isDraggable ? (e) => {
            // Propagate touch move events for drag detection
            e.preventDefault();
          } : undefined}
          isDraggable={isDraggable}
          fieldType={fieldType}
          section={profile.section}
        />
      ) : profile.linkType === 'custom' ? (
        <ExpandingInput
          value={value}
          onChange={(newValue: string) => {
            onChange(fieldType, newValue, profile.section);
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
              data-drag-handle={isDraggable ? "true" : undefined}
              data-field-type={isDraggable ? fieldType : undefined}
              data-section={isDraggable ? profile.section : undefined}
              className="w-5 h-5 flex items-center justify-center relative"
              style={{
                touchAction: isDraggable ? 'none' : undefined,
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
              onContextMenu={isDraggable ? (e) => e.preventDefault() : undefined}
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
              data-drag-handle={isDraggable ? "true" : undefined}
              data-field-type={isDraggable ? fieldType : undefined}
              data-section={isDraggable ? profile.section : undefined}
              className="w-5 h-5 flex items-center justify-center relative"
              style={{
                touchAction: isDraggable ? 'none' : undefined,
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
              onContextMenu={isDraggable ? (e) => e.preventDefault() : undefined}
            >
              <SocialIcon
                platform={fieldType}
                username={value}
                size="sm"
              />
            </div>
          }
          iconClassName="text-white"
          autoComplete={fieldType === 'email' ? 'email' : undefined}
        />
      )}
    </div>
  );
}; 