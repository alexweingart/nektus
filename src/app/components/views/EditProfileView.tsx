'use client';
/** @jsxImportSource react */

import React, { useState, useEffect, useRef } from 'react';
import { useProfile } from '../../context/ProfileContext';
import type { SocialPlatform, SocialProfileFormEntry, ProfileFormData, FieldSection } from '@/types/forms';
import CustomInput from '../ui/inputs/CustomInput';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import EditTitleBar from '../ui/EditTitleBar';
import CustomExpandingInput from '../ui/inputs/CustomExpandingInput';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { FieldSection as FieldSectionComponent } from '../ui/FieldSection';
import { ProfileField } from '../ui/ProfileField';
import { ProfileViewSelector, type ProfileViewMode } from '../ui/ProfileViewSelector';
import SocialIcon from '../ui/SocialIcon';
import { useProfileSave } from '@/lib/hooks/useProfileSave';
import { useEditProfileFields, useImageUpload, useProfileViewMode } from '@/lib/hooks/useEditProfileFields';
import { profileToFormData } from '@/lib/utils/profileTransforms';
import type { CountryCode } from 'libphonenumber-js';
import { useFreezeScrollOnFocus } from '@/lib/hooks/useFreezeScrollOnFocus';
import { useDragAndDrop } from '@/lib/hooks/useDragAndDrop';


interface EditProfileViewProps {
  onDragStateChange?: (isDragging: boolean) => void;
}

const EditProfileView: React.FC<EditProfileViewProps> = ({ onDragStateChange }) => {
  const { data: session } = useSession();
  const { profile, saveProfile, isSaving: isProfileSaving } = useProfile();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // Initialize formData with profile data if available, otherwise with defaults
  const [formData, setFormData] = useState<ProfileFormData>(() => {
    if (profile) {
      return profileToFormData(profile, session?.user);
    }
    return {
      name: session?.user?.name || '',
      bio: '',
      email: session?.user?.email || '',
      picture: session?.user?.image || '',
      socialProfiles: [],
      backgroundImage: '',
    };
  });
  
  const [digits, setDigits] = useState('');
  const [phoneCountry] = useState<CountryCode>('US');
  const carouselRef = useRef<HTMLDivElement>(null);
  
  // Custom hooks
  const { createUploadHandler } = useImageUpload();
  const { selectedMode, hasLoadedFromStorage, loadFromStorage, handleModeChange } = useProfileViewMode(carouselRef);


  const { saveProfileData, isSaving: isSaveHookSaving } = useProfileSave({
    profile: profile || undefined,
    saveProfile,
  });

  const isSaving = isProfileSaving || isSaveHookSaving;

  // Field section management hook
  const fieldSectionManager = useEditProfileFields({
    initialSocialProfiles: formData.socialProfiles,
    onSocialProfilesChange: (profiles) => {
      setFormData(prev => ({ ...prev, socialProfiles: profiles }));
    },
    profile
  });

  // Combine all fields for drag & drop
  const allFields = [
    ...fieldSectionManager.universalFields,
    ...fieldSectionManager.personalFields,
    ...fieldSectionManager.workFields
  ];

  // Drag & Drop functionality
  const dragAndDrop = useDragAndDrop({ 
    initialFields: allFields, // Pass combined fields array
    currentSection: selectedMode, // Pass current tab section
    onDragStateChange,
    onFieldArrayDrop: ({ fields: newFieldOrder, draggedField, dragType }) => {
      
      if (dragType === 'universal-to-section') {
        // Universal → Personal/Work: split the universal field
        const targetSection = draggedField.section as 'personal' | 'work';
        const currentValue = getSocialProfileValue(draggedField.platform, 'universal');
        const targetIndex = newFieldOrder.filter(f => f.section === targetSection && f.isVisible).findIndex(f => f.platform === draggedField.platform);
        
        fieldSectionManager.splitUniversalField(draggedField.platform, currentValue, targetSection, targetIndex);
        fieldSectionManager.markChannelAsConfirmed(draggedField.platform);
        
      } else if (dragType === 'section-to-universal') {
        // Personal/Work → Universal: consolidate to universal
        const fromSection = draggedField.section;
        fieldSectionManager.consolidateToUniversal(draggedField.platform, fromSection);
        fieldSectionManager.markChannelAsConfirmed(draggedField.platform);
        
      } else {
        // Same section reorder: use simple field order update
        setFormData(prev => ({ 
          ...prev, 
          socialProfiles: newFieldOrder.filter(f => f.section !== 'universal') // Exclude universal fields
        }));
        
        // Mark all rearranged fields as confirmed
        newFieldOrder.forEach(field => {
          fieldSectionManager.markChannelAsConfirmed(field.platform);
        });
      }
    }
  });

  useFreezeScrollOnFocus(nameInputRef);

  // Initialize on mount
  useEffect(() => {
    loadFromStorage();
    
    if (profile && formData.socialProfiles.length === 0) {
      setFormData(profileToFormData(profile, session?.user));
    }
    
    if (profile) {
      const contactChannels = profile.contactChannels as any;
      if (contactChannels?.entries) {
        const phoneEntry = contactChannels.entries.find((e: any) => e.platform === 'phone');
        if (phoneEntry) {
          const phoneNumber = phoneEntry.nationalPhone || phoneEntry.internationalPhone?.replace(/^\+1/, '') || '';
          setDigits(phoneNumber.replace(/\D/g, ''));
        }
      }
    }
  }, [profile, loadFromStorage]);

  // Image upload handlers
  const handleProfileImageUpload = createUploadHandler('profile', (imageData) => 
    setFormData(prev => ({ ...prev, picture: imageData }))
  );
  
  const handleBackgroundImageUpload = createUploadHandler('background', (imageData) => 
    setFormData(prev => ({ ...prev, backgroundImage: imageData }))
  );

  // Handle social profile input change - use hook's unified state
  const handleSocialChange = (platform: SocialPlatform, value: string, section: FieldSection) => {
    // Mark this channel as confirmed when user edits it
    fieldSectionManager.markChannelAsConfirmed(platform);
    
    // Update field value through the hook
    fieldSectionManager.updateFieldValue(platform, value, section);
  };
  
  // Get social profile value based on platform and section
  const getSocialProfileValue = (platform: string, section?: string): string => {
    // Special handling for email and phone - values come from formData/digits
    if (platform === 'email') {
      return formData.email;
    }
    if (platform === 'phone') {
      return digits;
    }
    
    if (!section) {
      // For universal fields, find any entry for this platform
      const socialProfile = formData.socialProfiles.find((p: SocialProfileFormEntry) => p.platform === platform);
      return socialProfile?.username || '';
    }
    
    // For section-specific fields, only return value if it matches exact section
    const socialProfile = formData.socialProfiles.find((p: SocialProfileFormEntry) => 
      p.platform === platform && p.section === section
    );
    return socialProfile?.username || '';
  };

  
  // Handle save profile
  const handleSave = async (): Promise<void> => {
    await saveProfileData(formData, digits, phoneCountry);
  };

  // Unified field provider - handles both drag mode and normal mode consistently
  const getCurrentFields = (viewMode: 'Personal' | 'Work') => {
    if (dragAndDrop.isDragMode) {
      // Visual drag state - use dragAndDrop.fieldOrder
      const sectionName = viewMode.toLowerCase() as 'personal' | 'work';
      const allSwappedFields = dragAndDrop.fieldOrder;
      return {
        universalFields: allSwappedFields.filter(f => f.section === 'universal'),
        currentFields: allSwappedFields.filter(f => f.section === sectionName && f.isVisible),
        hiddenFields: allSwappedFields.filter(f => f.section === sectionName && !f.isVisible)
      };
    } else {
      // Normal state - use fieldSectionManager
      return fieldSectionManager.getFieldsForView(viewMode);
    }
  };

  // Render content for a specific view (Personal or Work) - only section-specific fields
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
            const platform = profile.platform;
            const uniqueKey = `${profile.section}-${platform}-${index}`;
              
            return (
              <ProfileField
                key={uniqueKey}
                profile={profile}
                dragAndDrop={dragAndDrop}
                fieldSectionManager={fieldSectionManager}
                getValue={getSocialProfileValue}
                onChange={handleSocialChange}
                isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                onConfirm={fieldSectionManager.markChannelAsConfirmed}
                currentViewMode={viewMode}
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
              const platform = profile.platform;
              const uniqueKey = `hidden-${platform}-${index}`;
                
              return (
                <ProfileField
                  key={uniqueKey}
                  profile={profile}
                  dragAndDrop={dragAndDrop}
                  fieldSectionManager={fieldSectionManager}
                  getValue={getSocialProfileValue}
                  onChange={handleSocialChange}
                  isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                  onConfirm={fieldSectionManager.markChannelAsConfirmed}
                  showDragHandles={false}
                  currentViewMode={viewMode}
                />
              );
            })}
          </FieldSectionComponent>
        )}
      </>
    );
  };

  // Get universal fields for the top section
  const { universalFields } = getCurrentFields('Personal'); // Universal fields are same for both views
  
  return (
    <div className="flex flex-col items-center px-4 py-4 pb-8 relative space-y-5">
      <div className="w-full max-w-[var(--max-content-width,448px)]">
        <EditTitleBar 
          onBack={() => router.back()}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>

      {/* Universal Section - No title, includes all universal content */}
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
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              setFormData((prev: ProfileFormData) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Full Name"
            className="w-full"
            icon={
              <label className="cursor-pointer flex items-center justify-center w-full h-full">
                {formData.picture ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white">
                    <Image
                      src={formData.picture.includes('firebasestorage.app') 
                        ? (formData.picture.includes('?') 
                            ? `${formData.picture}&cb=${Date.now()}` 
                            : `${formData.picture}?cb=${Date.now()}`)
                        : formData.picture}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="object-cover w-full h-full"
                      unoptimized={formData.picture?.includes('firebasestorage.app')}
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
            value={formData.bio}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
              setFormData((prev: ProfileFormData) => ({ ...prev, bio: e.target.value }))
            }
            placeholder="Add a short bio..."
            className="w-full"
            maxLength={280}
          />
        </div>

        {/* All Universal Fields (including Phone/Email and any others moved to universal) */}
        {universalFields.map((profile, index) => {
          const platform = profile.platform;
          const uniqueKey = `universal-${platform}-${index}`;
          
          // Special handling for phone field
          if (platform === 'phone') {
            return (
              <div key={uniqueKey} className="w-full max-w-md mx-auto">
                <ProfileField
                  profile={{
                    platform: 'phone',
                    section: 'universal',
                    username: digits,
                    isVisible: true,
                    order: profile.order || 0
                  }}
                  dragAndDrop={dragAndDrop}
                  fieldSectionManager={fieldSectionManager}
                  getValue={() => digits}
                  onChange={() => {}} // Not used for phone
                  onPhoneChange={(value) => {
                    setDigits(value);
                    fieldSectionManager.markChannelAsConfirmed('phone');
                  }}
                  isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                  onConfirm={fieldSectionManager.markChannelAsConfirmed}
                  currentViewMode={selectedMode}
                />
              </div>
            );
          }
          
          // Special handling for email field
          if (platform === 'email') {
            return (
              <div key={uniqueKey} className="w-full max-w-md mx-auto">
                <ProfileField
                  profile={{
                    platform: 'email',
                    section: 'universal',
                    username: formData.email,
                    isVisible: true,
                    order: profile.order || 1
                  }}
                  dragAndDrop={dragAndDrop}
                  fieldSectionManager={fieldSectionManager}
                  getValue={() => formData.email}
                  onChange={(platform, value) => {
                    setFormData((prev: ProfileFormData) => ({ ...prev, email: value }));
                    fieldSectionManager.markChannelAsConfirmed('email');
                  }}
                  isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                  onConfirm={fieldSectionManager.markChannelAsConfirmed}
                  currentViewMode={selectedMode}
                />
              </div>
            );
          }
          
          // Regular universal social fields (Instagram, etc. if moved to universal)
          return (
            <div key={uniqueKey} className="w-full max-w-md mx-auto">
              <ProfileField
                profile={profile}
                dragAndDrop={dragAndDrop}
                fieldSectionManager={fieldSectionManager}
                getValue={getSocialProfileValue}
                onChange={handleSocialChange}
                isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                onConfirm={fieldSectionManager.markChannelAsConfirmed}
                currentViewMode={selectedMode}
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
};

export default EditProfileView;
