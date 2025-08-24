'use client';

import React from 'react';
import CustomInput from './inputs/CustomInput';
import CustomPhoneInput from './inputs/CustomPhoneInput';
import SocialIcon from './SocialIcon';
import type { ContactEntry, FieldSection } from '@/types/profile';

interface ProfileFieldProps {
  profile: ContactEntry;
  dragAndDrop?: {
    isDragMode: boolean;
    draggedField: string | null;
    onTouchStart: (fieldId: string) => (event: React.TouchEvent) => void;
    onTouchMove: (event: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  fieldSectionManager: {
    isFieldHidden: (fieldType: string, viewMode: 'Personal' | 'Work') => boolean;
    toggleFieldVisibility: (fieldType: string, viewMode: 'Personal' | 'Work') => void;
  };
  getValue: (fieldType: string, section?: FieldSection) => string;
  onChange: (fieldType: string, value: string, section: FieldSection) => void;
  isUnconfirmed: (fieldType: string) => boolean;
  onConfirm: (fieldType: string) => void;
  showDragHandles?: boolean;
  currentViewMode: 'Personal' | 'Work';
  // Phone-specific props
  onPhoneChange?: (value: string) => void;
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
  const fieldType = profile.fieldType;
  const placeholder = getPlaceholder(fieldType);
  const value = getValue(fieldType, profile.section);
  
  // Use the isVisible flag from the profile
  const shouldShowAsHidden = !profile.isVisible;

  // Field ID for drag operations
  const fieldId = `${fieldType}-${profile.section}`;
  
  // Drag state - check if this field is being dragged (handle cross-section field ID changes)
  const isDragging = dragAndDrop?.draggedField === fieldId || 
                     (dragAndDrop?.draggedField && dragAndDrop.draggedField.split('-')[0] === fieldType);
  const isDimmed = dragAndDrop?.isDragMode && !isDragging;

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
      onTouchStart={showDragHandles && dragAndDrop ? dragAndDrop.onTouchStart(fieldId) : undefined}
      onTouchMove={showDragHandles && dragAndDrop ? dragAndDrop.onTouchMove : undefined}
      onTouchEnd={showDragHandles && dragAndDrop ? dragAndDrop.onTouchEnd : undefined}
      onContextMenu={(e) => e.preventDefault()}
    >
      {fieldType === 'phone' ? (
        <CustomPhoneInput
          onChange={(value) => {
            onPhoneChange?.(value);
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
      ) : (
        <CustomInput
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
            <div className="w-5 h-5 flex items-center justify-center relative">
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
          iconClassName="text-gray-600"
          autoComplete={fieldType === 'email' ? 'email' : undefined}
        />
      )}
    </div>
  );
}; 