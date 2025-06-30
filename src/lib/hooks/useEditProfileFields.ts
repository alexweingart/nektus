'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
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

// Default order within sections
const DEFAULT_FIELD_ORDER: Record<SocialPlatform, number> = {
  // Universal (handled in component)
  phone: 0,
  email: 1,
  
  // Personal section
  facebook: 0,
  instagram: 1,
  x: 2,
  snapchat: 3,
  whatsapp: 4,
  telegram: 5,
  wechat: 6,
  
  // Work section
  linkedin: 0,
};

interface UseEditProfileFieldsProps {
  initialSocialProfiles: SocialProfileFormEntry[];
  onSocialProfilesChange: (profiles: SocialProfileFormEntry[]) => void;
}

interface UseEditProfileFieldsReturn {
  // Field organization
  universalFields: SocialProfileFormEntry[];
  personalFields: SocialProfileFormEntry[];
  workFields: SocialProfileFormEntry[];
  hiddenFields: SocialProfileFormEntry[];
  
  // Section state
  isPersonalEmpty: boolean;
  isWorkEmpty: boolean;
  isHiddenEmpty: boolean;
  
  // Field actions
  toggleFieldVisibility: (platform: string) => void;
  moveField: (platform: string, toSection: FieldSection, toIndex?: number) => void;
  
  // Drag and drop
  isDragMode: boolean;
  draggedField: string | null;
  startDrag: (platform: string) => void;
  endDrag: () => void;
  
  // Get field data
  getFieldData: (platform: string) => SocialProfileFormEntry | undefined;
  isFieldHidden: (platform: string) => boolean;
}

export const useEditProfileFields = ({ 
  initialSocialProfiles, 
  onSocialProfilesChange 
}: UseEditProfileFieldsProps): UseEditProfileFieldsReturn => {
  // Initialize social profiles with section assignments if not already set
  const initializeProfiles = useCallback((profiles: SocialProfileFormEntry[]): SocialProfileFormEntry[] => {
    return profiles.map(profile => {
      if (!profile.section) {
        const defaultSection = DEFAULT_SECTION_ASSIGNMENTS[profile.platform as SocialPlatform] || 'personal';
        const defaultOrder = DEFAULT_FIELD_ORDER[profile.platform as SocialPlatform] || 999;
        
        return {
          ...profile,
          section: defaultSection,
          order: defaultOrder,
          originalSection: defaultSection !== 'hidden' ? defaultSection as 'personal' | 'work' : undefined
        };
      }
      return profile;
    });
  }, []);

  // Initialize profiles on first load
  const [profiles, setProfiles] = useState<SocialProfileFormEntry[]>(() => 
    initializeProfiles(initialSocialProfiles)
  );

  // Update profiles when initialSocialProfiles changes (e.g., when profile loads)
  useEffect(() => {
    const newProfiles = initializeProfiles(initialSocialProfiles);
    setProfiles(newProfiles);
  }, [initialSocialProfiles, initializeProfiles]);

  // Drag and drop state
  const [isDragMode, setIsDragMode] = useState(false);
  const [draggedField, setDraggedField] = useState<string | null>(null);

  // Update parent when profiles change
  const updateProfiles = useCallback((newProfiles: SocialProfileFormEntry[]) => {
    setProfiles(newProfiles);
    onSocialProfilesChange(newProfiles);
  }, [onSocialProfilesChange]);

  // Organize fields by section
  const fieldsBySection = useMemo(() => {
    const sections = {
      universal: [] as SocialProfileFormEntry[],
      personal: [] as SocialProfileFormEntry[],
      work: [] as SocialProfileFormEntry[],
      hidden: [] as SocialProfileFormEntry[]
    };

    profiles.forEach(profile => {
      const section = profile.section || 'personal';
      sections[section].push(profile);
    });

    // Sort each section by order
    Object.keys(sections).forEach(sectionKey => {
      const section = sectionKey as FieldSection;
      sections[section].sort((a, b) => (a.order || 999) - (b.order || 999));
    });

    return sections;
  }, [profiles]);

  // Check if sections are empty (excluding universal)
  const isPersonalEmpty = fieldsBySection.personal.length === 0;
  const isWorkEmpty = fieldsBySection.work.length === 0;
  const isHiddenEmpty = fieldsBySection.hidden.length === 0;

  // Toggle field visibility (hide/show)
  const toggleFieldVisibility = useCallback((platform: string) => {
    const updatedProfiles = profiles.map(profile => {
      if (profile.platform === platform) {
        if (profile.section === 'hidden') {
          // Restore to original section
          const originalSection = profile.originalSection || 'personal';
          return {
            ...profile,
            section: originalSection,
            order: DEFAULT_FIELD_ORDER[platform as SocialPlatform] || 999
          };
        } else {
          // Hide field
          return {
            ...profile,
            section: 'hidden' as FieldSection,
            originalSection: profile.section as 'personal' | 'work',
            order: 999 // Put at end of hidden section
          };
        }
      }
      return profile;
    });

    updateProfiles(updatedProfiles);
  }, [profiles, updateProfiles]);

  // Move field to different section/position
  const moveField = useCallback((platform: string, toSection: FieldSection, toIndex?: number) => {
    const updatedProfiles = profiles.map(profile => {
      if (profile.platform === platform) {
        return {
          ...profile,
          section: toSection,
          order: toIndex !== undefined ? toIndex : (profile.order || 999)
        };
      }
      return profile;
    });

    updateProfiles(updatedProfiles);
  }, [profiles, updateProfiles]);

  // Drag operations
  const startDrag = useCallback((platform: string) => {
    setIsDragMode(true);
    setDraggedField(platform);
  }, []);

  const endDrag = useCallback(() => {
    setIsDragMode(false);
    setDraggedField(null);
  }, []);

  // Get field data
  const getFieldData = useCallback((platform: string) => {
    return profiles.find(profile => profile.platform === platform);
  }, [profiles]);

  // Check if field is hidden
  const isFieldHidden = useCallback((platform: string) => {
    const field = getFieldData(platform);
    return field?.section === 'hidden';
  }, [getFieldData]);

  return {
    // Field organization
    universalFields: fieldsBySection.universal,
    personalFields: fieldsBySection.personal,
    workFields: fieldsBySection.work,
    hiddenFields: fieldsBySection.hidden,
    
    // Section state
    isPersonalEmpty,
    isWorkEmpty,
    isHiddenEmpty,
    
    // Field actions
    toggleFieldVisibility,
    moveField,
    
    // Drag and drop
    isDragMode,
    draggedField,
    startDrag,
    endDrag,
    
    // Get field data
    getFieldData,
    isFieldHidden,
  };
}; 