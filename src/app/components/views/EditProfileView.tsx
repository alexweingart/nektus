'use client';
/** @jsxImportSource react */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile } from '../../context/ProfileContext';
import type { UserProfile } from '@/types/profile';
import type { SocialPlatform, SocialProfileFormEntry, ProfileFormData } from '@/types/forms';
import CustomInput from '../ui/CustomInput';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import CustomPhoneInput from '../ui/CustomPhoneInput';
import SocialIcon from '../ui/SocialIcon';
import EditTitleBar from '../ui/EditTitleBar';
import CustomExpandingInput from '../ui/CustomExpandingInput';
import { SecondaryButton } from '../ui/SecondaryButton';
import { FieldSection } from '../ui/FieldSection';
import { useProfileSave } from '@/lib/hooks/useProfileSave';
import { useEditProfileFields } from '@/lib/hooks/useEditProfileFields';
import { profileToFormData } from '@/lib/utils/profileTransforms';
import type { CountryCode } from 'libphonenumber-js';
import { useFreezeScrollOnFocus } from '@/lib/hooks/useFreezeScrollOnFocus';

const EditProfileView: React.FC = () => {
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
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>('US');
  const [isDeleting, setIsDeleting] = useState(false);

  // Drag & Drop states
  const [isDragMode, setIsDragMode] = useState(false);
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  
  // Enhanced drag states
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dropZoneIndex, setDropZoneIndex] = useState<number | null>(null);
  const [dragElement, setDragElement] = useState<HTMLElement | null>(null);
  const [draggedFieldHeight, setDraggedFieldHeight] = useState<number>(0);

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

  // Auto-focus name input on mount for mobile convenience
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

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
  
  // Handle save profile
  const handleSave = async (): Promise<void> => {
    await saveProfileData(formData, digits, phoneCountry);
  };

  // Create floating drag element
  const createDragElement = useCallback((sourceElement: HTMLElement, platform: string) => {
    const clone = sourceElement.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.zIndex = '9999';
    clone.style.pointerEvents = 'none';
    clone.style.transform = 'scale(1.05)';
    clone.style.opacity = '0.9';
    clone.style.width = sourceElement.offsetWidth + 'px';
    clone.style.transition = 'none';
    
    // Add visual enhancement
    clone.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    clone.style.borderRadius = '9999px';
    
    document.body.appendChild(clone);
    return clone;
  }, []);

  // Update drag element position
  const updateDragElementPosition = useCallback((element: HTMLElement, x: number, y: number) => {
    if (!element) return;
    
    const rect = element.getBoundingClientRect();
    const centerX = x - rect.width / 2;
    const centerY = y - rect.height / 2;
    
    element.style.left = centerX + 'px';
    element.style.top = centerY + 'px';
  }, []);

  // Calculate drop zones
  const calculateDropZones = useCallback(() => {
    const zones: { index: number; y: number; element: HTMLElement }[] = [];
    let index = 0;
    
    // Zone after phone input
    const phoneElement = document.getElementById('phone-input')?.closest('.mb-5') as HTMLElement;
    if (phoneElement) {
      const rect = phoneElement.getBoundingClientRect();
      zones.push({ index: index++, y: rect.bottom + window.scrollY, element: phoneElement });
    }
    
    // Zones in personal section
    fieldSectionManager.personalFields.forEach((profile) => {
      const element = document.getElementById(profile.platform)?.closest('.mb-5') as HTMLElement;
      if (element && profile.platform !== draggedField) {
        const rect = element.getBoundingClientRect();
        zones.push({ index: index++, y: rect.top + window.scrollY, element });
        zones.push({ index: index++, y: rect.bottom + window.scrollY, element });
      }
    });
    
    // Zones in work section
    fieldSectionManager.workFields.forEach((profile) => {
      const element = document.getElementById(profile.platform)?.closest('.mb-5') as HTMLElement;
      if (element && profile.platform !== draggedField) {
        const rect = element.getBoundingClientRect();
        zones.push({ index: index++, y: rect.top + window.scrollY, element });
        zones.push({ index: index++, y: rect.bottom + window.scrollY, element });
      }
    });
    
    return zones.sort((a, b) => a.y - b.y);
  }, [draggedField, fieldSectionManager.personalFields, fieldSectionManager.workFields]);

  // Find nearest drop zone
  const findNearestDropZone = useCallback((y: number) => {
    const zones = calculateDropZones();
    const scrollY = window.scrollY;
    const currentY = y + scrollY;
    
    let nearestZone = 0;
    let minDistance = Infinity;
    
    zones.forEach((zone, index) => {
      const distance = Math.abs(zone.y - currentY);
      if (distance < minDistance) {
        minDistance = distance;
        nearestZone = index;
      }
    });
    
    return nearestZone;
  }, [calculateDropZones]);

  // Drag & Drop Functions
  const startLongPress = useCallback((fieldId: string, event: React.TouchEvent) => {
    // If already in drag mode, switch active field instead
    if (isDragMode) {
      setDraggedField(fieldId);
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      return;
    }

    const touch = event.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });

    const timer = setTimeout(() => {
      setIsDragMode(true);
      setDraggedField(fieldId);
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 2000); // 2 second long press

    setLongPressTimer(timer);
  }, [isDragMode]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setTouchStartPos(null);
  }, [longPressTimer]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!touchStartPos || !isDragMode || !draggedField) return;

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);

    // Cancel long press if finger moves too much during initial press
    if (!isDragMode && (deltaX > 10 || deltaY > 10)) {
      cancelLongPress();
      return;
    }

    // Start dragging if we've moved beyond threshold
    if (isDragMode && !isDragging && (deltaX > 5 || deltaY > 5)) {
      setIsDragging(true);
      
      // Create drag element
      const sourceElement = document.getElementById(draggedField)?.closest('.mb-5') as HTMLElement;
      if (sourceElement) {
        // Capture the height for drop zone spacing
        setDraggedFieldHeight(sourceElement.offsetHeight);
        
        const dragEl = createDragElement(sourceElement, draggedField);
        setDragElement(dragEl);
        updateDragElementPosition(dragEl, touch.clientX, touch.clientY);
      }
      
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }

    // Update drag position and drop zone
    if (isDragging) {
      setDragPosition({ x: touch.clientX, y: touch.clientY });
      
      if (dragElement) {
        updateDragElementPosition(dragElement, touch.clientX, touch.clientY);
      }
      
      const nearestZone = findNearestDropZone(touch.clientY);
      setDropZoneIndex(nearestZone);
    }
  }, [touchStartPos, isDragMode, draggedField, isDragging, dragElement, cancelLongPress, createDragElement, updateDragElementPosition, findNearestDropZone]);

  const exitDragMode = useCallback(() => {
    setIsDragMode(false);
    setDraggedField(null);
    setIsDragging(false);
    setDragPosition(null);
    setDropZoneIndex(null);
    
    // Clean up drag element
    if (dragElement) {
      document.body.removeChild(dragElement);
      setDragElement(null);
    }
    
    cancelLongPress();
  }, [dragElement, cancelLongPress]);

  // Handle edge scrolling when dragging near viewport edges
  const handleEdgeScroll = useCallback((clientY: number) => {
    if (!isDragMode) return;

    const viewportHeight = window.innerHeight;
    const scrollZone = 100; // pixels from edge to trigger scroll
    const scrollSpeed = 5; // pixels per frame

    if (clientY < scrollZone) {
      // Near top - scroll up
      window.scrollBy(0, -scrollSpeed);
    } else if (clientY > viewportHeight - scrollZone) {
      // Near bottom - scroll down
      window.scrollBy(0, scrollSpeed);
    }
  }, [isDragMode]);

  // Prevent page scroll when in drag mode and handle click outside
  useEffect(() => {
    if (isDragMode) {
      const preventScroll = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          handleEdgeScroll(e.touches[0].clientY);
        }
      };

      const preventDefaultScroll = (e: TouchEvent) => {
        e.preventDefault();
      };

      const preventContextMenu = (e: Event) => {
        e.preventDefault();
      };

      const handleClickOutside = (e: TouchEvent) => {
        const target = e.target as Element;
        
        // Check if the touch is on a draggable field or its children
        const isOnDraggableField = target.closest('[data-draggable="true"]');
        
        if (!isOnDraggableField) {
          exitDragMode();
        }
      };

      // Prevent default scroll behavior and pull-to-refresh
      document.addEventListener('touchmove', preventDefaultScroll, { passive: false });
      
      // Add edge scrolling
      document.addEventListener('touchmove', preventScroll, { passive: true });
      
      // Prevent context menu during drag mode
      document.addEventListener('contextmenu', preventContextMenu);
      
      // Handle click outside to exit drag mode
      document.addEventListener('touchstart', handleClickOutside, { passive: true });

      return () => {
        document.removeEventListener('touchmove', preventDefaultScroll);
        document.removeEventListener('touchmove', preventScroll);
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isDragMode, handleEdgeScroll, exitDragMode]);

  // Drop zone spacer component
  const DropZoneSpacer = ({ index, isActive }: { index: number; isActive: boolean }) => (
    <div 
      className="transition-all duration-200"
      style={{ 
        height: isActive ? `${draggedFieldHeight}px` : '0px',
        marginBottom: isActive ? '20px' : '0px' // Match the mb-5 spacing
      }}
    />
  );
  
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
          inputProps={{
            id: "phone-input",
            autoComplete: "tel",
            className: "w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          }}
        />
      </div>

      {/* Drop zone after phone */}
      {isDragMode && <DropZoneSpacer index={0} isActive={dropZoneIndex === 0} />}

      {/* Edit Background */}
      <div className="mb-5 text-center w-full max-w-md">
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
          {fieldSectionManager.personalFields.map((profile, index) => {
            const platform = profile.platform;
            const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
            const placeholder = 
              platform === 'x' ? 'X username' : 
              platform === 'wechat' ? 'WeChat ID' :
              platform === 'whatsapp' ? 'WhatsApp number' :
              `${platformName} username`;

            const isBeingDragged = isDragging && draggedField === platform;
              
            return (
              <React.Fragment key={platform}>
                {/* Drop zone before this field */}
                {isDragMode && <DropZoneSpacer index={index * 2 + 1} isActive={dropZoneIndex === index * 2 + 1} />}
                
                <div 
                  data-draggable="true"
                  className={`mb-5 w-full max-w-[var(--max-content-width,448px)] transition-opacity duration-200 ${
                    isDragMode && draggedField !== platform ? 'opacity-70' : ''
                  } ${isBeingDragged ? 'hidden' : ''}`}
                  onTouchStart={(e) => {
                    if (isDragMode) {
                      // In drag mode, immediate tap switches active field
                      setDraggedField(platform);
                      if (navigator.vibrate) {
                        navigator.vibrate(30);
                      }
                    } else {
                      // Not in drag mode, start long press detection
                      startLongPress(platform, e);
                    }
                  }}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={cancelLongPress}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                  }}
                >
                  <CustomInput
                    type="text"
                    id={platform}
                    value={getSocialProfileValue(platform)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      handleSocialChange(platform as SocialPlatform, e.target.value);
                    }}
                    placeholder={placeholder}
                    className="w-full"
                    inputClassName="pl-2 text-base"
                    variant="hideable"
                    isHidden={fieldSectionManager.isFieldHidden(platform)}
                    onToggleHide={() => fieldSectionManager.toggleFieldVisibility(platform)}
                    dragState={
                      !isDragMode ? 'normal' : 
                      draggedField === platform ? 'active' : 'draggable'
                    }
                    icon={
                      <div className="w-5 h-5 flex items-center justify-center">
                        <SocialIcon 
                          platform={platform as SocialPlatform} 
                          username={getSocialProfileValue(platform)}
                          size="sm" 
                        />
                      </div>
                    }
                    iconClassName="text-gray-600"
                  />
                </div>
                
                {/* Drop zone after this field */}
                {isDragMode && <DropZoneSpacer index={index * 2 + 2} isActive={dropZoneIndex === index * 2 + 2} />}
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
          {fieldSectionManager.workFields.map((profile, index) => {
            const platform = profile.platform;
            const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
            const placeholder = `${platformName} username`;

            const isBeingDragged = isDragging && draggedField === platform;
            const baseIndex = fieldSectionManager.personalFields.length * 2 + 1;
              
            return (
              <React.Fragment key={platform}>
                {/* Drop zone before this field */}
                {isDragMode && <DropZoneSpacer index={baseIndex + index * 2} isActive={dropZoneIndex === baseIndex + index * 2} />}
                
                <div 
                  data-draggable="true"
                  className={`mb-5 w-full max-w-[var(--max-content-width,448px)] transition-opacity duration-200 ${
                    isDragMode && draggedField !== platform ? 'opacity-70' : ''
                  } ${isBeingDragged ? 'hidden' : ''}`}
                  onTouchStart={(e) => {
                    if (isDragMode) {
                      // In drag mode, immediate tap switches active field
                      setDraggedField(platform);
                      if (navigator.vibrate) {
                        navigator.vibrate(30);
                      }
                    } else {
                      // Not in drag mode, start long press detection
                      startLongPress(platform, e);
                    }
                  }}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={cancelLongPress}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                  }}
                >
                  <CustomInput
                    type="text"
                    id={platform}
                    value={getSocialProfileValue(platform)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      handleSocialChange(platform as SocialPlatform, e.target.value);
                    }}
                    placeholder={placeholder}
                    className="w-full"
                    inputClassName="pl-2 text-base"
                    variant="hideable"
                    isHidden={fieldSectionManager.isFieldHidden(platform)}
                    onToggleHide={() => fieldSectionManager.toggleFieldVisibility(platform)}
                    dragState={
                      !isDragMode ? 'normal' : 
                      draggedField === platform ? 'active' : 'draggable'
                    }
                    icon={
                      <div className="w-5 h-5 flex items-center justify-center">
                        <SocialIcon 
                          platform={platform as SocialPlatform} 
                          username={getSocialProfileValue(platform)}
                          size="sm" 
                        />
                      </div>
                    }
                    iconClassName="text-gray-600"
                  />
                </div>
                
                {/* Drop zone after this field */}
                {isDragMode && <DropZoneSpacer index={baseIndex + index * 2 + 1} isActive={dropZoneIndex === baseIndex + index * 2 + 1} />}
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
            const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
            const placeholder = 
              platform === 'x' ? 'X username' : 
              platform === 'wechat' ? 'WeChat ID' :
              platform === 'whatsapp' ? 'WhatsApp number' :
              `${platformName} username`;
              
            return (
              <div key={platform} className="mb-5 w-full max-w-[var(--max-content-width,448px)]">
                <CustomInput
                  type="text"
                  id={platform}
                  value={getSocialProfileValue(platform)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    handleSocialChange(platform as SocialPlatform, e.target.value);
                  }}
                  placeholder={placeholder}
                  className="w-full"
                  inputClassName="pl-2 text-base"
                  variant="hideable"
                  isHidden={fieldSectionManager.isFieldHidden(platform)}
                  onToggleHide={() => fieldSectionManager.toggleFieldVisibility(platform)}
                  icon={
                    <div className="w-5 h-5 flex items-center justify-center">
                      <SocialIcon 
                        platform={platform as SocialPlatform} 
                        username={getSocialProfileValue(platform)}
                        size="sm" 
                      />
                    </div>
                  }
                  iconClassName="text-gray-600"
                />
              </div>
            );
          })}
        </FieldSection>
      </div>
      

      

    </div>
  );
};

export default EditProfileView;
