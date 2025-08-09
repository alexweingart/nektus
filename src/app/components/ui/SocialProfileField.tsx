'use client';

import React, { useRef, useEffect } from 'react';
import CustomInput from './inputs/CustomInput';
import SocialIcon from './SocialIcon';
import type { SocialPlatform, SocialProfileFormEntry, FieldSection } from '@/types/forms';

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
    isFieldHidden: (platform: string, viewMode: 'Personal' | 'Work') => boolean;
    toggleFieldVisibility: (platform: string, viewMode: 'Personal' | 'Work') => void;
  };
  getValue: (platform: string, section?: string) => string;
  onChange: (platform: SocialPlatform, value: string, section: FieldSection) => void;
  isUnconfirmed: (platform: string) => boolean;
  onConfirm: (platform: string) => void;
  showDragHandles?: boolean;
  currentViewMode: 'Personal' | 'Work';
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
  showDragHandles = true,
  currentViewMode
}) => {
  const platform = profile.platform;
  const placeholder = getPlaceholder(platform);
  const value = getValue(platform, profile.section);
  const invisibleSpacerRef = useRef<HTMLDivElement>(null);
  const visibleFieldRef = useRef<HTMLDivElement>(null);
  
  // Use the isVisible flag from the profile
  const shouldShowAsHidden = !profile.isVisible;

  // Simplified field visibility: Hide field if it's being dragged
  const fieldId = `${platform}-${profile.section}`;
  const shouldHideField = dragAndDrop.isDragMode && dragAndDrop.draggedField === fieldId;
  


  // If field should be hidden during drag, render passive spacer to preserve layout
  if (shouldHideField) {
    return (
      <div 
        ref={invisibleSpacerRef}
        data-draggable="true" // CRITICAL: Prevents handleClickOutside from exiting drag mode
        data-field-id={fieldId}
        className="mb-5 w-full max-w-[var(--max-content-width,448px)]"
        style={{ height: '56px' }}
        onTouchStart={(e) => {
          console.log('🟢 INVISIBLE touchstart');
          dragAndDrop.onTouchStart(fieldId)(e);
        }}
        onTouchMove={(e) => {
          console.log('🟢 INVISIBLE touchmove');
          dragAndDrop.onTouchMove(e);
        }}
        onTouchEnd={(e) => {
          console.log('🟢 INVISIBLE touchend');
          dragAndDrop.onTouchEnd();
        }}
      />
    );
  }

  return (
    <div 
      ref={visibleFieldRef}
      data-draggable={showDragHandles ? "true" : "false"}
      data-field-id={`${platform}-${profile.section}`}
      className={`mb-5 w-full max-w-[var(--max-content-width,448px)] transition-opacity duration-200 ${
        dragAndDrop.isDragMode && dragAndDrop.draggedField !== fieldId ? 'opacity-70' : ''
      }`}
      onTouchStart={showDragHandles ? (e) => {
        console.log('🟢 VISIBLE touchstart');
        dragAndDrop.onTouchStart(fieldId)(e);
      } : undefined}
      onTouchMove={showDragHandles ? (e) => {
        console.log('🟢 VISIBLE touchmove');
        dragAndDrop.onTouchMove(e);
      } : undefined}
      onTouchEnd={showDragHandles ? (e) => {
        console.log('🟢 VISIBLE touchend');
        dragAndDrop.onTouchEnd();
      } : undefined}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      <CustomInput
        type="text"
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
        dragState={
          !dragAndDrop.isDragMode ? 'normal' : 
          dragAndDrop.draggedField === fieldId ? 'active' : 'draggable'
        }
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
      />
    </div>
  );
}; 