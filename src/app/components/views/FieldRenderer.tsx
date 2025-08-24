'use client';

import React, { forwardRef, useImperativeHandle, useState, useRef, useCallback, useMemo, useEffect, memo } from 'react';
import { useSession } from 'next-auth/react';
import { useProfile } from '../../context/ProfileContext';
import type { Session } from 'next-auth';
import type { UserProfile, ContactEntry, FieldSection } from '@/types/profile';
import Image from 'next/image';
import CustomInput from '../ui/inputs/CustomInput';
import CustomExpandingInput from '../ui/inputs/CustomExpandingInput';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { FieldSection as FieldSectionComponent } from '../ui/FieldSection';
import { ProfileField } from '../ui/ProfileField';
import { ProfileViewSelector } from '../ui/ProfileViewSelector';
import { useEditProfileFields, useImageUpload, useProfileViewMode } from '@/lib/hooks/useEditProfileFields';
import { useFreezeScrollOnFocus } from '@/lib/hooks/useFreezeScrollOnFocus';
import { useDragAndDrop } from '@/lib/hooks/useDragAndDrop';

interface FieldRendererProps {
  session?: Session | null;
  onDragStateChange?: (isDragging: boolean) => void;
  onSaveRequest?: () => Promise<void>;
}

export interface FieldRendererHandle {
  saveProfile: () => Promise<void>;
  // Imperative drag API
  getAllFields: () => ContactEntry[];
  getCurrentSection: () => 'Personal' | 'Work';
  swapFields: (fromId: string, toId: string) => void;
}

const FieldRenderer = forwardRef<FieldRendererHandle, FieldRendererProps>(({ 
  session,
  onDragStateChange,
  onSaveRequest
}, ref) => {
  const { profile } = useProfile(); // Get profile directly from context
  const nameInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const initialImages = {
    profileImage: session?.user?.image || profile?.profileImage || '',
    backgroundImage: profile?.backgroundImage || ''
  };
  
  // Custom hooks
  const { createUploadHandler } = useImageUpload();
  const { selectedMode, loadFromStorage, handleModeChange } = useProfileViewMode(carouselRef);
  
  // Unified field management hook
  const fieldSectionManager = useEditProfileFields({
    profile,
    session,
    initialImages
  });
  
  // All fields combined for drag detection - use field manager's order
  const allFields = React.useMemo(() => {
    // Get the field manager's complete order for both Personal and Work
    const personalView = fieldSectionManager.getFieldsForView('Personal');
    const workView = fieldSectionManager.getFieldsForView('Work');
    
    // Combine in the same order as field manager
    const combined = [
      ...personalView.universalFields,
      ...personalView.currentFields,
      ...personalView.hiddenFields,
      ...workView.currentFields,
      ...workView.hiddenFields
    ];
    
    
    return combined;
  }, [fieldSectionManager]);
  
  // Drag and drop functionality
  const {
    isDragMode,
    draggedField,
    fieldOrder,
    currentSwap,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    exitDragMode
  } = useDragAndDrop({
    initialFields: allFields,
    currentSection: selectedMode,
    onDragStateChange,
    onFieldArrayDrop: (dropInfo) => {
      // Handle field reordering when drag is completed
      const { fields, draggedField: draggedFieldData, dragType } = dropInfo;
      
      console.log('[FieldRenderer] onFieldArrayDrop called:', {
        dragType,
        draggedField: `${draggedFieldData.fieldType}-${draggedFieldData.section}`,
        totalFields: fields.length,
        fieldIds: fields.map(f => `${f.fieldType}-${f.section}`)
      });
      
      if (dragType === 'same-section') {
        // Use the existing reorder method for same-section drags
        const fromId = `${draggedFieldData.fieldType}-${draggedFieldData.section}`;
        const draggedIndex = fields.findIndex(f => `${f.fieldType}-${f.section}` === fromId);
        
        if (draggedIndex >= 0) {
          // Find the target position based on field order
          const targetField = fields[draggedIndex + 1] || fields[draggedIndex - 1];
          if (targetField) {
            fieldSectionManager.reorderFieldsInSection(
              draggedFieldData.fieldType,
              targetField.fieldType,
              draggedFieldData.section
            );
          }
        }
      } else if (dragType === 'universal-to-section') {
        // Moving from universal to personal/work section
        console.log('[FieldRenderer] Universal-to-section drag:', {
          draggedField: draggedFieldData.fieldType,
          targetSection: dropInfo.draggedField.section, // This should be the target section
          currentValue: draggedFieldData.value || ''
        });
        
        const targetSection = dropInfo.draggedField.section as 'personal' | 'work';
        fieldSectionManager.splitUniversalField(
          draggedFieldData.fieldType,
          draggedFieldData.value || '',
          targetSection,
          0 // Insert at beginning of section for now
        );
        
      } else if (dragType === 'section-to-universal') {
        // Moving from personal/work to universal section  
        console.log('[FieldRenderer] Section-to-universal drag:', {
          draggedField: draggedFieldData.fieldType,
          fromSection: draggedFieldData.section,
          currentValue: draggedFieldData.value || ''
        });
        
        fieldSectionManager.consolidateToUniversal(
          draggedFieldData.fieldType,
          draggedFieldData.value || '',
          0 // Insert at end of universal section for now
        );
      } else {
        console.warn('Unknown drag type:', dragType);
      }
    }
  });
  
  // TODO: For now, let's disable immediate swapping to avoid infinite loops
  // We'll implement visual feedback through a different mechanism
  // React.useEffect(() => {
  //   if (currentSwap && isDragMode) {
  //     // Apply swap immediately for real-time feedback
  //   }
  // }, [currentSwap, isDragMode, fieldSectionManager]);
  
  // Expose methods to parent via ref - including imperative drag API
  useImperativeHandle(ref, () => ({
    saveProfile: async () => {
      if (!session?.user?.id) return;
      
      // Get current fields at call time, not at creation time
      const currentFields = [
        ...fieldSectionManager.universalFields,
        ...fieldSectionManager.personalFields.filter(f => f.isVisible || (f.value && f.value.trim() !== '')),
        ...fieldSectionManager.workFields.filter(f => f.isVisible || (f.value && f.value.trim() !== ''))
      ];
      
      // Mark all saved fields as confirmed
      currentFields.forEach(field => {
        if (field.value && field.value.trim() !== '') {
          fieldSectionManager.markChannelAsConfirmed(field.fieldType);
        }
      });
      
      // Call parent's save handler if provided
      if (onSaveRequest) {
        await onSaveRequest();
      }
    },
    
    // Imperative drag API
    getAllFields: () => allFields,
    getCurrentSection: () => selectedMode,
    swapFields: (fromId: string, toId: string) => {
      // Parse the IDs to get fieldType and section
      const [fromFieldType, fromSection] = fromId.split('-');
      const [toFieldType, toSection] = toId.split('-');
      
      // If same section, use the new reorder method
      if (fromSection === toSection) {
        fieldSectionManager.reorderFieldsInSection(fromFieldType, toFieldType, fromSection as FieldSection);
      } else {
        console.warn('Cross-section drag not yet implemented in imperative swap handler');
      }
    }
  }), [allFields, selectedMode, fieldSectionManager, onSaveRequest, session]);
  
  useFreezeScrollOnFocus(nameInputRef);
  
  // Initialize on mount
  React.useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);
  
  // Image upload handlers
  const handleProfileImageUpload = createUploadHandler('profile', (imageData) => 
    fieldSectionManager.setImageValue('profileImage', imageData)
  );
  
  const handleBackgroundImageUpload = createUploadHandler('background', (imageData) => 
    fieldSectionManager.setImageValue('backgroundImage', imageData)
  );
  
  // Handle field input change
  const handleFieldChange = (fieldType: string, value: string, section: FieldSection) => {
    fieldSectionManager.markChannelAsConfirmed(fieldType);
    fieldSectionManager.updateFieldValue(fieldType, value, section);
  };
  
  // Get field value using unified state
  const getFieldValue = (fieldType: string, section?: FieldSection): string => {
    if (section) {
      const field = fieldSectionManager.getFieldData(fieldType, section);
      return field?.value || '';
    }
    return fieldSectionManager.getFieldValue(fieldType);
  };
  
  // Get current fields for view (use temp order during drag if available)
  const getCurrentFields = (viewMode: 'Personal' | 'Work') => {
    // During drag mode, use the reordered fieldOrder from drag hook for real-time preview
    if (isDragMode && fieldOrder.length > 0) {
      const sectionName = viewMode.toLowerCase() as 'personal' | 'work';
      const currentSectionName = selectedMode.toLowerCase() as 'personal' | 'work';
      
      // Only use fieldOrder for the current section being dragged
      // For other sections, fall back to field manager
      if (sectionName === currentSectionName) {
        // Compare with field manager order
        const fieldManagerOrder = fieldSectionManager.getFieldsForView(viewMode);
        const fieldManagerIds = [
          ...fieldManagerOrder.universalFields.map(f => `${f.fieldType}-${f.section}`),
          ...fieldManagerOrder.currentFields.map(f => `${f.fieldType}-${f.section}`),
          ...fieldManagerOrder.hiddenFields.map(f => `${f.fieldType}-${f.section}`)
        ];
        
        console.log('[FieldRenderer] Using fieldOrder for visual feedback during drag:', {
          viewMode,
          sectionName,
          totalFieldOrder: fieldOrder.length,
          fieldOrderIds: fieldOrder.map(f => `${f.fieldType}-${f.section}`),
          fieldManagerIds: fieldManagerIds,
          currentSwap: currentSwap,
          draggedField: draggedField,
          orderMismatch: JSON.stringify(fieldOrder.map(f => `${f.fieldType}-${f.section}`)) !== JSON.stringify(fieldManagerIds)
        });
        // Filter fields for current view mode from the reordered fieldOrder
        const currentFields = fieldOrder.filter(field => 
          field.isVisible && field.section === sectionName
        );
        
        const hiddenFields = fieldOrder.filter(field => 
          !field.isVisible && field.section === sectionName
        );
        
        const universalFields = fieldOrder.filter(field => 
          field.section === 'universal'
        );
        
        return { currentFields, hiddenFields, universalFields };
      }
    }
    
    // When not dragging or not the active section, use the field manager's view
    return fieldSectionManager.getFieldsForView(viewMode);
  };
  
  // Render content for a specific view (Personal or Work)
  const renderViewContent = (viewMode: 'Personal' | 'Work') => {
    const { currentFields, hiddenFields } = getCurrentFields(viewMode);
    
    return (
      <>
        {/* Current Section */}
        <FieldSectionComponent
          title={viewMode}
          isEmpty={currentFields.length === 0}
          emptyText={`You have no ${viewMode} networks right now. Drag & drop an input field to change that.`}
        >
          {currentFields.map((profile, index) => {
            const fieldType = profile.fieldType;
            const uniqueKey = `${profile.section}-${fieldType}-${index}`;
              
            return (
              <ProfileField
                key={uniqueKey}
                profile={profile}
                fieldSectionManager={fieldSectionManager}
                getValue={getFieldValue}
                onChange={handleFieldChange}
                isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                onConfirm={fieldSectionManager.markChannelAsConfirmed}
                currentViewMode={viewMode}
                showDragHandles={true}
                dragAndDrop={{
                  isDragMode,
                  draggedField,
                  onTouchStart,
                  onTouchMove,
                  onTouchEnd
                }}
              />
            );
          })}
        </FieldSectionComponent>

        {/* Hidden Fields */}
        {hiddenFields.length > 0 && (
          <FieldSectionComponent
            title="Hidden"
            isEmpty={false}
            emptyText=""
          >
            {hiddenFields.map((profile, index) => {
              const fieldType = profile.fieldType;
              const uniqueKey = `hidden-${fieldType}-${index}`;
                
              return (
                <ProfileField
                  key={uniqueKey}
                  profile={profile}
                  fieldSectionManager={fieldSectionManager}
                  getValue={getFieldValue}
                  onChange={handleFieldChange}
                  isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                  onConfirm={fieldSectionManager.markChannelAsConfirmed}
                  currentViewMode={viewMode}
                  showDragHandles={true}
                  dragAndDrop={{
                    isDragMode,
                    draggedField,
                    onTouchStart,
                    onTouchMove,
                    onTouchEnd
                  }}
                />
              );
            })}
          </FieldSectionComponent>
        )}
      </>
    );
  };
  
  // Get universal fields for the top section
  const getUniversalFields = () => {
    if (isDragMode && fieldOrder.length > 0) {
      // During drag mode, use reordered universal fields from fieldOrder
      return fieldOrder.filter(field => field.section === 'universal');
    }
    // When not dragging, use the field manager's universal fields
    const { universalFields } = fieldSectionManager.getFieldsForView('Personal');
    return universalFields;
  };
  
  const universalFields = getUniversalFields();
  
  return (
    <div className="flex flex-col items-center py-4 pb-8 relative space-y-5" data-drag-container>
      {/* Universal Section */}
      <FieldSectionComponent
        isEmpty={false}
        emptyText=""
        className="w-full max-w-[var(--max-content-width,448px)]"
        bottomButton={
          <div className="text-center">
            <SecondaryButton 
              className="cursor-pointer"
              onClick={() => {
                backgroundInputRef.current?.click();
              }}
            >
              Edit Background
            </SecondaryButton>
            <input 
              ref={backgroundInputRef}
              type="file" 
              className="hidden"
              accept="image/*"
              onChange={handleBackgroundImageUpload}
            />
          </div>
        }
      >
        {/* Name Input with Profile Image */}
        <div className="w-full max-w-md mx-auto">
          <CustomInput
            ref={nameInputRef}
            type="text"
            id="name"
            value={fieldSectionManager.getFieldValue('name')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              fieldSectionManager.setFieldValue('name', e.target.value)
            }
            placeholder="Full Name"
            className="w-full"
            icon={
              <label className="cursor-pointer flex items-center justify-center w-full h-full">
                {fieldSectionManager.getImageValue('profileImage') ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white">
                    <Image
                      src={fieldSectionManager.getImageValue('profileImage').includes('firebasestorage.app') 
                        ? (fieldSectionManager.getImageValue('profileImage').includes('?') 
                            ? `${fieldSectionManager.getImageValue('profileImage')}&cb=${Date.now()}` 
                            : `${fieldSectionManager.getImageValue('profileImage')}?cb=${Date.now()}`)
                        : fieldSectionManager.getImageValue('profileImage')}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="object-cover w-full h-full"
                      unoptimized={fieldSectionManager.getImageValue('profileImage')?.includes('firebasestorage.app')}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400 text-xl">👤</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfileImageUpload}
                />
              </label>
            }
          />
        </div>

        {/* Bio Input */}
        <div className="w-full max-w-md mx-auto">
          <CustomExpandingInput
            id="bio"
            value={fieldSectionManager.getFieldValue('bio')}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
              fieldSectionManager.setFieldValue('bio', e.target.value)
            }
            placeholder="Add a short bio..."
            className="w-full"
            maxLength={280}
          />
        </div>

        {/* All Universal Fields (excluding name/bio) */}
        {universalFields.filter(field => !['name', 'bio'].includes(field.fieldType)).map((profile, index) => {
          const fieldType = profile.fieldType;
          const uniqueKey = `universal-${fieldType}-${index}`;
          
          // Special handling for phone field
          if (fieldType === 'phone') {
            return (
              <div key={uniqueKey} className="w-full max-w-md mx-auto">
                <ProfileField
                  profile={{
                    fieldType: 'phone',
                    section: 'universal',
                    value: '',
                    isVisible: true,
                    order: profile.order || 0,
                    confirmed: profile.confirmed
                  }}
                  fieldSectionManager={fieldSectionManager}
                  getValue={getFieldValue}
                  onChange={handleFieldChange}
                  onPhoneChange={(value) => {
                    handleFieldChange('phone', value, 'universal');
                  }}
                  isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                  onConfirm={fieldSectionManager.markChannelAsConfirmed}
                  currentViewMode={selectedMode}
                  showDragHandles={true}
                  dragAndDrop={{
                    isDragMode,
                    draggedField,
                    onTouchStart,
                    onTouchMove,
                    onTouchEnd
                  }}
                />
              </div>
            );
          }
          
          // Special handling for email field
          if (fieldType === 'email') {
            return (
              <div key={uniqueKey} className="w-full max-w-md mx-auto">
                <ProfileField
                  profile={{
                    fieldType: 'email',
                    section: 'universal',
                    value: '',
                    isVisible: true,
                    order: profile.order || 1,
                    confirmed: profile.confirmed
                  }}
                  fieldSectionManager={fieldSectionManager}
                  getValue={getFieldValue}
                  onChange={handleFieldChange}
                  isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                  onConfirm={fieldSectionManager.markChannelAsConfirmed}
                  currentViewMode={selectedMode}
                  showDragHandles={true}
                  dragAndDrop={{
                    isDragMode,
                    draggedField,
                    onTouchStart,
                    onTouchMove,
                    onTouchEnd
                  }}
                />
              </div>
            );
          }
          
          // Regular universal social fields
          return (
            <div key={uniqueKey} className="w-full max-w-md mx-auto">
              <ProfileField
                profile={profile}
                fieldSectionManager={fieldSectionManager}
                getValue={getFieldValue}
                onChange={handleFieldChange}
                isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                onConfirm={fieldSectionManager.markChannelAsConfirmed}
                currentViewMode={selectedMode}
                showDragHandles={true}
                dragAndDrop={{
                  isDragMode,
                  draggedField,
                  onTouchStart,
                  onTouchMove,
                  onTouchEnd
                }}
              />
            </div>
          );
        })}
      </FieldSectionComponent>

      {/* Carousel Container */}
      <div className="w-full max-w-[var(--max-content-width,448px)] mx-auto overflow-hidden">
        <div 
          ref={carouselRef}
          className="flex gap-4 transition-transform duration-300 ease-out"
        >
          {/* Personal View */}
          <div className="w-full flex-shrink-0 space-y-5">
            {renderViewContent('Personal')}
          </div>
          
          {/* Work View */}
          <div className="w-full flex-shrink-0 space-y-5">
            {renderViewContent('Work')}
          </div>
        </div>
      </div>
      
      {/* Sticky Profile View Selector */}
      <div className="sticky bottom-8 left-0 right-0 z-50 mt-8">
        <div className="flex justify-center">
          <ProfileViewSelector
            selectedMode={selectedMode}
            onModeChange={handleModeChange}
            className="w-48"
          />
        </div>
      </div>
    </div>
  );
});

FieldRenderer.displayName = 'FieldRenderer';

export default FieldRenderer;