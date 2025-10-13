'use client';

import React, { useRef, useCallback, useState } from 'react';
import { useProfile } from '../../context/ProfileContext';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { ContactEntry, FieldSection } from '@/types/profile';
import PageHeader from '../ui/layout/PageHeader';
import { useEditProfileFields, useImageUpload, useProfileViewMode } from '@/lib/hooks/useEditProfileFields';
import { useCalendarLocationManagement } from '@/lib/hooks/useCalendarLocationManagement';
import { useFreezeScrollOnFocus } from '@/lib/hooks/useFreezeScrollOnFocus';
import { getOptimalProfileImageUrl } from '@/lib/utils/imageUtils';
import { StaticInput } from '../ui/inputs/StaticInput';
import { ExpandingInput } from '../ui/inputs/ExpandingInput';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { FieldSection as FieldSectionComponent } from '../ui/layout/FieldSection';
import { FieldList } from '../ui/layout/FieldList';
import { ProfileField } from '../ui/elements/ProfileField';
import { ProfileViewSelector } from '../ui/controls/ProfileViewSelector';
import ProfileImageIcon from '../ui/elements/ProfileImageIcon';
import { ItemChip } from '../ui/modules/ItemChip';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { AddLocationModal } from '../ui/modals/AddLocationModal';
import { InlineAddLink } from '../ui/modules/InlineAddLink';

const EditProfileView: React.FC = () => {
  const { data: session } = useSession();
  const { profile, saveProfile, isSaving: isProfileSaving } = useProfile();
  const router = useRouter();

  const nameInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
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
    profileImage: getOptimalProfileImageUrl(session?.user?.image || profile?.profileImage || '', 400),
    backgroundImage: profile?.backgroundImage || ''
  };

  // Unified field management hook - this is our single source of truth
  const fieldSectionManager = useEditProfileFields({
    profile,
    session,
    initialImages
  });

  // Custom hooks
  const { createUploadHandler } = useImageUpload();
  const { loadFromStorage, handleModeChange: handleCarouselModeChange } = useProfileViewMode(carouselRef);

  // Calendar and location management
  const {
    isCalendarModalOpen,
    isLocationModalOpen,
    modalSection,
    setIsCalendarModalOpen,
    setIsLocationModalOpen,
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
    saveProfile,
    onSaveProfile: undefined // Will be set later
  });

  useFreezeScrollOnFocus(nameInputRef);

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

  const handleBackgroundImageUpload = createUploadHandler('background', (imageData) =>
    fieldSectionManager.setImageValue('backgroundImage', imageData)
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
      profileImage: fieldSectionManager.getImageValue('profileImage') || profile?.profileImage || '',
      backgroundImage: fieldSectionManager.getImageValue('backgroundImage') || profile?.backgroundImage || ''
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

  const renderViewContent = (viewMode: 'Personal' | 'Work') => {
    const { visibleFields, hiddenFields } = getFieldsForView(viewMode);
    const sectionName = viewMode.toLowerCase() as 'personal' | 'work';

    // Get calendar and location for this section
    const calendar = getCalendarForSection(sectionName);
    const location = getLocationForSection(sectionName);

    return (
      <>
        {/* Current Section */}
        <FieldSectionComponent
          title={viewMode}
          isEmpty={visibleFields.length === 0}
          emptyText={`You have no ${viewMode} networks right now. Add a link to get started.`}
          topContent={
            <>
              {/* Calendar UI */}
              {calendar ? (
                <div className="w-full">
                  <ItemChip
                    icon={
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    }
                    title={`${calendar.provider.charAt(0).toUpperCase() + calendar.provider.slice(1)} Calendar`}
                    subtitle={calendar.email}
                    onClick={() => calRouter.push(`/edit/calendar?id=${calendar.id}`)}
                    onActionClick={() => handleDeleteCalendar(sectionName)}
                    actionIcon="trash"
                  />
                </div>
              ) : (
                <div className="w-full">
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

              {/* Location UI */}
              {location ? (
                <div className="w-full mt-4">
                  <ItemChip
                    icon={
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }
                    title={`${location.city}${location.region ? ', ' + location.region : ''}`}
                    subtitle={location.address}
                    onClick={() => calRouter.push(`/edit/location?id=${location.id}`)}
                    onActionClick={() => handleDeleteLocation(sectionName)}
                    actionIcon="trash"
                  />
                </div>
              ) : (
                <div className="w-full mt-4">
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
              <div className="w-full border-t border-white/10 mt-4" />
            </>
          }
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
          <FieldList>
            {visibleFields.map((field, index) => (
              <ProfileField
                key={`${field.fieldType}-${field.section}-${index}`}
                profile={field}
                fieldSectionManager={fieldSectionManager}
                getValue={getFieldValue}
                onChange={handleFieldChange}
                isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                onConfirm={fieldSectionManager.markChannelAsConfirmed}
                currentViewMode={viewMode}
              />
            ))}
          </FieldList>
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
          <FieldList>
            {hiddenFields.map((field, index) => (
              <ProfileField
                key={`hidden-${field.fieldType}-${index}`}
                profile={field}
                fieldSectionManager={fieldSectionManager}
                getValue={getFieldValue}
                onChange={handleFieldChange}
                isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                onConfirm={fieldSectionManager.markChannelAsConfirmed}
                currentViewMode={viewMode}
              />
            ))}
          </FieldList>
        </FieldSectionComponent>
      </>
    );
  };

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
        </div>
      </div>
    </div>
  );
};

export default EditProfileView;
