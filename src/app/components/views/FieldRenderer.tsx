'use client';

import React, { forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import type { Session } from 'next-auth';
import type { ContactEntry, FieldSection } from '@/types/profile';
import type { UseEditProfileFieldsReturn } from '@/lib/hooks/useEditProfileFields';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import CustomInput from '../ui/inputs/CustomInput';
import CustomExpandingInput from '../ui/inputs/CustomExpandingInput';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { FieldSection as FieldSectionComponent } from '../ui/FieldSection';
import { ProfileField } from '../ui/ProfileField';
import { ProfileViewSelector } from '../ui/ProfileViewSelector';
import { DropZone } from '../ui/DropZone';
import { useImageUpload, useProfileViewMode } from '@/lib/hooks/useEditProfileFields';
import { useFreezeScrollOnFocus } from '@/lib/hooks/useFreezeScrollOnFocus';
import { useDragAndDrop, type DragDropInfo } from '@/lib/hooks/useDragAndDrop';
import { calculateViewDropZoneMap } from '@/lib/utils/dragUtils';

interface FieldRendererProps {
  session?: Session | null;
  fieldSectionManager: UseEditProfileFieldsReturn;
  initialFields: ContactEntry[]; // Stable field data from parent
  selectedMode: 'Personal' | 'Work';
  onModeChange: (mode: 'Personal' | 'Work') => void;
  onSaveRequest?: () => Promise<void>;
  onDragStateChange?: (isDragging: boolean) => void;
  onDragComplete: (dropInfo: DragDropInfo) => void;
}

export interface FieldRendererHandle {
  saveProfile: () => Promise<void>;
}

const FieldRenderer = forwardRef<FieldRendererHandle, FieldRendererProps>(({ 
  session,
  fieldSectionManager,
  initialFields,
  selectedMode,
  onModeChange,
  onSaveRequest,
  onDragStateChange,
  onDragComplete
}, ref) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  // Custom hooks
  const { createUploadHandler } = useImageUpload();
  const { loadFromStorage, handleModeChange: handleCarouselModeChange } = useProfileViewMode(carouselRef);
  
  
  // Drag and drop functionality - manages state internally
  const {
    isDragMode,
    draggedField,
    activeDropZone,
    onTouchStart,
    onTouchMove,
    onTouchEnd
  } = useDragAndDrop({
    initialFields, // Stable from parent - never changes during drag
    currentSection: selectedMode,
    onDragStateChange,
    onFieldArrayDrop: onDragComplete // Event-based communication
  });
  
  
  
  // Handle mode change - update both carousel and parent state
  const handleModeChange = useCallback((mode: 'Personal' | 'Work') => {
    handleCarouselModeChange(mode);
    onModeChange(mode);
  }, [handleCarouselModeChange, onModeChange]);
  
  
  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    saveProfile: async () => {
      if (!session?.user?.id) return;
      
      // Mark all saved fields as confirmed
      const currentFields = [
        ...fieldSectionManager.getFieldsBySection('universal'),
        ...fieldSectionManager.getFieldsBySection('personal').filter(f => f.isVisible || (f.value && f.value.trim() !== '')),
        ...fieldSectionManager.getFieldsBySection('work').filter(f => f.isVisible || (f.value && f.value.trim() !== ''))
      ];
      
      currentFields.forEach(field => {
        if (field.value && field.value.trim() !== '') {
          fieldSectionManager.markChannelAsConfirmed(field.fieldType);
        }
      });
      
      // Call parent's save handler if provided
      if (onSaveRequest) {
        await onSaveRequest();
      }
    }
  }), [fieldSectionManager, onSaveRequest, session]);
  
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
  
  // Get fields for view using simplified API
  const getFieldsForView = (viewMode: 'Personal' | 'Work') => {
    const sectionName = viewMode.toLowerCase() as 'personal' | 'work';
    return {
      // Only show fields that belong to this specific section (not universal fields)
      visibleFields: fieldSectionManager.getVisibleFields(sectionName),
      hiddenFields: fieldSectionManager.getHiddenFieldsForView(viewMode)
    };
  };
  
  // Render content for a specific view (Personal or Work) with new DropZone logic
  const renderViewContent = (viewMode: 'Personal' | 'Work') => {
    const { visibleFields, hiddenFields } = getFieldsForView(viewMode);
    
    // Calculate DropZone map for this view
    const dropZoneMap = isDragMode ? calculateViewDropZoneMap(initialFields, viewMode, draggedField) : [];
    
    // Create an array that interleaves DropZones and Fields in the correct order
    const renderItems: Array<{ type: 'dropzone' | 'field'; data: any; key: string }> = [];
    
    // Get all DropZones for this section
    const sectionName = viewMode.toLowerCase();
    const sectionDropZones = dropZoneMap.filter(dz => dz.section === sectionName);
    
    // Simple logic: Add drop zone before each field, then add field
    visibleFields.forEach((profile, fieldIndex) => {
      const isThisDraggedField = draggedField?.fieldType === profile.fieldType && draggedField?.section === profile.section;
      
      // Find the drop zone that should appear above this field
      // It's the one with belowFieldType matching this field's fieldType
      const dropZoneAbove = sectionDropZones.find(dz => 
        dz.belowFieldType === profile.fieldType
      );
      
      // Add drop zone above this field (if it exists and field isn't being dragged)
      if (dropZoneAbove && !isThisDraggedField) {
        renderItems.push({
          type: 'dropzone',
          data: dropZoneAbove,
          key: `dz-${dropZoneAbove.order}-${dropZoneAbove.section}`
        });
      }
      
      // Add the field
      renderItems.push({
        type: 'field',
        data: { ...profile, isBeingDragged: isThisDraggedField },
        key: `field-${profile.section}-${profile.fieldType}-${fieldIndex}`
      });
    });
    
    // Add the final 'bottom' drop zone for this section
    // IMPORTANT: Always add this even if visibleFields is empty so empty sections can receive drops
    const bottomDropZone = sectionDropZones.find(dz => dz.belowFieldType === 'bottom');
    if (bottomDropZone) {
      renderItems.push({
        type: 'dropzone',
        data: bottomDropZone,
        key: `dz-${bottomDropZone.order}-${bottomDropZone.section}`
      });
    }
    
    return (
      <>
        {/* Current Section */}
        <FieldSectionComponent
          title={viewMode}
          isEmpty={visibleFields.length === 0}
          emptyText={`You have no ${viewMode} networks right now. Drag & drop an input field to change that.`}
        >
          {renderItems.map(item => {
            if (item.type === 'dropzone') {
              const dropZone = item.data;
              return (
                <DropZone
                  key={item.key}
                  order={dropZone.order}
                  section={dropZone.section}
                  isActive={activeDropZone?.order === dropZone.order && activeDropZone?.section === dropZone.section}
                />
              );
            } else {
              const profile = item.data;
              return (
                <ProfileField
                  key={item.key}
                  profile={profile}
                  fieldSectionManager={fieldSectionManager}
                  getValue={getFieldValue}
                  onChange={handleFieldChange}
                  isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                  onConfirm={fieldSectionManager.markChannelAsConfirmed}
                  currentViewMode={viewMode}
                  showDragHandles={true}
                  isBeingDragged={profile.isBeingDragged}
                  dragAndDrop={{
                    isDragMode,
                    draggedField,
                    onTouchStart,
                    onTouchMove,
                    onTouchEnd
                  }}
                />
              );
            }
          })}
        </FieldSectionComponent>

        {/* Hidden Fields */}
        {hiddenFields.length > 0 && (
          <FieldSectionComponent
            title="Hidden"
            isEmpty={false}
            emptyText=""
            bottomButton={
              <div className="text-center">
                <SecondaryButton 
                  className="cursor-pointer text-white bg-red-500/50 hover:bg-red-600/50"
                  onClick={() => signOut()}
                >
                  Sign Out
                </SecondaryButton>
              </div>
            }
          >
            {hiddenFields.map((profile, index) => {
              const fieldType = profile.fieldType;
              const uniqueKey = `hidden-${fieldType}-${index}`;
                
              return (
                <React.Fragment key={uniqueKey}>
                  {/* NO DropZone above hidden fields - they can't be drop targets */}
                  <ProfileField
                    profile={profile}
                    fieldSectionManager={fieldSectionManager}
                    getValue={getFieldValue}
                    onChange={handleFieldChange}
                    isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                    onConfirm={fieldSectionManager.markChannelAsConfirmed}
                    currentViewMode={viewMode}
                    showDragHandles={true}
                    isBeingDragged={draggedField?.fieldType === profile.fieldType && draggedField?.section === profile.section}
                    dragAndDrop={{
                      isDragMode,
                      draggedField,
                      onTouchStart,
                      onTouchMove,
                      onTouchEnd
                    }}
                  />
                </React.Fragment>
              );
            })}
            
            {/* NO final DropZone after hidden fields - they can't be drop targets */}
          </FieldSectionComponent>
        )}
      </>
    );
  };
  
  // Get universal fields for the top section
  const universalFields = fieldSectionManager.getFieldsBySection('universal');
  
  return (
    <div className="flex flex-col items-center relative space-y-5" data-drag-container>
      {/* Universal Section */}
      <FieldSectionComponent
        isEmpty={false}
        emptyText=""
        className="w-full"
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

        {/* Universal Fields Section */}
        <FieldSectionComponent
          isEmpty={false}
          emptyText=""
          className="w-full"
        >
          {(() => {
          // Get draggable universal fields (exclude name/bio)
          const draggableUniversalFields = universalFields.filter(field => !['name', 'bio'].includes(field.fieldType));
          
          // Calculate DropZone map for universal fields if in drag mode
          const universalDropZoneMap = isDragMode ? calculateViewDropZoneMap(initialFields, selectedMode, draggedField) : [];
          
          // Create an array that interleaves DropZones and Fields
          const renderItems: Array<{ type: 'dropzone' | 'field'; data: any; key: string }> = [];
          
          // Get all universal DropZones
          const universalSectionDropZones = universalDropZoneMap.filter(dz => dz.section === 'universal');
          
          // Simple logic: Add drop zone before each field, then add field
          draggableUniversalFields.forEach((profile, fieldIndex) => {
            const isThisDraggedField = draggedField?.fieldType === profile.fieldType && draggedField?.section === profile.section;
            
            // Find the drop zone that should appear above this field
            const dropZoneAbove = universalSectionDropZones.find(dz => 
              dz.belowFieldType === profile.fieldType
            );
            
            // Add drop zone above this field (if it exists and field isn't being dragged)
            if (dropZoneAbove && !isThisDraggedField) {
              renderItems.push({
                type: 'dropzone',
                data: dropZoneAbove,
                key: `dz-${dropZoneAbove.order}-${dropZoneAbove.section}`
              });
            }
            
            // Add the field
            renderItems.push({
              type: 'field',
              data: { ...profile, isBeingDragged: isThisDraggedField, fieldIndex },
              key: `universal-${profile.fieldType}-${fieldIndex}`
            });
          });
          
          // Add the final 'bottom' drop zone for universal section
          const bottomDropZone = universalSectionDropZones.find(dz => dz.belowFieldType === 'bottom');
          if (bottomDropZone) {
            renderItems.push({
              type: 'dropzone',
              data: bottomDropZone,
              key: `dz-${bottomDropZone.order}-${bottomDropZone.section}`
            });
          }
          
          // Now render the interleaved items
          return renderItems.map(item => {
            if (item.type === 'dropzone') {
              const dropZone = item.data;
              return (
                <DropZone
                  key={item.key}
                  order={dropZone.order}
                  section={dropZone.section}
                  isActive={activeDropZone?.order === dropZone.order && activeDropZone?.section === dropZone.section}
                />
              );
            } else {
              const profile = item.data;
              const fieldType = profile.fieldType;
              const isThisDraggedField = profile.isBeingDragged;
          
              // Special handling for phone field
              if (fieldType === 'phone') {
                return (
                  <div 
                    key={item.key}
                    className="w-full max-w-md mx-auto"
                    style={{
                      display: isThisDraggedField ? 'none' : 'block'
                    }}
                  >
                    <ProfileField
                      profile={profile}
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
                      isBeingDragged={isThisDraggedField}
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
                  <div 
                    key={item.key}
                    className="w-full max-w-md mx-auto"
                    style={{
                      display: isThisDraggedField ? 'none' : 'block'
                    }}
                  >
                    <ProfileField
                      profile={profile}
                      fieldSectionManager={fieldSectionManager}
                      getValue={getFieldValue}
                      onChange={handleFieldChange}
                      isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                      onConfirm={fieldSectionManager.markChannelAsConfirmed}
                      currentViewMode={selectedMode}
                      showDragHandles={true}
                      isBeingDragged={isThisDraggedField}
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
                <div 
                  key={item.key}
                  className="w-full max-w-md mx-auto"
                  style={{
                    display: isThisDraggedField ? 'none' : 'block'
                  }}
                >
                  <ProfileField
                    profile={profile}
                    fieldSectionManager={fieldSectionManager}
                    getValue={getFieldValue}
                    onChange={handleFieldChange}
                    isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                    onConfirm={fieldSectionManager.markChannelAsConfirmed}
                    currentViewMode={selectedMode}
                    showDragHandles={true}
                    isBeingDragged={isThisDraggedField}
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
          });
        })()}
        </FieldSectionComponent>
      </FieldSectionComponent>

      {/* Carousel Container */}
      <div className="w-full overflow-hidden">
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