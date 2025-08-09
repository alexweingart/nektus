'use client';

import { useState, useCallback, useMemo } from 'react';
import type { SocialProfileFormEntry, FieldSection, SocialPlatform } from '@/types/forms';

// Default section assignments for social platforms
const DEFAULT_SECTION_ASSIGNMENTS: Record<SocialPlatform, FieldSection> = {
  // Universal fields (handled separately in the component)
  phone: 'universal',
  email: 'universal',
  
  // Personal section
  facebook: 'personal',
  instagram: 'personal',
  x: 'personal',
  snapchat: 'personal',
  whatsapp: 'personal',
  telegram: 'personal',
  wechat: 'personal',
  
  // Work section
  linkedin: 'work',
};

// All supported social platforms (excluding email/phone which are universal)
const ALL_SOCIAL_PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'];

interface UseEditProfileFieldsProps {
  initialSocialProfiles: SocialProfileFormEntry[];
  onSocialProfilesChange: (profiles: SocialProfileFormEntry[]) => void;
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
  moveField: (platform: string, toSection: FieldSection, toIndex?: number, fromSection?: string) => void;
  splitUniversalField: (platform: string, currentValue: string, targetSection?: 'personal' | 'work', targetIndex?: number) => void;
  consolidateToUniversal: (platform: string, fromSection: string) => void;
  
  // Get field data
  getFieldData: (platform: string, section?: FieldSection) => SocialProfileFormEntry | undefined;
  isFieldHidden: (platform: string, viewMode: 'Personal' | 'Work') => boolean;
}

export const useEditProfileFields = ({ 
  initialSocialProfiles, 
  onSocialProfilesChange 
}: UseEditProfileFieldsProps): UseEditProfileFieldsReturn => {


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
          shareEnabled: true,
          filled: false,
          section: 'personal',
          isVisible: false
        });
      }
      
      if (!hasWork) {
        result.push({
          platform,
          username: '',
          shareEnabled: true,
          filled: false,
          section: 'work',
          isVisible: false
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
    
    // Check if this is a universal field being hidden
    const universalField = profiles.find(p => p.platform === platform && p.section === 'universal');
    
    if (universalField) {
      // Universal field being hidden: split into both sections as hidden
      console.log(`🔥 HIDING UNIVERSAL FIELD ${platform} - splitting to both sections as hidden`);
      
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
        shareEnabled: universalField.shareEnabled,
        filled: universalField.filled,
        confirmed: universalField.confirmed,
        section: 'personal',
        isVisible: false // Hidden by default
      };
      
      const workEntry: SocialProfileFormEntry = {
        platform: platform as any,
        username: universalField.username,
        shareEnabled: universalField.shareEnabled,
        filled: universalField.filled,
        confirmed: universalField.confirmed,
        section: 'work',
        isVisible: false // Hidden by default
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

  // Simple array-based field moving
  const moveField = useCallback((platform: string, toSection: FieldSection, toIndex?: number, fromSection?: string) => {
    // Find the moving field - be more specific about which field we're moving
    const movingField = profiles.find(p => {
      if (fromSection) {
        return p.platform === platform && p.section === fromSection;
      } else {
        // If no fromSection specified, find the first visible field with this platform
        return p.platform === platform && p.isVisible;
      }
    });
    
    if (!movingField) return;
    
    // Remove ONLY the specific field we're moving
    const otherProfiles = profiles.filter(p => p !== movingField);
    
    // Update the field's section and handle visibility properly
    const updatedField = {
      ...movingField,
      section: toSection,
      // If moving FROM universal, ensure it stays visible (universal fields are always visible)
      // If moving within personal/work, preserve existing visibility
      isVisible: movingField.section === 'universal' ? true : movingField.isVisible
    };
    
    // Get VISIBLE fields in target section for positioning calculation
    const visibleTargetFields = otherProfiles.filter(p => p.section === toSection && p.isVisible);
    
    // If moving within the same section, adjust index if the item was originally before the target position
    let adjustedIndex = toIndex || 0;
    if (movingField.section === toSection && movingField.isVisible) {
      // Find where the moving field was in the visible list
      const originalVisibleFields = profiles.filter(p => p.section === toSection && p.isVisible);
      const originalIndex = originalVisibleFields.findIndex(p => p.platform === platform);
      
      // If moving from before the target position, decrement target index
      if (originalIndex >= 0 && originalIndex < adjustedIndex) {
        adjustedIndex--;
      }
    }
    
    // Insert at specified position within visible fields
    const insertIndex = Math.min(Math.max(0, adjustedIndex), visibleTargetFields.length);
    visibleTargetFields.splice(insertIndex, 0, updatedField);
    
    // Get hidden fields in target section (to preserve them)
    const hiddenTargetFields = otherProfiles.filter(p => p.section === toSection && !p.isVisible);
    
    // Combine all sections: other sections + target visible fields + target hidden fields
    const otherSectionFields = otherProfiles.filter(p => p.section !== toSection);
    const finalProfiles = [...otherSectionFields, ...visibleTargetFields, ...hiddenTargetFields];
    
    updateProfiles(finalProfiles);
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
    
    const result = {
      // Universal fields always show
      universalFields: profiles.filter(field => field.section === 'universal'),
      
      // Current section fields that are visible (in natural array order)
      currentFields: profiles.filter(field => 
        field.section === currentSectionName && field.isVisible
      ),
      
      // Hidden fields = current section fields that are not visible AND don't exist in universal
      hiddenFields: profiles.filter(field => {
        if (field.section !== currentSectionName || field.isVisible) return false;
        
        // Don't show as hidden if this platform already exists in universal
        const existsInUniversal = profiles.some(p => p.platform === field.platform && p.section === 'universal');
        return !existsInUniversal;
      })
    };
    
    return result;
  }, [profiles]);

  // Split a universal field into separate Personal and Work entries
  const splitUniversalField = useCallback((platform: string, currentValue: string, targetSection?: 'personal' | 'work', targetIndex?: number) => {
    console.log(`🔥 SPLITTING ${platform} with value: ${currentValue}${targetSection ? ` to ${targetSection} at index ${targetIndex}` : ''}`);
    console.log(`🔥 BEFORE SPLIT:`, profiles.filter(p => p.platform === platform));
    
    // Remove ALL entries for this platform (universal, personal, work) to avoid duplicates
    const profilesWithoutPlatform = profiles.filter(profile => 
      profile.platform !== platform
    );
    
    console.log(`🔥 AFTER REMOVING PLATFORM:`, profilesWithoutPlatform.filter(p => p.platform === platform));
    
    // Create new Personal and Work entries with the current value
    const personalEntry: SocialProfileFormEntry = {
      platform: platform as any,
      username: currentValue,
      shareEnabled: true,
      filled: Boolean(currentValue),
      section: 'personal',
      isVisible: Boolean(currentValue) // Visible if has content
    };
    
    const workEntry: SocialProfileFormEntry = {
      platform: platform as any,
      username: currentValue,
      shareEnabled: true,
      filled: Boolean(currentValue),
      section: 'work',
      isVisible: Boolean(currentValue) // Visible if has content
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
      console.log(`🔥 POSITIONED SPLIT: ${platform} added to ${targetSection} at index ${targetIndex}`);
    } else {
      // Default behavior: append to end
      updatedProfiles = [...profilesWithoutPlatform, personalEntry, workEntry];
      console.log(`🔥 DEFAULT SPLIT: ${platform} appended to end`);
    }
    
    console.log(`🔥 FINAL PROFILES FOR ${platform}:`, updatedProfiles.filter(p => p.platform === platform));
    
    updateProfiles(updatedProfiles);
  }, [profiles, updateProfiles]);

  // Consolidate personal/work entries into a single universal entry
  const consolidateToUniversal = useCallback((platform: string, fromSection: string) => {
    console.log(`🔥 CONSOLIDATING ${platform} from ${fromSection} to universal`);
    
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
        shareEnabled: movingField.shareEnabled,
        filled: movingField.filled || false,
        confirmed: movingField.confirmed,
        section: 'universal',
        isVisible: true // Universal fields are always visible
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
    moveField,
    splitUniversalField,
    consolidateToUniversal,
    
    // Get field data
    getFieldData,
    isFieldHidden,
  };
}; 