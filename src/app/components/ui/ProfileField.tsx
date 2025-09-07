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
    draggedField: ContactEntry | null;
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
  isBeingDragged?: boolean;
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
  isBeingDragged: _isBeingDragged = false,
  onPhoneChange
}) => {
  const fieldType = profile.fieldType;
  const placeholder = getPlaceholder(fieldType);
  const value = getValue(fieldType, profile.section);
  
  // Use the isVisible flag from the profile
  const shouldShowAsHidden = !profile.isVisible;

  // Field ID for drag operations
  const fieldId = `${fieldType}-${profile.section}`;
  


  // Drag state - use new isBeingDragged prop for more accurate tracking  
  // Check if this field is being dragged by comparing ContactEntry objects
  const isThisFieldBeingDragged = dragAndDrop?.draggedField && 
    dragAndDrop.draggedField.fieldType === profile.fieldType &&
    dragAndDrop.draggedField.section === profile.section;
    
  const isDimmed = dragAndDrop?.isDragMode && !isThisFieldBeingDragged;


  return (
    <div>
      {/* Main field content */}
      <div 
        data-draggable={showDragHandles && !shouldShowAsHidden ? "true" : "false"}
        data-field-id={fieldId}
        data-order={profile.order}
        data-section={profile.section}
        className={`w-full max-w-[var(--max-content-width,448px)] transition-all duration-200 ${isDimmed ? 'opacity-50' : ''}`}
        style={{
          // When being dragged: remove from layout flow completely to eliminate spacing
          display: isThisFieldBeingDragged ? 'none' : 'block',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none'
        }}
      >
      {fieldType === 'phone' ? (
        <div className="relative w-full">
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
          {/* Drag overlay for phone country selector area */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-16 z-20 flex items-center justify-center"
            onTouchStart={showDragHandles && dragAndDrop && !shouldShowAsHidden ? dragAndDrop.onTouchStart(fieldId) : undefined}
            onTouchMove={showDragHandles && dragAndDrop && !shouldShowAsHidden ? dragAndDrop.onTouchMove : undefined}
            onTouchEnd={showDragHandles && dragAndDrop && !shouldShowAsHidden ? dragAndDrop.onTouchEnd : undefined}
            onContextMenu={(e) => e.preventDefault()}
            style={{ pointerEvents: showDragHandles && dragAndDrop && !shouldShowAsHidden ? 'auto' : 'none' }}
          />
        </div>
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
            <div 
              className="w-5 h-5 flex items-center justify-center relative"
              onTouchStart={showDragHandles && dragAndDrop && !shouldShowAsHidden ? dragAndDrop.onTouchStart(fieldId) : undefined}
              onTouchMove={showDragHandles && dragAndDrop && !shouldShowAsHidden ? dragAndDrop.onTouchMove : undefined}
              onTouchEnd={showDragHandles && dragAndDrop && !shouldShowAsHidden ? dragAndDrop.onTouchEnd : undefined}
              onContextMenu={(e) => e.preventDefault()}
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
          iconClassName="text-gray-600"
          autoComplete={fieldType === 'email' ? 'email' : undefined}
        />
      )}
      </div>
    </div>
  );
}; 