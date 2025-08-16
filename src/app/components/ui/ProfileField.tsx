'use client';

import React from 'react';
import CustomInput from './inputs/CustomInput';
import CustomPhoneInput from './inputs/CustomPhoneInput';
import SocialIcon from './SocialIcon';
import type { SocialPlatform, SocialProfileFormEntry, FieldSection } from '@/types/forms';

interface ProfileFieldProps {
  profile: SocialProfileFormEntry;
  dragAndDrop: {
    isDragMode: boolean;
    draggedField: string | null;
    onTouchStart: (fieldId: string) => (event: React.TouchEvent) => void;
    onTouchMove: (event: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  fieldSectionManager: {
    isFieldHidden: (platform: string, viewMode: 'Personal' | 'Work') => boolean;
    toggleFieldVisibility: (platform: string, viewMode: 'Personal' | 'Work') => void;
  };
  getValue: (platform: string, section?: string) => string;
  onChange: (platform: SocialPlatform, value: string, section: FieldSection) => void;
  isUnconfirmed: (platform: string) => boolean;
  onConfirm: (platform: string) => void;
  showDragHandles?: boolean;
  currentViewMode: 'Personal' | 'Work';
  // Phone-specific props
  onPhoneChange?: (value: string) => void;
}

const getPlaceholder = (platform: string): string => {
  switch (platform) {
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
      return `${platform.charAt(0).toUpperCase() + platform.slice(1)} username`;
  }
};

export const ProfileField: React.FC<ProfileFieldProps> = ({
  profile,
  dragAndDrop,
  fieldSectionManager,
  getValue,
  onChange,
  isUnconfirmed,
  onConfirm,
  showDragHandles = true,
  currentViewMode,
  onPhoneChange
}) => {
  const platform = profile.platform;
  const placeholder = getPlaceholder(platform);
  const value = getValue(platform, profile.section);
  
  // Use the isVisible flag from the profile
  const shouldShowAsHidden = !profile.isVisible;

  // Field ID for drag operations
  const fieldId = `${platform}-${profile.section}`;
  
  // Simplified drag state - just check if this field is being dragged
  const isDragging = dragAndDrop.draggedField === fieldId;
  const isDimmed = dragAndDrop.isDragMode && !isDragging;

  return (
    <div 
      data-draggable={showDragHandles ? "true" : "false"}
      data-field-id={fieldId}
      className={`w-full max-w-[var(--max-content-width,448px)] transition-all duration-200 ${isDimmed ? 'opacity-50' : ''}`}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        // If being dragged: invisible (creates empty space)
        // Otherwise: normal or dimmed
        opacity: isDragging ? 0 : undefined,
      }}
      onTouchStart={showDragHandles ? dragAndDrop.onTouchStart(fieldId) : undefined}
      onTouchMove={showDragHandles ? dragAndDrop.onTouchMove : undefined}
      onTouchEnd={showDragHandles ? dragAndDrop.onTouchEnd : undefined}
      onContextMenu={(e) => e.preventDefault()}
    >
      {platform === 'phone' ? (
        <CustomPhoneInput
          onChange={(value) => {
            onPhoneChange?.(value);
            onConfirm(platform);
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
      ) : (
        <CustomInput
          type={platform === 'email' ? 'email' : 'text'}
          id={fieldId}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(platform as SocialPlatform, e.target.value, profile.section);
          }}
          placeholder={placeholder}
          className="w-full"
          inputClassName="pl-2 text-base"
          variant="hideable"
          isHidden={shouldShowAsHidden}
          onToggleHide={() => {
            fieldSectionManager.toggleFieldVisibility(platform, currentViewMode);
            // Mark channel as confirmed when user hides/shows it
            onConfirm(platform);
          }}
          icon={
            <div className="w-5 h-5 flex items-center justify-center relative">
              <SocialIcon 
                platform={platform as SocialPlatform} 
                username={value}
                size="sm" 
              />
              {isUnconfirmed(platform) && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full border border-white"></div>
              )}
            </div>
          }
          iconClassName="text-gray-600"
          autoComplete={platform === 'email' ? 'email' : undefined}
        />
      )}
    </div>
  );
}; 