'use client';
/** @jsxImportSource react */

import React, { useState, useEffect, useRef } from 'react';
import { useProfile } from '../../context/ProfileContext';
import type { SocialPlatform, SocialProfileFormEntry, ProfileFormData, FieldSection } from '@/types/forms';
import CustomInput from '../ui/inputs/CustomInput';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import CustomPhoneInput from '../ui/inputs/CustomPhoneInput';
import EditTitleBar from '../ui/EditTitleBar';
import CustomExpandingInput from '../ui/inputs/CustomExpandingInput';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { FieldSection as FieldSectionComponent } from '../ui/FieldSection';
import { SocialProfileField } from '../ui/SocialProfileField';
import { ProfileViewSelector, type ProfileViewMode } from '../ui/ProfileViewSelector';
import SocialIcon from '../ui/SocialIcon';
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
  const [selectedMode, setSelectedMode] = useState<ProfileViewMode>('Personal');
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Drag & Drop functionality
  const dragAndDrop = useDragAndDrop({ 
    onDragStateChange,
    onDrop: (draggedFieldId: string, insertionPoint: any) => {
      // Parse the composite field ID back to platform and section
      const [platform, sourceSection] = draggedFieldId.split('-');
      
      // Check if this is a universal field being moved to personal/work  
      const draggedField = fieldSectionManager.getFieldData(platform, sourceSection as any);
      const isUniversalField = draggedField?.section === 'universal';
      const isMovingToPersonalOrWork = insertionPoint.section === 'personal' || insertionPoint.section === 'work';
      
      if (isUniversalField && isMovingToPersonalOrWork) {
        // Universal field being moved to personal/work: split into both sections with proper positioning
        let currentValue = '';
        if (platform === 'email') {
          currentValue = formData.email;
        } else if (platform === 'phone') {
          currentValue = digits;
        } else {
          // For social platforms, get the value from the universal field
          currentValue = draggedField?.username || '';
        }
        
        // Calculate target section and position using existing logic
        let targetSection: 'personal' | 'work' = 'personal';
        if (insertionPoint.section === 'work') {
          targetSection = 'work';
        }
        
        let targetIndex = 0;
        if (insertionPoint.type === 'section-start') {
          targetIndex = 0;
        } else if (insertionPoint.type === 'between-fields' && insertionPoint.beforeField) {
          const { currentFields } = fieldSectionManager.getFieldsForView(targetSection === 'personal' ? 'Personal' : 'Work');
          const beforeIndex = currentFields.findIndex(f => f.platform === insertionPoint.beforeField);
          targetIndex = beforeIndex >= 0 ? beforeIndex : 0;
        } else if (insertionPoint.type === 'after-fields' && insertionPoint.afterField) {
          const { currentFields } = fieldSectionManager.getFieldsForView(targetSection === 'personal' ? 'Personal' : 'Work');
          const afterIndex = currentFields.findIndex(f => f.platform === insertionPoint.afterField);
          targetIndex = afterIndex >= 0 ? afterIndex + 1 : currentFields.length;
        }
        
        console.log(`🔄 Splitting universal field ${platform} to ${targetSection} at position ${targetIndex} with value: ${currentValue}`);
        
        // Use hook's split method with positioning
        fieldSectionManager.splitUniversalField(platform, currentValue, targetSection, targetIndex);
        
        // Mark both new channels as confirmed since user intentionally moved them
        markChannelAsConfirmed(`${platform}_personal`);
        markChannelAsConfirmed(`${platform}_work`);
        return;
      }

      // Determine target section for regular field moves
      let targetSection: 'personal' | 'work' | 'universal' = 'personal';
      if (insertionPoint.section === 'work') {
        targetSection = 'work';
      } else if (insertionPoint.section === 'universal') {
        targetSection = 'universal';
      }

      // Calculate target index based on what the user sees
      let targetIndex = 0;
      
      console.log(`🔥 INSERTION POINT:`, insertionPoint);
      console.log(`🔥 TARGET SECTION:`, targetSection);
      
      if (insertionPoint.type === 'before-edit-background') {
        // Universal section - override target section and set index to end of universal fields
        targetSection = 'universal';
        targetIndex = fieldSectionManager.universalFields.length;
        console.log(`🔥 Before-edit-background: Moving to UNIVERSAL section, targetIndex=${targetIndex}`);
      } else if (insertionPoint.type === 'section-start') {
        targetIndex = 0;
        console.log(`🔥 Section-start: targetIndex=${targetIndex}`);
      } else if (insertionPoint.type === 'between-fields' && insertionPoint.beforeField) {
        // Get ONLY VISIBLE fields for the current view mode
        const { currentFields } = fieldSectionManager.getFieldsForView(selectedMode);
        const beforeIndex = currentFields.findIndex(f => f.platform === insertionPoint.beforeField);
        targetIndex = beforeIndex >= 0 ? beforeIndex : 0;
        console.log(`🔥 Between-fields BEFORE ${insertionPoint.beforeField}: beforeIndex=${beforeIndex}, targetIndex=${targetIndex}`);
        console.log(`🔥 VisibleFields:`, currentFields.map(f => f.platform));
      } else if (insertionPoint.type === 'after-fields' && insertionPoint.afterField) {
        // Get ONLY VISIBLE fields for the current view mode
        const { currentFields } = fieldSectionManager.getFieldsForView(selectedMode);
        const afterIndex = currentFields.findIndex(f => f.platform === insertionPoint.afterField);
        targetIndex = afterIndex >= 0 ? afterIndex + 1 : currentFields.length;
        console.log(`🔥 After-fields AFTER ${insertionPoint.afterField}: afterIndex=${afterIndex}, targetIndex=${targetIndex}`);
        console.log(`🔥 VisibleFields:`, currentFields.map(f => f.platform));
      } else {
        console.log(`🔥 UNKNOWN INSERTION POINT TYPE:`, insertionPoint);
      }
      
      // Use the parsed source section
      const fromSection = sourceSection || 'personal'; // fallback to personal if not found
      
      console.log(`🔥 MOVING FIELD ${platform} from ${fromSection} to ${targetSection}`);
      
      // Handle universal moves with consolidation, regular moves with moveField
      if (targetSection === 'universal') {
        fieldSectionManager.consolidateToUniversal(platform, fromSection);
      } else {
        fieldSectionManager.moveField(platform, targetSection, targetIndex, fromSection);
      }
      
      // Mark channel as confirmed when user drags it
      markChannelAsConfirmed(platform);
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

  // Refs for phone and email drag handling
  const phoneFieldRef = useRef<HTMLDivElement>(null);
  const emailFieldRef = useRef<HTMLDivElement>(null);


  useFreezeScrollOnFocus(nameInputRef);

  // Load selected mode from localStorage on mount
  useEffect(() => {
    try {
      const savedCategory = localStorage.getItem('nekt-sharing-category') as ProfileViewMode;
      if (savedCategory && ['Personal', 'Work'].includes(savedCategory)) {
        setSelectedMode(savedCategory);
      }
      setHasLoadedFromStorage(true);
    } catch (error) {
      console.warn('Failed to load sharing category from localStorage:', error);
      setHasLoadedFromStorage(true);
    }
  }, []);

  // Handle mode change from selector
  const handleModeChange = (mode: ProfileViewMode) => {
    if (mode === selectedMode) return;
    
    setSelectedMode(mode);
    
    // Save to localStorage
    try {
      localStorage.setItem('nekt-sharing-category', mode);
      // Trigger storage event for other components
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'nekt-sharing-category',
        newValue: mode,
        oldValue: null
      }));
    } catch (error) {
      console.warn('Failed to save sharing category to localStorage:', error);
    }
    
    // Animate carousel
    if (carouselRef.current) {
      const direction = mode === 'Work' ? -100 : 0;
      carouselRef.current.style.transform = `translateX(${direction}%)`;
    }
  };

  // Update carousel position when mode changes
  useEffect(() => {
    if (carouselRef.current && hasLoadedFromStorage) {
      // Translate by 100% + gap (1rem = 16px) to show the second item
      if (selectedMode === 'Work') {
        const container = carouselRef.current.parentElement;
        const containerWidth = container?.offsetWidth || 0;
        // Add 16px for the gap-4 (1rem)
        const translateAmount = -(containerWidth + 16);
        carouselRef.current.style.transform = `translateX(${translateAmount}px)`;
      } else {
        carouselRef.current.style.transform = `translateX(0)`;
      }
    }
  }, [selectedMode, hasLoadedFromStorage]);

  useEffect(() => {
    if (profile && formData.socialProfiles.length === 0) {
      // Only update formData if it's empty (initial load)
      setFormData(profileToFormData(profile, session?.user));
    }
    
    // Always extract phone number when profile changes (separate from formData condition)
    if (profile) {
      const contactChannels = profile.contactChannels as any;
      if (contactChannels?.entries) {
        const phoneEntry = contactChannels.entries.find((e: any) => e.platform === 'phone');
        if (phoneEntry) {
          const phoneNumber = phoneEntry.nationalPhone || phoneEntry.internationalPhone?.replace(/^\+1/, '') || '';
          setDigits(phoneNumber.replace(/\D/g, ''));
        }
      } else if (contactChannels?.phoneInfo) {
        // Legacy format fallback
        const phoneInfo = contactChannels.phoneInfo;
        const phoneNumber = phoneInfo.nationalPhone || phoneInfo.internationalPhone?.replace(/^\+1/, '') || '';
        setDigits(phoneNumber.replace(/\D/g, ''));
      }
    }
  }, [profile]); // Remove session?.user dependency to prevent re-runs

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
        await fetch('/api/generate-profile/profile-image', {
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
        await fetch('/api/generate-profile/background-image', {
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

  // Handle social profile input change - use hook's unified state
  const handleSocialChange = (platform: SocialPlatform, value: string, section: FieldSection) => {
    // Mark this channel as confirmed when user edits it
    markChannelAsConfirmed(platform);
    
    // Update field value through the hook
    fieldSectionManager.updateFieldValue(platform, value, section);
  };
  
  // Get social profile value based on platform and section
  const getSocialProfileValue = (platform: string, section?: string): string => {
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
    
    const contactChannels = profile.contactChannels as any;
    
    // New array format
    if (contactChannels?.entries) {
      const entry = contactChannels.entries.find((e: any) => e.platform === platform);
      if (entry) {
        const hasContent = platform === 'phone' ? !!entry.nationalPhone || !!entry.internationalPhone :
                          platform === 'email' ? !!entry.email :
                          !!entry.username;
        return hasContent && !entry.userConfirmed;
      }
      return false;
    }
    
    // Legacy format fallback
    switch (platform) {
      case 'phone':
        return contactChannels.phoneInfo && !contactChannels.phoneInfo.userConfirmed;
      case 'email':
        return contactChannels.email && !contactChannels.email.userConfirmed;
      case 'facebook':
        return contactChannels.facebook && !contactChannels.facebook.userConfirmed;
      case 'instagram':
        return contactChannels.instagram && !contactChannels.instagram.userConfirmed;
      case 'x':
        return contactChannels.x && !contactChannels.x.userConfirmed;
      case 'linkedin':
        return contactChannels.linkedin && !contactChannels.linkedin.userConfirmed;
      case 'snapchat':
        return contactChannels.snapchat && !contactChannels.snapchat.userConfirmed;
      case 'whatsapp':
        return contactChannels.whatsapp && !contactChannels.whatsapp.userConfirmed;
      case 'telegram':
        return contactChannels.telegram && !contactChannels.telegram.userConfirmed;
      case 'wechat':
        return contactChannels.wechat && !contactChannels.wechat.userConfirmed;
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

  // NEW UNIFIED INSERTION POINT MARKER: Shows reserved space for target drops
  const InsertionPointMarker = ({ fieldId, position }: { fieldId: string; position: 'above' | 'below' }) => {
    const expectedId = `${fieldId}-${position}`;
    const shouldShow = dragAndDrop.currentReservedSpace?.type === 'target' && 
                      dragAndDrop.currentReservedSpace?.insertionPoint.id === expectedId;
    
    if (!shouldShow) return null;
    
    return (
      <div 
        className="w-full max-w-[var(--max-content-width,448px)] mx-auto transition-all duration-200"
        style={{ 
          height: '56px' // Match the actual CustomInput height
        }}
      />
    );
  };
    
  // Original field placeholder - shows ONLY when reserved space is type 'original' for this field
  const OriginalFieldPlaceholder = ({ fieldId, profile, viewMode }: { fieldId: string; profile: SocialProfileFormEntry; viewMode: 'Personal' | 'Work' }) => {
    // FIXED: Only show when currentReservedSpace is 'original' type for this specific field
    const shouldShow = dragAndDrop.currentReservedSpace?.type === 'original' && 
                       dragAndDrop.currentReservedSpace?.fieldId === fieldId;
    if (!shouldShow) return null;
    
    // Check if this field is in the current view context
    const isInCurrentView = profile.section === 'universal' || 
      (profile.section === 'personal' && viewMode === 'Personal') ||
      (profile.section === 'work' && viewMode === 'Work');
    
    if (!isInCurrentView) return null;
    
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

  // Render content for a specific view (Personal or Work)
  const renderViewContent = (viewMode: 'Personal' | 'Work') => {
    const { universalFields, currentFields, hiddenFields } = fieldSectionManager.getFieldsForView(viewMode);
    const currentSectionName = viewMode;
    
    return (
      <div className="w-full">

        {/* Current Section (Personal or Work) */}
        <div className="mb-6 w-full max-w-[var(--max-content-width,448px)] mx-auto">
          <FieldSectionComponent
            title={currentSectionName}
            isEmpty={currentFields.length === 0}
            emptyText={`You have no ${currentSectionName} networks right now. Drag & drop an input field to change that.`}
          >
            {/* Section start insertion point */}
            <SectionStartInsertionPoint section={currentSectionName.toLowerCase() as 'personal' | 'work'} />
            
            {currentFields.map((profile, index) => {
              const platform = profile.platform;
              const uniqueKey = `current-${platform}-${profile.section}-${index}`;
                
              return (
                <React.Fragment key={uniqueKey}>
                  {/* NEW: Unified insertion point before this field */}
                  <InsertionPointMarker fieldId={`${platform}-${profile.section}`} position="above" />
                  
                  {/* REMOVED: Original field placeholder - SocialProfileField handles its own invisible spacer */}
                  
                  <SocialProfileField
                    profile={profile}
                    dragAndDrop={dragAndDrop}
                    fieldSectionManager={fieldSectionManager}
                    getValue={getSocialProfileValue}
                    onChange={handleSocialChange}
                    isUnconfirmed={isChannelUnconfirmed}
                    onConfirm={markChannelAsConfirmed}
                    currentViewMode={viewMode}
                  />
                  
                  {/* NEW: Unified insertion point after this field */}
                  <InsertionPointMarker fieldId={`${platform}-${profile.section}`} position="below" />
                </React.Fragment>
              );
            })}
          </FieldSectionComponent>
        </div>

        {/* Hidden Section (fields from the OTHER view) */}
        <div className="mb-6 w-full max-w-[var(--max-content-width,448px)] mx-auto">
          <FieldSectionComponent
            title="Hidden"
            isEmpty={hiddenFields.length === 0}
            emptyText={`No ${viewMode === 'Personal' ? 'Work' : 'Personal'} networks to show here.`}
          >
            {/* Section start insertion point for hidden - not needed since hidden fields can't be reordered */}
            
            {hiddenFields.map((profile, index) => {
              const platform = profile.platform;
              const uniqueKey = `hidden-${platform}-${profile.section}-${index}`;
                
              return (
                <React.Fragment key={uniqueKey}>
                  {/* NEW: Unified insertion point before this field */}
                  <InsertionPointMarker fieldId={`${platform}-${profile.section}`} position="above" />
                  
                  <SocialProfileField
                    profile={profile}
                    dragAndDrop={dragAndDrop}
                    fieldSectionManager={fieldSectionManager}
                    getValue={getSocialProfileValue}
                    onChange={handleSocialChange}
                    isUnconfirmed={isChannelUnconfirmed}
                    onConfirm={markChannelAsConfirmed}
                    showDragHandles={false}
                    currentViewMode={viewMode}
                  />
                  
                  {/* NEW: Unified insertion point after this field */}
                  <InsertionPointMarker fieldId={`${platform}-${profile.section}`} position="below" />
                </React.Fragment>
              );
            })}
          </FieldSectionComponent>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center px-4 py-4 pb-8 relative">
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

      {/* Phone Input - Draggable */}
      <div 
        ref={phoneFieldRef}
        className="mb-5 w-full max-w-md"
        onTouchStart={(e) => {
          console.log('🟢 PHONE React touchstart');
          // Don't call preventDefault - let touchAction: 'none' handle scroll prevention
          dragAndDrop.onTouchStart('phone-universal')(e);
        }}
        onTouchMove={(e) => {
          console.log('🟢 PHONE React touchmove');
          // Don't call preventDefault - let touchAction: 'none' handle scroll prevention
          dragAndDrop.onTouchMove(e);
        }}
        onTouchEnd={(e) => {
          console.log('🟢 PHONE React touchend');
          // Don't call preventDefault - let touchAction: 'none' handle scroll prevention
          dragAndDrop.onTouchEnd();
        }}
        style={{}}
      >
        <CustomPhoneInput
          onChange={(value) => {
            setDigits(value);
            markChannelAsConfirmed('phone');
          }}
          value={digits}
          placeholder="Phone number"
          className="w-full"
          autoFocus={false}
          inputProps={{
            id: "phone-universal",
            autoComplete: "tel",
            className: "w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          }}
        />
      </div>

      {/* Email Input - Draggable */}
      <div 
        ref={emailFieldRef}
        className="mb-5 w-full max-w-md"
        onTouchStart={(e) => {
          console.log('🟢 EMAIL React touchstart');
          // Don't call preventDefault - let touchAction: 'none' handle scroll prevention
          dragAndDrop.onTouchStart('email-universal')(e);
        }}
        onTouchMove={(e) => {
          console.log('🟢 EMAIL React touchmove');
          // Don't call preventDefault - let touchAction: 'none' handle scroll prevention
          dragAndDrop.onTouchMove(e);
        }}
        onTouchEnd={(e) => {
          console.log('🟢 EMAIL React touchend');
          // Don't call preventDefault - let touchAction: 'none' handle scroll prevention
          dragAndDrop.onTouchEnd();
        }}
        style={{}}
      >
        <CustomInput
          type="email"
          id="email-universal"
          value={formData.email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setFormData((prev: ProfileFormData) => ({ ...prev, email: e.target.value }));
            markChannelAsConfirmed('email');
          }}
          placeholder="Email address"
          className="w-full"
          autoComplete="email"
          icon={
            <div className="w-5 h-5 flex items-center justify-center relative">
              <SocialIcon 
                platform="email" 
                username={formData.email}
                size="sm" 
              />
            </div>
          }
        />
      </div>

      {/* Dynamic Universal Fields (non-phone/email) - rendered above Edit Background */}
      {fieldSectionManager.universalFields.filter(profile => !['phone', 'email'].includes(profile.platform)).map((profile, index) => {
        const platform = profile.platform;
        const uniqueKey = `universal-${platform}-${profile.section}-${index}`;
          
        return (
          <React.Fragment key={uniqueKey}>
            <div className="w-full max-w-md">
              <SocialProfileField
                profile={profile}
                dragAndDrop={dragAndDrop}
                fieldSectionManager={fieldSectionManager}
                getValue={getSocialProfileValue}
                onChange={handleSocialChange}
                isUnconfirmed={isChannelUnconfirmed}
                onConfirm={markChannelAsConfirmed}
                currentViewMode={selectedMode}
              />
            </div>
          </React.Fragment>
        );
      })}

      {/* Universal insertion point (before Edit Background) */}
      <UniversalInsertionPoint />

      {/* Edit Background - Outside carousel */}
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

      {/* Carousel Container */}
      <div className="w-full overflow-hidden">
        <div 
          ref={carouselRef}
          className="flex gap-4 transition-transform duration-300 ease-out"
        >
          {/* Personal View - Full container width */}
          <div className="w-full flex-shrink-0">
            {renderViewContent('Personal')}
          </div>
          
          {/* Work View - Full container width */}
          <div className="w-full flex-shrink-0">
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
