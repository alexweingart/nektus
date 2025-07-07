'use client';

import React from 'react';
import CustomInput from './inputs/CustomInput';
import SocialIcon from './SocialIcon';
import type { SocialPlatform, SocialProfileFormEntry } from '@/types/forms';

interface SocialProfileFieldProps {
  profile: SocialProfileFormEntry;
  dragAndDrop: {
    isDragMode: boolean;
    draggedField: string | null;
    onTouchStart: (fieldId: string) => (event: React.TouchEvent) => void;
    onTouchMove: (event: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  fieldSectionManager: {
    isFieldHidden: (platform: string) => boolean;
    toggleFieldVisibility: (platform: string) => void;
  };
  getValue: (platform: string) => string;
  onChange: (platform: SocialPlatform, value: string) => void;
  isUnconfirmed: (platform: string) => boolean;
  onConfirm: (platform: string) => void;
  showDragHandles?: boolean;
}

const getPlaceholder = (platform: string): string => {
  switch (platform) {
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

export const SocialProfileField: React.FC<SocialProfileFieldProps> = ({
  profile,
  dragAndDrop,
  fieldSectionManager,
  getValue,
  onChange,
  isUnconfirmed,
  onConfirm,
  showDragHandles = true
}) => {
  const platform = profile.platform;
  const placeholder = getPlaceholder(platform);

  return (
    <div 
      data-draggable={showDragHandles ? "true" : "false"}
      data-field-id={platform}
      className={`mb-5 w-full max-w-[var(--max-content-width,448px)] transition-opacity duration-200 ${
        dragAndDrop.isDragMode && dragAndDrop.draggedField === platform ? 'hidden' : 
        dragAndDrop.isDragMode && dragAndDrop.draggedField !== platform ? 'opacity-70' : ''
      }`}
      onTouchStart={showDragHandles ? dragAndDrop.onTouchStart(platform) : undefined}
      onTouchMove={showDragHandles ? dragAndDrop.onTouchMove : undefined}
      onTouchEnd={showDragHandles ? dragAndDrop.onTouchEnd : undefined}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      <CustomInput
        type="text"
        id={platform}
        value={getValue(platform)}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          onChange(platform as SocialPlatform, e.target.value);
        }}
        placeholder={placeholder}
        className="w-full"
        inputClassName="pl-2 text-base"
        variant="hideable"
        isHidden={fieldSectionManager.isFieldHidden(platform)}
        onToggleHide={() => {
          fieldSectionManager.toggleFieldVisibility(platform);
          // Mark channel as confirmed when user hides/shows it
          onConfirm(platform);
        }}
        dragState={
          !dragAndDrop.isDragMode ? 'normal' : 
          dragAndDrop.draggedField === platform ? 'active' : 'draggable'
        }
        icon={
          <div className="w-5 h-5 flex items-center justify-center relative">
            <SocialIcon 
              platform={platform as SocialPlatform} 
              username={getValue(platform)}
              size="sm" 
            />
            {isUnconfirmed(platform) && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full border border-white"></div>
            )}
          </div>
        }
        iconClassName="text-gray-600"
      />
    </div>
  );
}; 