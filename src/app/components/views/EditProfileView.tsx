'use client';
/** @jsxImportSource react */

import React, { useState, useEffect, useRef } from 'react';
import { useProfile } from '../../context/ProfileContext';
import type { SocialPlatform, SocialProfileFormEntry, ProfileFormData } from '@/types/forms';
import CustomInput from '../ui/inputs/CustomInput';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import CustomPhoneInput from '../ui/inputs/CustomPhoneInput';
import EditTitleBar from '../ui/EditTitleBar';
import CustomExpandingInput from '../ui/inputs/CustomExpandingInput';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { FieldSection } from '../ui/FieldSection';
import { SocialProfileField } from '../ui/SocialProfileField';
import { useProfileSave } from '@/lib/hooks/useProfileSave';
import { useEditProfileFields } from '@/lib/hooks/useEditProfileFields';
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
  
  const [formData, setFormData] = useState<ProfileFormData>(() =>
    profile ? profileToFormData(profile, session?.user) : {
      name: session?.user?.name || '',
      bio: '',
      email: session?.user?.email || '',
      picture: session?.user?.image || '',
      socialProfiles: [],
      backgroundImage: '',
    }
  );
  
  const [digits, setDigits] = useState('');
  const [phoneCountry] = useState<CountryCode>('US');

  // Drag & Drop functionality
  const dragAndDrop = useDragAndDrop({ 
    onDragStateChange,
    onDrop: (draggedFieldId: string, insertionPoint: any) => {


      // Determine target section
      let targetSection: 'personal' | 'work' | 'hidden' = 'personal';
      if (insertionPoint.section === 'work') {
        targetSection = 'work';
      } else if (insertionPoint.section === 'universal') {
        targetSection = 'universal' as any; // Keep as universal section
      }

      // Calculate target index based on what the user sees
      let targetIndex = 0;
      
      if (insertionPoint.type === 'before-edit-background') {
        // Universal section - move to end of personal section
        targetIndex = fieldSectionManager.personalFields.length;
      } else if (insertionPoint.type === 'section-start') {
        targetIndex = 0;
      } else if (insertionPoint.type === 'between-fields' && insertionPoint.beforeField) {
        const currentFields = targetSection === 'personal' 
          ? fieldSectionManager.personalFields 
          : fieldSectionManager.workFields;
        const beforeIndex = currentFields.findIndex(f => f.platform === insertionPoint.beforeField);
        targetIndex = beforeIndex >= 0 ? beforeIndex : 0;
      } else if (insertionPoint.type === 'after-fields' && insertionPoint.afterField) {
        const currentFields = targetSection === 'personal' 
          ? fieldSectionManager.personalFields 
          : fieldSectionManager.workFields;
        const afterIndex = currentFields.findIndex(f => f.platform === insertionPoint.afterField);
        targetIndex = afterIndex >= 0 ? afterIndex + 1 : currentFields.length;
      }
      

      
      // Let the field section manager handle everything
      fieldSectionManager.moveField(draggedFieldId, targetSection, targetIndex);
      
      // Mark channel as confirmed when user drags it
      markChannelAsConfirmed(draggedFieldId);
    }
  });

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
    }
  });

  useFreezeScrollOnFocus(nameInputRef);

  useEffect(() => {
    if (profile) {
      setFormData(profileToFormData(profile, session?.user));
      if (profile.contactChannels?.phoneInfo) {
        const phoneInfo = profile.contactChannels.phoneInfo;
        const phoneNumber = phoneInfo.nationalPhone || phoneInfo.internationalPhone?.replace(/^\+1/, '') || '';
        setDigits(phoneNumber.replace(/\D/g, ''));
      }
    }
  }, [profile, session?.user]);

  // Note: Removed auto-focus to prevent keyboard tray from showing on Android
  // Users will manually tap to focus when they want to edit

  // Handle profile image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const imageData = e.target?.result as string;
      setFormData((prev: ProfileFormData) => ({ ...prev, picture: imageData }));
      
      // Call the new API to upload the profile image
      try {
        await fetch('/api/media/profile-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData }),
        });
      } catch (error) {
        console.error('Error uploading profile image:', error);
        alert('Failed to upload profile image. Please try again.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle background image upload
  const handleBackgroundImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const imageData = e.target?.result as string;
      setFormData((prev: ProfileFormData) => ({ ...prev, backgroundImage: imageData }));
      
      // Call the API to upload the background image
      try {
        await fetch('/api/media/background-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData }),
        });
      } catch (error) {
        console.error('Error uploading background image:', error);
        alert('Failed to upload background image. Please try again.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle social profile input change
  const handleSocialChange = (platform: SocialPlatform, value: string) => {
    // Mark this channel as confirmed when user edits it
    markChannelAsConfirmed(platform);
    
    setFormData((prev: ProfileFormData) => {
      const updatedProfiles = [...prev.socialProfiles];
      const profileIndex = updatedProfiles.findIndex(p => p.platform === platform);
      
      if (profileIndex >= 0) {
        updatedProfiles[profileIndex] = {
          ...updatedProfiles[profileIndex],
          username: value,
          filled: value.trim() !== ''
        };
      } else {
        // Determine default section for new profiles
        const defaultSection = platform === 'linkedin' ? 'work' : 'personal';
        updatedProfiles.push({
          platform,
          username: value,
          shareEnabled: true,
          filled: value.trim() !== '',
          section: defaultSection,
          order: 0
        });
      }
      
      return { ...prev, socialProfiles: updatedProfiles };
    });
  };
  
  // Get social profile value
  const getSocialProfileValue = (platform: string): string => {
    const socialProfile = formData.socialProfiles.find((p: SocialProfileFormEntry) => p.platform === platform);
    return socialProfile?.username || '';
  };

  // Track confirmed channels client-side
  const [confirmedChannels, setConfirmedChannels] = useState<Set<string>>(new Set());

  // Mark a channel as confirmed client-side
  const markChannelAsConfirmed = (platform: string) => {
    setConfirmedChannels(prev => new Set(prev).add(platform));
  };

  // Check if a specific channel is unconfirmed
  const isChannelUnconfirmed = (platform: string): boolean => {
    // If we've marked it as confirmed client-side, it's confirmed
    if (confirmedChannels.has(platform)) {
      return false;
    }
    
    if (!profile?.contactChannels) return false;
    
    switch (platform) {
      case 'phone':
        return profile.contactChannels.phoneInfo && !profile.contactChannels.phoneInfo.userConfirmed;
      case 'email':
        return profile.contactChannels.email && !profile.contactChannels.email.userConfirmed;
      case 'facebook':
        return profile.contactChannels.facebook && !profile.contactChannels.facebook.userConfirmed;
      case 'instagram':
        return profile.contactChannels.instagram && !profile.contactChannels.instagram.userConfirmed;
      case 'x':
        return profile.contactChannels.x && !profile.contactChannels.x.userConfirmed;
      case 'linkedin':
        return profile.contactChannels.linkedin && !profile.contactChannels.linkedin.userConfirmed;
      case 'snapchat':
        return profile.contactChannels.snapchat && !profile.contactChannels.snapchat.userConfirmed;
      case 'whatsapp':
        return profile.contactChannels.whatsapp && !profile.contactChannels.whatsapp.userConfirmed;
      case 'telegram':
        return profile.contactChannels.telegram && !profile.contactChannels.telegram.userConfirmed;
      case 'wechat':
        return profile.contactChannels.wechat && !profile.contactChannels.wechat.userConfirmed;
      default:
        return false;
    }
  };
  
  // Handle save profile
  const handleSave = async (): Promise<void> => {
    await saveProfileData(formData, digits, phoneCountry);
  };

    // New Reserved Space component using insertion points
  const ReservedSpace = () => {
    if (!dragAndDrop.activeInsertionPoint || !dragAndDrop.isDragging) return null;
    
    return (
      <div 
        className="mb-5 w-full max-w-[var(--max-content-width,448px)] transition-all duration-200"
        style={{ 
          height: '56px' // Match the actual CustomInput height
        }}
      />
    );
  };
    
  // Original field placeholder - shows at the original location when drag mode starts
  const OriginalFieldPlaceholder = ({ fieldId }: { fieldId: string }) => {
    if (!dragAndDrop.shouldShowPlaceholder(fieldId)) return null;
    
    return (
      <div 
        data-draggable="true"
        data-field-id={fieldId}
        className="mb-5 w-full max-w-[var(--max-content-width,448px)] transition-all duration-200"
        style={{ 
          height: '56px' // Match the actual CustomInput height
        }}
        onTouchStart={dragAndDrop.onTouchStart(fieldId)}
        onTouchMove={dragAndDrop.onTouchMove}
        onTouchEnd={dragAndDrop.onTouchEnd}
      />
    );
  };
  




  // Universal section insertion point (before Edit Background)
  const UniversalInsertionPoint = () => {
    if (!dragAndDrop.activeInsertionPoint || 
        dragAndDrop.activeInsertionPoint.type !== 'before-edit-background') return null;
    
    return <ReservedSpace />;
  };

  // Section start insertion point
  const SectionStartInsertionPoint = ({ section }: { section: 'personal' | 'work' }) => {
    if (!dragAndDrop.activeInsertionPoint || 
        dragAndDrop.activeInsertionPoint.type !== 'section-start' ||
        dragAndDrop.activeInsertionPoint.section !== section) return null;
    
    return <ReservedSpace />;
  };

  // Field insertion point (between or after fields)
  const FieldInsertionPoint = ({ fieldId, position }: { fieldId: string; position: 'before' | 'after' }) => {
    if (!dragAndDrop.activeInsertionPoint) return null;
    
    const isMatch = position === 'before' 
      ? dragAndDrop.activeInsertionPoint.beforeField === fieldId
      : dragAndDrop.activeInsertionPoint.afterField === fieldId;
    
    if (!isMatch) return null;
    
    return <ReservedSpace />;
  };

  return (
    <div 
      className="flex flex-col items-center px-4 py-4 pb-8"
          >
      <div className="w-full max-w-[var(--max-content-width,448px)] mb-6">
        <EditTitleBar 
          onBack={() => router.back()}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>


      
      {/* Name Input with Profile Image */}
      <div className="mb-5 w-full max-w-md">
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
                    src={formData.picture}
                    alt="Profile"
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
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
                onChange={(e) => handleImageUpload(e)}
              />
            </label>
          }
        />
      </div>

      {/* Bio Input */}
      <div className="mb-5 w-full max-w-md">
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

      {/* Phone Input */}
      <div className="mb-5 w-full max-w-md">
        <CustomPhoneInput
          onChange={(value) => {
            setDigits(value);
          }}
          value={digits}
          placeholder="Phone number"
          className="w-full"
          autoFocus={false}
          inputProps={{
            id: "phone-input",
            autoComplete: "tel",
            className: "w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          }}
        />
      </div>

      {/* Universal Fields (dynamically rendered) */}
      {fieldSectionManager.universalFields.filter(profile => !['phone', 'email'].includes(profile.platform)).map((profile) => {
        const platform = profile.platform;
          
        return (
          <React.Fragment key={platform}>
            {/* Original field placeholder */}
            <OriginalFieldPlaceholder fieldId={platform} />
            
            <SocialProfileField
              profile={profile}
              dragAndDrop={dragAndDrop}
              fieldSectionManager={fieldSectionManager}
              getValue={getSocialProfileValue}
              onChange={handleSocialChange}
              isUnconfirmed={isChannelUnconfirmed}
              onConfirm={markChannelAsConfirmed}
            />
          </React.Fragment>
        );
      })}

      {/* Universal insertion point (before Edit Background) */}
      <UniversalInsertionPoint />

      {/* Edit Background */}
      <div className="mb-11 text-center w-full max-w-md">
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

      {/* Personal Section */}
      <div className="mb-6 w-full max-w-[var(--max-content-width,448px)]">
        <FieldSection
          title="Personal"
          isEmpty={fieldSectionManager.isPersonalEmpty}
          emptyText="You have no Personal networks right now. Drag & drop an input field to change that."
        >
          {/* Section start insertion point */}
          <SectionStartInsertionPoint section="personal" />
          
          {fieldSectionManager.personalFields.map((profile, index) => {
            const platform = profile.platform;
              
            return (
              <React.Fragment key={platform}>
                {/* Insertion point before this field */}
                <FieldInsertionPoint fieldId={platform} position="before" />
                
                {/* Original field placeholder */}
                <OriginalFieldPlaceholder fieldId={platform} />
                
                <SocialProfileField
                  profile={profile}
                  dragAndDrop={dragAndDrop}
                  fieldSectionManager={fieldSectionManager}
                  getValue={getSocialProfileValue}
                  onChange={handleSocialChange}
                  isUnconfirmed={isChannelUnconfirmed}
                  onConfirm={markChannelAsConfirmed}
                />
                
                {/* Insertion point after this field */}
                <FieldInsertionPoint fieldId={platform} position="after" />
              </React.Fragment>
            );
          })}
        </FieldSection>
      </div>

      {/* Work Section */}
      <div className="mb-6 w-full max-w-[var(--max-content-width,448px)]">
        <FieldSection
          title="Work"
          isEmpty={fieldSectionManager.isWorkEmpty}
          emptyText="You have no Work networks right now. Drag & drop an input field to change that."
        >
          {/* Section start insertion point */}
          <SectionStartInsertionPoint section="work" />
          
          {fieldSectionManager.workFields.map((profile, index) => {
            const platform = profile.platform;
              
            return (
              <React.Fragment key={platform}>
                {/* Insertion point before this field */}
                <FieldInsertionPoint fieldId={platform} position="before" />
                
                {/* Original field placeholder */}
                <OriginalFieldPlaceholder fieldId={platform} />
                
                <SocialProfileField
                  profile={profile}
                  dragAndDrop={dragAndDrop}
                  fieldSectionManager={fieldSectionManager}
                  getValue={getSocialProfileValue}
                  onChange={handleSocialChange}
                  isUnconfirmed={isChannelUnconfirmed}
                  onConfirm={markChannelAsConfirmed}
                />
                
                {/* Insertion point after this field */}
                <FieldInsertionPoint fieldId={platform} position="after" />
              </React.Fragment>
            );
          })}
        </FieldSection>
      </div>

      {/* Hidden Section */}
      <div className="mb-6 w-full max-w-[var(--max-content-width,448px)]">
        <FieldSection
          title="Hidden"
          isEmpty={fieldSectionManager.isHiddenEmpty}
          emptyText="You have no Hidden networks right now. Tap the hide icon to change that."
        >
          {fieldSectionManager.hiddenFields.map((profile) => {
            const platform = profile.platform;
              
            return (
              <React.Fragment key={platform}>
                <SocialProfileField
                  profile={profile}
                  dragAndDrop={dragAndDrop}
                  fieldSectionManager={fieldSectionManager}
                  getValue={getSocialProfileValue}
                  onChange={handleSocialChange}
                  isUnconfirmed={isChannelUnconfirmed}
                  onConfirm={markChannelAsConfirmed}
                  showDragHandles={false}
                />
              </React.Fragment>
            );
          })}
        </FieldSection>
      </div>
      

      

    </div>
  );
};

export default EditProfileView;
