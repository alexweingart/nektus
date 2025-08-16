'use client';

import { useState, useCallback, useMemo } from 'react';
import type { SocialProfileFormEntry, FieldSection, SocialPlatform } from '@/types/forms';

/**
 * Custom hook for handling image uploads (profile and background)
 */
export const useImageUpload = () => {
  const handleImageUpload = useCallback(async (
    file: File,
    uploadType: 'profile' | 'background',
    onSuccess: (imageData: string) => void
  ) => {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const imageData = e.target?.result as string;
      onSuccess(imageData);
      
      // Call the appropriate API endpoint
      const endpoint = uploadType === 'profile' ? 'profile-image' : 'background-image';
      try {
        await fetch(`/api/generate-profile/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData }),
        });
      } catch (error) {
        console.error(`Error uploading ${uploadType} image:`, error);
        alert(`Failed to upload ${uploadType} image. Please try again.`);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const createUploadHandler = useCallback((
    uploadType: 'profile' | 'background',
    onSuccess: (imageData: string) => void
  ) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      handleImageUpload(file, uploadType, onSuccess);
    };
  }, [handleImageUpload]);

  return { createUploadHandler };
};

/**
 * Custom hook for managing profile view mode (Personal/Work) with localStorage and carousel
 */
export const useProfileViewMode = (carouselRef: React.RefObject<HTMLElement>) => {
  const [selectedMode, setSelectedMode] = useState<'Personal' | 'Work'>('Personal');
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  // Load from localStorage on mount
  const loadFromStorage = useCallback(() => {
    try {
      const savedCategory = localStorage.getItem('nekt-sharing-category') as 'Personal' | 'Work';
      if (savedCategory && ['Personal', 'Work'].includes(savedCategory)) {
        setSelectedMode(savedCategory);
      }
      setHasLoadedFromStorage(true);
    } catch (error) {
      console.warn('Failed to load sharing category from localStorage:', error);
      setHasLoadedFromStorage(true);
    }
  }, []);

  // Save to localStorage and animate carousel
  const handleModeChange = useCallback((mode: 'Personal' | 'Work') => {
    if (mode === selectedMode) return;
    
    setSelectedMode(mode);
    
    // Save to localStorage
    try {
      localStorage.setItem('nekt-sharing-category', mode);
    } catch (error) {
      console.warn('Failed to save sharing category to localStorage:', error);
    }
    
    // Animate carousel
    if (carouselRef.current) {
      if (mode === 'Work') {
        const container = carouselRef.current.parentElement;
        const containerWidth = container?.offsetWidth || 0;
        const translateAmount = -(containerWidth + 16); // Add gap
        carouselRef.current.style.transform = `translateX(${translateAmount}px)`;
      } else {
        carouselRef.current.style.transform = 'translateX(0)';
      }
    }
  }, [selectedMode, carouselRef]);

  return {
    selectedMode,
    hasLoadedFromStorage,
    loadFromStorage,
    handleModeChange
  };
};

// All supported social platforms (excluding email/phone which are universal)
const ALL_SOCIAL_PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'x', 'snapchat', 'whatsapp', 'telegram', 'wechat', 'linkedin'];

interface UseEditProfileFieldsProps {
  initialSocialProfiles: SocialProfileFormEntry[];
  onSocialProfilesChange: (profiles: SocialProfileFormEntry[]) => void;
  profile?: any; // To access contactChannels for confirmation status
}

interface UseEditProfileFieldsReturn {
  // Field organization
  universalFields: SocialProfileFormEntry[];
  personalFields: SocialProfileFormEntry[];
  workFields: SocialProfileFormEntry[];
  
  // Field organization by current view mode
  getFieldsForView: (viewMode: 'Personal' | 'Work') => {
    universalFields: SocialProfileFormEntry[];
    currentFields: SocialProfileFormEntry[];
    hiddenFields: SocialProfileFormEntry[];
  };
  
  // Section state
  isPersonalEmpty: boolean;
  isWorkEmpty: boolean;
  
  // Field actions
  toggleFieldVisibility: (platform: string, viewMode: 'Personal' | 'Work') => void;
  updateFieldValue: (platform: string, value: string, section: FieldSection) => void;
  splitUniversalField: (platform: string, currentValue: string, targetSection?: 'personal' | 'work', targetIndex?: number) => void;
  consolidateToUniversal: (platform: string, fromSection: string) => void;
  
  // Get field data
  getFieldData: (platform: string, section?: FieldSection) => SocialProfileFormEntry | undefined;
  isFieldHidden: (platform: string, viewMode: 'Personal' | 'Work') => boolean;
  
  // Confirmation handling
  markChannelAsConfirmed: (platform: string) => void;
  isChannelUnconfirmed: (platform: string) => boolean;
}

export const useEditProfileFields = ({ 
  initialSocialProfiles, 
  onSocialProfilesChange,
  profile
}: UseEditProfileFieldsProps): UseEditProfileFieldsReturn => {
  // Track confirmed channels locally
  const [confirmedChannels, setConfirmedChannels] = useState<Set<string>>(new Set());
  
  // Mark a channel as confirmed
  const markChannelAsConfirmed = useCallback((platform: string) => {
    setConfirmedChannels(prev => new Set(prev).add(platform));
    // Update the profiles to reflect confirmation
    setProfiles(current => 
      current.map(p => 
        p.platform === platform 
          ? { ...p, confirmed: true }
          : p
      )
    );
  }, []);
  
  // Check if a channel is unconfirmed based on Firebase data and local state
  const isChannelUnconfirmed = useCallback((platform: string): boolean => {
    // If locally confirmed, it's confirmed
    if (confirmedChannels.has(platform)) {
      return false;
    }
    
    if (!profile?.contactChannels) return false;
    
    const contactChannels = profile.contactChannels as any;
    if (contactChannels?.entries) {
      const entry = contactChannels.entries.find((e: any) => e.platform === platform);
      if (entry) {
        const hasContent = platform === 'phone' ? !!entry.nationalPhone || !!entry.internationalPhone :
                          platform === 'email' ? !!entry.email :
                          !!entry.username;
        return hasContent && !entry.userConfirmed;
      }
    }
    return false;
  }, [confirmedChannels, profile]);


  // Simple state - no reactive initialization, only use initial props once
  const [profiles, setProfiles] = useState<SocialProfileFormEntry[]>(() => {
    const result: SocialProfileFormEntry[] = [];
    
    // Add existing profiles directly, with minimal cleanup
    initialSocialProfiles.forEach(profile => {
      result.push({
        ...profile,
        // Fix legacy 'hidden' section references
        section: (profile.section as any) === 'hidden' ? 'personal' : profile.section,
        // Trust the visibility state from profileToFormData (it handles backward compatibility)
        isVisible: profile.isVisible
      });
    });
    
    // Only create missing personal/work entries for platforms that don't exist at all
    ALL_SOCIAL_PLATFORMS.forEach(platform => {
      const hasPersonal = result.some(p => p.platform === platform && p.section === 'personal');
      const hasWork = result.some(p => p.platform === platform && p.section === 'work');
      const hasUniversal = result.some(p => p.platform === platform && p.section === 'universal');
      
      // Skip if this platform exists as universal
      if (hasUniversal) return;
      
      // Create minimal entries only if completely missing
      if (!hasPersonal) {
        result.push({
          platform,
          username: '',
          filled: false,
          section: 'personal',
          isVisible: false,
          order: result.length
        });
      }
      
      if (!hasWork) {
        result.push({
          platform,
          username: '',
          filled: false,
          section: 'work',
          isVisible: false,
          order: result.length
        });
      }
    });
    
    return result;
  });

  // Update parent when profiles change
  const updateProfiles = useCallback((newProfiles: SocialProfileFormEntry[]) => {
    setProfiles(newProfiles);
    onSocialProfilesChange(newProfiles);
  }, [onSocialProfilesChange]);

  // Simple field organization by section
  const fieldsBySection = useMemo(() => ({
    universal: profiles.filter(p => p.section === 'universal'),
    personal: profiles.filter(p => p.section === 'personal'),
    work: profiles.filter(p => p.section === 'work')
  }), [profiles]);

  // Check if sections are empty (excluding universal)
  const isPersonalEmpty = fieldsBySection.personal.filter(p => p.isVisible && p.filled).length === 0;
  const isWorkEmpty = fieldsBySection.work.filter(p => p.isVisible && p.filled).length === 0;

  // Toggle field visibility (hide/show) - handles universal field splitting when hiding
  const toggleFieldVisibility = useCallback((platform: string, viewMode: 'Personal' | 'Work') => {
    const targetSection = viewMode.toLowerCase() as 'personal' | 'work';
    
    // Special handling for email and phone UNIVERSAL fields - these are stored outside socialProfiles
    // Only apply this logic when hiding a universal field, not when toggling personal/work visibility
    if ((platform === 'email' || platform === 'phone') && 
        !profiles.some(p => p.platform === platform && (p.section === 'personal' || p.section === 'work'))) {
      
      // Remove any existing personal/work entries for this platform
      const profilesWithoutPlatform = profiles.filter(p => p.platform !== platform);
      
      // Create Personal and Work entries as HIDDEN
      // Note: The actual value is stored in formData.email or digits, not in socialProfiles
      const personalEntry: SocialProfileFormEntry = {
        platform: platform as any,
        username: '', // Value will come from formData/digits
        filled: true, // Assume filled if we're hiding it
        section: 'personal',
        isVisible: false, // Hidden by default
        order: 0 // Will be updated later
      };
      
      const workEntry: SocialProfileFormEntry = {
        platform: platform as any,
        username: '', // Value will come from formData/digits
        filled: true, // Assume filled if we're hiding it
        section: 'work',
        isVisible: false, // Hidden by default
        order: 0 // Will be updated later
      };
      
      const updatedProfiles = [...profilesWithoutPlatform, personalEntry, workEntry];
      updateProfiles(updatedProfiles);
      return;
    }
    
    // Check if this is a regular universal field being hidden
    const universalField = profiles.find(p => p.platform === platform && p.section === 'universal');
    
    if (universalField) {
      // Universal field being hidden: split into both sections as hidden
      
      // Remove the universal field
      const profilesWithoutUniversal = profiles.filter(profile => 
        !(profile.platform === platform && profile.section === 'universal')
      );
      
      // Also remove any existing personal/work entries for this platform to avoid duplicates
      const profilesWithoutPlatform = profilesWithoutUniversal.filter(p => p.platform !== platform);
      
      // Create Personal and Work entries as HIDDEN
      const personalEntry: SocialProfileFormEntry = {
        platform: platform as any,
        username: universalField.username,
        filled: universalField.filled,
        confirmed: universalField.confirmed,
        section: 'personal',
        isVisible: false, // Hidden by default
        order: universalField.order // Preserve order
      };
      
      const workEntry: SocialProfileFormEntry = {
        platform: platform as any,
        username: universalField.username,
        filled: universalField.filled,
        confirmed: universalField.confirmed,
        section: 'work',
        isVisible: false, // Hidden by default
        order: universalField.order // Preserve order
      };
      
      const updatedProfiles = [...profilesWithoutPlatform, personalEntry, workEntry];
      updateProfiles(updatedProfiles);
      return;
    }
    
    // Regular personal/work field visibility toggle
    const updatedProfiles = profiles.map(profile => {
      if (profile.platform === platform && profile.section === targetSection) {
        return {
          ...profile,
          isVisible: !profile.isVisible
        };
      }
      return profile;
    });

    updateProfiles(updatedProfiles);
  }, [profiles, updateProfiles]);

  // Update field value and visibility
  const updateFieldValue = useCallback((platform: string, value: string, section: FieldSection) => {
    const updatedProfiles = profiles.map(profile => {
      if (profile.platform === platform && profile.section === section) {
        return {
          ...profile,
          username: value,
          filled: value.trim() !== '',
          isVisible: profile.isVisible // Keep current visibility state
        };
      }
      return profile;
    });

    updateProfiles(updatedProfiles);
  }, [profiles, updateProfiles]);


  // Get field data
  const getFieldData = useCallback((platform: string, section?: FieldSection) => {
    if (section) {
      return profiles.find(profile => profile.platform === platform && profile.section === section);
    }
    return profiles.find(profile => profile.platform === platform);
  }, [profiles]);

  // Check if field is hidden
  const isFieldHidden = useCallback((platform: string, viewMode: 'Personal' | 'Work') => {
    const targetSection = viewMode.toLowerCase() as 'personal' | 'work';
    const field = getFieldData(platform, targetSection);
    return !field?.isVisible;
  }, [getFieldData]);

  // Get fields organized for specific view mode (Personal or Work)
  const getFieldsForView = useCallback((viewMode: 'Personal' | 'Work') => {
    const currentSectionName = viewMode.toLowerCase() as 'personal' | 'work';
    
    // Helper function to sort fields by their order property (from Firebase data)
    const sortByOrder = (fields: SocialProfileFormEntry[]) => {
      return fields.sort((a, b) => {
        // Use the order field from the data
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        return orderA - orderB;
      });
    };
    
    const result = {
      // Universal fields always show (sorted by order)
      universalFields: sortByOrder(
        profiles.filter(field => field.section === 'universal')
      ),
      
      // Current section fields that are visible (sorted by order)
      currentFields: sortByOrder(
        profiles.filter(field => 
          field.section === currentSectionName && field.isVisible
        )
      ),
      
      // Hidden fields = current section fields that are not visible AND don't exist in universal (sorted by order)
      hiddenFields: sortByOrder(
        profiles.filter(field => {
          if (field.section !== currentSectionName || field.isVisible) return false;
          
          // Don't show as hidden if this platform already exists in universal
          const existsInUniversal = profiles.some(p => p.platform === field.platform && p.section === 'universal');
          return !existsInUniversal;
        })
      )
    };
    
    return result;
  }, [profiles]);

  // Split a universal field into separate Personal and Work entries
  const splitUniversalField = useCallback((platform: string, currentValue: string, targetSection?: 'personal' | 'work', targetIndex?: number) => {
    
    // Remove ALL entries for this platform (universal, personal, work) to avoid duplicates
    const profilesWithoutPlatform = profiles.filter(profile => 
      profile.platform !== platform
    );
    
    
    // Create new Personal and Work entries with the current value
    const personalEntry: SocialProfileFormEntry = {
      platform: platform as any,
      username: currentValue,
      filled: Boolean(currentValue),
      section: 'personal',
      isVisible: Boolean(currentValue), // Visible if has content
      order: 0 // Will be reassigned based on position
    };
    
    const workEntry: SocialProfileFormEntry = {
      platform: platform as any,
      username: currentValue,
      filled: Boolean(currentValue),
      section: 'work',
      isVisible: Boolean(currentValue), // Visible if has content
      order: 0 // Will be reassigned based on position
    };

    let updatedProfiles: SocialProfileFormEntry[];

    if (targetSection && targetIndex !== undefined) {
      // Position-aware split: place target entry at specific position, other entry at top of its section
      const personalProfiles = profilesWithoutPlatform.filter(p => p.section === 'personal');
      const workProfiles = profilesWithoutPlatform.filter(p => p.section === 'work');
      const universalProfiles = profilesWithoutPlatform.filter(p => p.section === 'universal');

      let newPersonalProfiles = [...personalProfiles];
      let newWorkProfiles = [...workProfiles];

      if (targetSection === 'personal') {
        // Insert personal entry at target position, work entry at top
        newPersonalProfiles.splice(targetIndex, 0, personalEntry);
        newWorkProfiles.unshift(workEntry);
      } else {
        // Insert work entry at target position, personal entry at top
        newWorkProfiles.splice(targetIndex, 0, workEntry);
        newPersonalProfiles.unshift(personalEntry);
      }

      updatedProfiles = [...universalProfiles, ...newPersonalProfiles, ...newWorkProfiles];
    } else {
      // Default behavior: append to end
      updatedProfiles = [...profilesWithoutPlatform, personalEntry, workEntry];
    }
    
    
    updateProfiles(updatedProfiles);
  }, [profiles, updateProfiles]);

  // Consolidate personal/work entries into a single universal entry
  const consolidateToUniversal = useCallback((platform: string, fromSection: string) => {
    
    // Find the field being moved to get its current value
    const movingField = profiles.find(p => p.platform === platform && p.section === fromSection);
    if (!movingField) return;
    
    // Remove ALL entries for this platform (both personal, work, and any existing universal)
    // This includes empty placeholder entries that might exist
    const profilesWithoutPlatform = profiles.filter(p => p.platform !== platform);
    
    // Only create universal entry if the moving field has content or was visible
    const shouldCreateUniversal = movingField.filled || movingField.isVisible || movingField.username.trim() !== '';
    
    let updatedProfiles = profilesWithoutPlatform;
    
    if (shouldCreateUniversal) {
      // Create single universal entry with the value from the field being moved
      const universalEntry: SocialProfileFormEntry = {
        platform: platform,
        username: movingField.username,
        filled: movingField.filled || false,
        confirmed: movingField.confirmed,
        section: 'universal',
        isVisible: true, // Universal fields are always visible
        order: movingField.order // Preserve order
      };
      
      updatedProfiles = [...profilesWithoutPlatform, universalEntry];
    }
    
    updateProfiles(updatedProfiles);
  }, [profiles, updateProfiles]);


  return {
    // Field organization
    universalFields: fieldsBySection.universal,
    personalFields: fieldsBySection.personal,
    workFields: fieldsBySection.work,
    
    // Field organization by current view mode
    getFieldsForView,
    
    // Section state
    isPersonalEmpty,
    isWorkEmpty,
    
    // Field actions
    toggleFieldVisibility,
    updateFieldValue,
    splitUniversalField,
    consolidateToUniversal,
    
    // Get field data
    getFieldData,
    isFieldHidden,
    
    // Confirmation handling
    markChannelAsConfirmed,
    isChannelUnconfirmed,
  };
}; 