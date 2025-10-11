'use client';

import React, { forwardRef, useImperativeHandle, useRef, useCallback, useState } from 'react';
import type { Session } from 'next-auth';
import type { ContactEntry, FieldSection } from '@/types/profile';
import type { UseEditProfileFieldsReturn } from '@/lib/hooks/useEditProfileFields';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CustomInput from '../ui/inputs/CustomInput';
import CustomExpandingInput from '../ui/inputs/CustomExpandingInput';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { FieldSection as FieldSectionComponent } from '../ui/FieldSection';
import { ProfileField } from '../ui/ProfileField';
import { ProfileViewSelector } from '../ui/ProfileViewSelector';
import { DropZone } from '../ui/DropZone';
import ProfileImageIcon from '../ui/ProfileImageIcon';
import { ItemChip } from '../ui/ItemChip';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { AddLocationModal } from '../ui/modals/AddLocationModal';
import { AddLinkModal } from '../ui/modals/AddLinkModal';
import { InlineAddLink } from '../ui/InlineAddLink';
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
  profile?: any; // UserProfile from context
  saveProfile?: (data: Partial<any>) => Promise<any>;
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
  onDragComplete,
  saveProfile,
  profile
}, ref) => {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [modalSection, setModalSection] = useState<'personal' | 'work'>('personal');

  // Inline add link state
  const [showInlineAddLink, setShowInlineAddLink] = useState<{ personal: boolean; work: boolean }>({
    personal: false,
    work: false
  });

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

  // Helper functions to get calendar/location for a section
  const getCalendarForSection = (section: 'personal' | 'work') => {
    return profile?.calendars?.find((cal: any) => cal.section === section);
  };

  const getLocationForSection = (section: 'personal' | 'work') => {
    return profile?.locations?.find((loc: any) => loc.section === section);
  };

  // Modal handlers
  const handleOpenCalendarModal = (section: 'personal' | 'work') => {
    setModalSection(section);
    setIsCalendarModalOpen(true);
  };

  const handleOpenLocationModal = (section: 'personal' | 'work') => {
    setModalSection(section);
    setIsLocationModalOpen(true);
  };

  const handleOpenLinkModal = (section: 'personal' | 'work') => {
    setModalSection(section);
    setIsLinkModalOpen(true);
  };

  const handleToggleInlineAddLink = (section: 'personal' | 'work') => {
    setShowInlineAddLink(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleCalendarAdded = async () => {
    // Calendar added via API in modal, close modal first
    setIsCalendarModalOpen(false);

    // Reload page to show newly added calendar (matches Google/Microsoft OAuth flow)
    window.location.reload();
  };

  const handleLocationAdded = async (locations: any[]) => {
    console.log('[FieldRenderer] handleLocationAdded called with locations:', locations);

    // Update profile locations directly (locations are special, not regular fields)
    if (profile) {
      profile.locations = profile.locations || [];
      locations.forEach(loc => {
        // Remove existing location for this section if any
        profile.locations = profile.locations.filter((l: any) => l.section !== loc.section);
        // Add the new location
        profile.locations.push(loc);
      });
    }

    setIsLocationModalOpen(false);

    // Trigger profile save
    if (onSaveRequest) {
      await onSaveRequest();
    }
  };

  const handleLinkAdded = (entries: ContactEntry[]) => {
    console.log('[FieldRenderer] handleLinkAdded called with entries:', entries);
    // Add links to field manager
    fieldSectionManager.addFields(entries);
    entries.forEach(entry => {
      fieldSectionManager.markChannelAsConfirmed(entry.fieldType);
    });
    setIsLinkModalOpen(false);
    // Close inline add link for all sections
    setShowInlineAddLink({ personal: false, work: false });
    console.log('[FieldRenderer] handleLinkAdded completed');
  };

  const handleDeleteCalendar = async (section: 'personal' | 'work') => {
    const calendar = getCalendarForSection(section);
    if (!calendar) return;

    try {
      const response = await fetch(`/api/calendar-connections/${calendar.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete calendar');

      // Update profile state to remove the deleted calendar
      if (saveProfile && profile) {
        const updatedCalendars = profile.calendars?.filter((cal: any) => cal.id !== calendar.id) || [];
        await saveProfile({ calendars: updatedCalendars });
      }
    } catch (error) {
      console.error('[FieldRenderer] Failed to delete calendar:', error);
    }
  };

  const handleDeleteLocation = async (section: 'personal' | 'work') => {
    const location = getLocationForSection(section);
    if (!location) return;

    try {
      // Update profile state to remove the deleted location
      if (saveProfile && profile) {
        const updatedLocations = profile.locations?.filter((loc: any) => loc.id !== location.id) || [];
        await saveProfile({ locations: updatedLocations });
      }
    } catch (error) {
      console.error('[FieldRenderer] Failed to delete location:', error);
    }
  };
  
  // Get field value using unified state
  const getFieldValue = (fieldType: string, section?: FieldSection): string => {
    if (section) {
      const field = fieldSectionManager.getFieldData(fieldType, section);
      console.log('[FieldRenderer.getFieldValue]', { fieldType, section, field, value: field?.value });
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
  // Shared type definitions
  type DropZoneData = { order: number; section: string; belowFieldType: string; midpointY?: number };
  type FieldData = ContactEntry & { isBeingDragged?: boolean; fieldIndex?: number };

  // Shared utility for building interleaved dropzone/field render arrays
  const buildRenderItemsArray = (
    fields: ContactEntry[],
    dropZoneMap: DropZoneData[],
    sectionName: string
  ): Array<
    | { type: 'dropzone'; data: DropZoneData; key: string }
    | { type: 'field'; data: FieldData; key: string }
  > => {
    const renderItems: Array<
      | { type: 'dropzone'; data: DropZoneData; key: string }
      | { type: 'field'; data: FieldData; key: string }
    > = [];

    // Get all DropZones for this section
    const sectionDropZones = dropZoneMap.filter(dz => dz.section === sectionName);

    // Drop zone with belowFieldType='email' should appear BEFORE the email field
    // This represents where a dragged field would be dropped to appear before email
    fields.forEach((profile, fieldIndex) => {
      const isThisDraggedField = draggedField?.fieldType === profile.fieldType && draggedField?.section === profile.section;

      // Find drop zone that should appear before THIS field
      // belowFieldType='email' means "the zone before email field"
      const dropZoneBeforeThisField = sectionDropZones.find(dz =>
        dz.belowFieldType === profile.fieldType
      );

      // Add drop zone before this field (if it exists)
      if (dropZoneBeforeThisField) {
        renderItems.push({
          type: 'dropzone',
          data: dropZoneBeforeThisField,
          key: `dz-${dropZoneBeforeThisField.order}-${dropZoneBeforeThisField.section}`
        });
      }

      // Add the field (unless it's being dragged)
      if (!isThisDraggedField) {
        renderItems.push({
          type: 'field',
          data: { ...profile, isBeingDragged: false, fieldIndex },
          key: sectionName === 'universal' ? `universal-${profile.fieldType}-${fieldIndex}` : `field-${profile.section}-${profile.fieldType}-${fieldIndex}`
        });
      }
    });

    // Add the final 'bottom' drop zone for this section
    const bottomDropZone = sectionDropZones.find(dz => dz.belowFieldType === 'bottom');
    if (bottomDropZone) {
      renderItems.push({
        type: 'dropzone',
        data: bottomDropZone,
        key: `dz-${bottomDropZone.order}-${bottomDropZone.section}`
      });
    }

    return renderItems;
  };

  // Render function for universal fields with consolidated logic
  const renderUniversalField = (profile: FieldData, key: string, isThisDraggedField: boolean) => {
    const commonProps = {
      profile,
      fieldSectionManager,
      getValue: getFieldValue,
      onChange: handleFieldChange,
      isUnconfirmed: fieldSectionManager.isChannelUnconfirmed,
      onConfirm: fieldSectionManager.markChannelAsConfirmed,
      currentViewMode: selectedMode,
      showDragHandles: true,
      isBeingDragged: isThisDraggedField,
      dragAndDrop: {
        isDragMode,
        draggedField,
        onTouchStart,
        onTouchMove,
        onTouchEnd
      }
    };

    const phoneProps = profile.fieldType === 'phone' ? {
      onPhoneChange: (value: string) => {
        handleFieldChange('phone', value, 'universal');
      }
    } : {};

    return (
      <div 
        key={key}
        className="w-full max-w-md mx-auto"
        style={{
          display: isThisDraggedField ? 'none' : 'block'
        }}
      >
        <ProfileField {...commonProps} {...phoneProps} />
      </div>
    );
  };
  
  // Calculate next order for modals (use current selectedMode's fields)
  const getNextOrderForSection = (sectionName: 'personal' | 'work') => {
    const { visibleFields } = getFieldsForView(sectionName === 'personal' ? 'Personal' : 'Work');
    const maxOrder = Math.max(0, ...visibleFields.map(f => f.order || 0));
    return maxOrder + 1;
  };

  const renderViewContent = (viewMode: 'Personal' | 'Work') => {
    const { visibleFields, hiddenFields } = getFieldsForView(viewMode);

    console.log('[FieldRenderer] renderViewContent', { viewMode, visibleFieldsCount: visibleFields.length, visibleFields });

    // Calculate DropZone map for this view
    const dropZoneMap = isDragMode ? calculateViewDropZoneMap(initialFields, viewMode, draggedField, 0) : [];

    // Use shared utility to build render items array
    const sectionName = viewMode.toLowerCase() as 'personal' | 'work';
    const renderItems = buildRenderItemsArray(visibleFields, dropZoneMap, sectionName);

    // Get calendar and location for this section
    const calendar = getCalendarForSection(sectionName);
    const location = getLocationForSection(sectionName);

    return (
      <>
        {/* Current Section */}
        <FieldSectionComponent
          title={viewMode}
          isEmpty={visibleFields.length === 0}
          emptyText={`You have no ${viewMode} networks right now. Drag & drop an input field to change that.`}
          bottomButton={
            <>
              {/* Inline Add Link Component */}
              {showInlineAddLink[sectionName] && (
                <div className="mb-4">
                  <InlineAddLink
                    section={sectionName}
                    onLinkAdded={handleLinkAdded}
                    nextOrder={getNextOrderForSection(sectionName)}
                    onCancel={() => handleToggleInlineAddLink(sectionName)}
                  />
                </div>
              )}

              {/* Add Link Button */}
              <div className="text-center">
                <SecondaryButton
                  className="cursor-pointer"
                  onClick={() => handleToggleInlineAddLink(sectionName)}
                >
                  {showInlineAddLink[sectionName] ? 'Cancel' : 'Add Link'}
                </SecondaryButton>
              </div>
            </>
          }
        >
          {/* Calendar UI - At top of section (fixed, non-draggable) */}
          {calendar ? (
            <div className="w-full mb-4">
              <ItemChip
                icon={
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                title={`${calendar.provider.charAt(0).toUpperCase() + calendar.provider.slice(1)} Calendar`}
                subtitle={calendar.email}
                onClick={() => router.push(`/edit/calendar?id=${calendar.id}`)}
                onActionClick={() => handleDeleteCalendar(sectionName)}
                actionIcon="trash"
              />
            </div>
          ) : (
            <div className="w-full mb-4">
              <Button
                variant="white"
                size="lg"
                className="w-full"
                onClick={() => handleOpenCalendarModal(sectionName)}
              >
                Add Calendar
              </Button>
            </div>
          )}

          {/* Location UI - At top of section (fixed, non-draggable) */}
          {location ? (
            <div className="w-full mb-4">
              <ItemChip
                icon={
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                title={`${location.city}${location.region ? ', ' + location.region : ''}`}
                subtitle={location.address}
                onClick={() => router.push(`/edit/location?id=${location.id}`)}
                onActionClick={() => handleDeleteLocation(sectionName)}
                actionIcon="trash"
              />
            </div>
          ) : (
            <div className="w-full mb-4">
              <Button
                variant="white"
                size="lg"
                className="w-full"
                onClick={() => handleOpenLocationModal(sectionName)}
              >
                Add Location
              </Button>
            </div>
          )}

          {/* Divider */}
          <div className="w-full border-t border-white/10 my-4" />

          {/* Draggable Fields */}
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

        {/* Hidden Fields - Always show with Sign Out button */}
        <FieldSectionComponent
          title="Hidden"
          isEmpty={hiddenFields.length === 0}
          emptyText="Tap the hide button on any field if you're about to Nekt and don't want to share that link."
          bottomButton={
            <div className="text-center">
              <SecondaryButton
                variant="destructive"
                className="cursor-pointer"
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
                  isBeingDragged={draggedField?.fieldType === profile.fieldType && draggedField?.section === profile.section}
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

          {/* NO final DropZone after hidden fields - they can't be drop targets */}
        </FieldSectionComponent>
      </>
    );
  };
  
  // Get universal fields for the top section
  const universalFields = fieldSectionManager.getFieldsBySection('universal');

  // Render universal fields with dropzones
  const renderUniversalFields = () => {
    // Get draggable universal fields (exclude name/bio/phone/email - only name and bio should be in universal per spec)
    const draggableUniversalFields = universalFields.filter(field => !['name', 'bio', 'phone', 'email'].includes(field.fieldType));
    
    // Calculate DropZone map for universal fields if in drag mode
    const universalDropZoneMap = isDragMode ? calculateViewDropZoneMap(initialFields, selectedMode, draggedField, 0) : [];
    
    // Use shared utility to build render items array
    const renderItems = buildRenderItemsArray(draggableUniversalFields, universalDropZoneMap, 'universal');
    
    // Render the interleaved items
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
        return renderUniversalField(profile, item.key, profile.isBeingDragged || false);
      }
    });
  };
  
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
              <ProfileImageIcon
                imageUrl={fieldSectionManager.getImageValue('profileImage')}
                onUpload={handleProfileImageUpload}
              />
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
  {renderUniversalFields()}
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

      {/* Modals */}
      <AddCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        section={modalSection}
        userEmail={session?.user?.email || ''}
        onCalendarAdded={handleCalendarAdded}
      />

      <AddLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        section={modalSection}
        userId={session?.user?.id || ''}
        onLocationAdded={handleLocationAdded}
      />

      <AddLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        section={modalSection}
        onLinkAdded={handleLinkAdded}
        nextOrder={getNextOrderForSection(modalSection)}
      />
    </div>
  );
});

FieldRenderer.displayName = 'FieldRenderer';

export default FieldRenderer;