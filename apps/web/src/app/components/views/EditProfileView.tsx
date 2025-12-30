'use client';

import React, { useRef, useCallback, useState } from 'react';
import { useProfile } from '../../context/ProfileContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { ContactEntry, FieldSection } from '@/types/profile';
import PageHeader from '../ui/layout/PageHeader';
import { useEditProfileFields, useImageUpload, useProfileViewMode } from '@/lib/hooks/use-edit-profile-fields';
import { useCalendarLocationManagement } from '@/lib/hooks/use-calendar-location-management';
import { getOptimalProfileImageUrl } from '@/lib/client/profile/image';
import { StaticInput } from '../ui/inputs/StaticInput';
import { ExpandingInput } from '../ui/inputs/ExpandingInput';
import { FieldSection as FieldSectionComponent } from '../ui/layout/FieldSection';
import { FieldList } from '../ui/layout/FieldList';
import { ProfileField } from '../ui/elements/ProfileField';
import { ProfileViewSelector } from '../ui/controls/ProfileViewSelector';
import ProfileImageIcon from '../ui/elements/ProfileImageIcon';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { AddLocationModal } from '../ui/modals/AddLocationModal';
import { SelectedSections } from './SelectedSections';

const EditProfileView: React.FC = () => {
  const { data: session } = useSession();
  const { profile, saveProfile, isSaving: isProfileSaving } = useProfile();
  const router = useRouter();

  const nameInputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Inline add link state
  const [showInlineAddLink, setShowInlineAddLink] = useState<{ personal: boolean; work: boolean }>({
    personal: false,
    work: false
  });

  const [selectedMode, setSelectedMode] = useState<'Personal' | 'Work'>(() => {
    // Initialize from localStorage, fallback to 'Personal'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nekt-sharing-category');
      return (saved as 'Personal' | 'Work') || 'Personal';
    }
    return 'Personal';
  });

  // Initial images setup
  const initialImages = {
    profileImage: getOptimalProfileImageUrl(profile?.profileImage || '', 400)
  };

  // Unified field management hook - this is our single source of truth
  const fieldSectionManager = useEditProfileFields({
    profile,
    session,
    initialImages
  });

  // Custom hooks
  const { createUploadHandler } = useImageUpload((colors) => {
    // Update profile context with extracted colors immediately
    console.log('[EditProfileView] Updating profile with extracted colors:', colors);
    saveProfile({ backgroundColors: colors }, { skipUIUpdate: false });
  });
  const { loadFromStorage, handleModeChange: handleCarouselModeChange } = useProfileViewMode(carouselRef);

  // Calendar and location management
  const {
    isCalendarModalOpen,
    isLocationModalOpen,
    modalSection,
    setIsCalendarModalOpen,
    setIsLocationModalOpen,
    isDeletingCalendar,
    isDeletingLocation,
    getCalendarForSection,
    getLocationForSection,
    handleOpenCalendarModal,
    handleOpenLocationModal,
    handleCalendarAdded,
    handleLocationAdded,
    handleDeleteCalendar,
    handleDeleteLocation,
    router: calRouter
  } = useCalendarLocationManagement({
    profile,
    saveProfile
  });


  // Initialize on mount
  React.useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Handle mode change - update both carousel and local state
  const handleModeChange = useCallback((mode: 'Personal' | 'Work') => {
    handleCarouselModeChange(mode);
    setSelectedMode(mode);
  }, [handleCarouselModeChange]);

  // Image upload handlers
  const handleProfileImageUpload = createUploadHandler('profile', (imageData) =>
    fieldSectionManager.setImageValue('profileImage', imageData)
  );

  // Handle field input change
  const handleFieldChange = (fieldType: string, value: string, section: FieldSection) => {
    fieldSectionManager.markChannelAsConfirmed(fieldType);
    fieldSectionManager.updateFieldValue(fieldType, value, section);
  };

  const handleToggleInlineAddLink = (section: 'personal' | 'work') => {
    setShowInlineAddLink(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleLinkAdded = (entries: ContactEntry[]) => {
    // Add links to field manager
    fieldSectionManager.addFields(entries);
    entries.forEach(entry => {
      fieldSectionManager.markChannelAsConfirmed(entry.fieldType);
    });
    // Close inline add link for all sections
    setShowInlineAddLink({ personal: false, work: false });
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


  // Calculate next order for modals (use current selectedMode's fields)
  const getNextOrderForSection = (sectionName: 'personal' | 'work') => {
    const { visibleFields } = getFieldsForView(sectionName === 'personal' ? 'Personal' : 'Work');
    const maxOrder = Math.max(0, ...visibleFields.map(f => f.order || 0));
    return maxOrder + 1;
  };

  // Save profile handler - simplified with service layer handling filtering/dedup
  const handleSaveProfile = useCallback(async () => {
    if (!session?.user?.id) return;

    // Get all fields and let ProfileSaveService handle filtering/dedup
    const profileData = {
      contactEntries: fieldSectionManager.getAllFields(),
      profileImage: fieldSectionManager.getImageValue('profileImage') || profile?.profileImage || ''
    };

    // Call the save function - ProfileSaveService will filter and deduplicate
    await saveProfile(profileData);
  }, [saveProfile, fieldSectionManager, profile, session]);

  // Handle save and navigate
  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await handleSaveProfile();
      router.push('/');
    } catch (error) {
      console.error('[EditProfileView] Save failed:', error);
      // Show error to user
      alert(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [handleSaveProfile, router]);


  // Get universal fields for the top section
  const universalFields = fieldSectionManager.getFieldsBySection('universal');

  // Render universal contact fields (exclude name/bio which have dedicated inputs above)
  const renderUniversalFields = () => {
    const universalContactFields = universalFields.filter(field => !['name', 'bio'].includes(field.fieldType));

    return universalContactFields.map((field, index) => (
      <ProfileField
        key={`universal-${field.fieldType}-${index}`}
        profile={field}
        fieldSectionManager={fieldSectionManager}
        getValue={getFieldValue}
        onChange={handleFieldChange}
        isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
        onConfirm={fieldSectionManager.markChannelAsConfirmed}
        currentViewMode={selectedMode}
      />
    ));
  };

  return (
    <div className="flex flex-col items-center px-4 py-2 pb-8 relative">
      <div className="w-full max-w-[var(--max-content-width,448px)] space-y-5">
        <PageHeader
          title="Edit Profile"
          onBack={() => router.push('/')}
          onSave={handleSave}
          isSaving={isProfileSaving}
        />

        <div className="flex flex-col items-center relative space-y-5">
          {/* Universal Section */}
          <FieldSectionComponent
            isEmpty={false}
            emptyText=""
            className="w-full"
          >
            {/* Name Input with Profile Image */}
            <div className="w-full max-w-md mx-auto">
              <StaticInput
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
              <ExpandingInput
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

            {/* Universal Fields List */}
            <FieldList>
              {renderUniversalFields()}
            </FieldList>
          </FieldSectionComponent>

          {/* Carousel Container */}
          <div className="w-full overflow-hidden">
            <div
              ref={carouselRef}
              className="flex gap-4 transition-transform duration-300 ease-out"
            >
              {/* Personal View */}
              <div className="w-full flex-shrink-0 space-y-5">
                <SelectedSections
                  viewMode="Personal"
                  fieldSectionManager={fieldSectionManager}
                  getCalendarForSection={getCalendarForSection}
                  getLocationForSection={getLocationForSection}
                  handleOpenCalendarModal={handleOpenCalendarModal}
                  handleOpenLocationModal={handleOpenLocationModal}
                  handleDeleteCalendar={handleDeleteCalendar}
                  handleDeleteLocation={handleDeleteLocation}
                  isDeletingCalendar={isDeletingCalendar}
                  isDeletingLocation={isDeletingLocation}
                  calRouter={calRouter}
                  showInlineAddLink={showInlineAddLink}
                  handleToggleInlineAddLink={handleToggleInlineAddLink}
                  handleLinkAdded={handleLinkAdded}
                  getNextOrderForSection={getNextOrderForSection}
                  getFieldValue={getFieldValue}
                  handleFieldChange={handleFieldChange}
                  getFieldsForView={getFieldsForView}
                />
              </div>

              {/* Work View */}
              <div className="w-full flex-shrink-0 space-y-5">
                <SelectedSections
                  viewMode="Work"
                  fieldSectionManager={fieldSectionManager}
                  getCalendarForSection={getCalendarForSection}
                  getLocationForSection={getLocationForSection}
                  handleOpenCalendarModal={handleOpenCalendarModal}
                  handleOpenLocationModal={handleOpenLocationModal}
                  handleDeleteCalendar={handleDeleteCalendar}
                  handleDeleteLocation={handleDeleteLocation}
                  isDeletingCalendar={isDeletingCalendar}
                  isDeletingLocation={isDeletingLocation}
                  calRouter={calRouter}
                  showInlineAddLink={showInlineAddLink}
                  handleToggleInlineAddLink={handleToggleInlineAddLink}
                  handleLinkAdded={handleLinkAdded}
                  getNextOrderForSection={getNextOrderForSection}
                  getFieldValue={getFieldValue}
                  handleFieldChange={handleFieldChange}
                  getFieldsForView={getFieldsForView}
                />
              </div>
            </div>
          </div>

          {/* Sticky Profile View Selector */}
          <div className="sticky bottom-4 left-0 right-0 z-50 mt-8">
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
        </div>
      </div>
    </div>
  );
};

export default EditProfileView;
