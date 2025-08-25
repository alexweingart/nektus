'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Session } from 'next-auth';
import type { ContactEntry, FieldSection, UserProfile } from '@/types/profile';

// All supported field types in the application
const ALL_SUPPORTED_FIELD_TYPES = [
  // Core fields (always in universal)
  'name', 'bio', 'phone', 'email',
  // Social platforms
  'facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'
] as const;

/**
 * Unified field management hook - stores ALL field data (text + images) in one place
 */
interface UseEditProfileFieldsProps {
  profile?: UserProfile | null; // Firebase profile object
  session?: Session | null; // Session for fallback values
  initialImages?: { profileImage: string; backgroundImage: string };
  onFieldsChange?: (fields: ContactEntry[], images: { profileImage: string; backgroundImage: string }) => void;
}

export interface UseEditProfileFieldsReturn {
  // Unified field access
  getFieldValue: (fieldType: string) => string;
  setFieldValue: (fieldType: string, value: string) => void;
  
  // Image access
  getImageValue: (type: 'profileImage' | 'backgroundImage') => string;
  setImageValue: (type: 'profileImage' | 'backgroundImage', value: string) => void;
  
  // Field organization
  universalFields: ContactEntry[];
  personalFields: ContactEntry[];
  workFields: ContactEntry[];
  
  // Field organization by current view mode
  getFieldsForView: (viewMode: 'Personal' | 'Work') => {
    universalFields: ContactEntry[];
    currentFields: ContactEntry[];
    hiddenFields: ContactEntry[];
  };
  
  // Section state
  isPersonalEmpty: boolean;
  isWorkEmpty: boolean;
  
  // Field actions
  toggleFieldVisibility: (fieldType: string, viewMode: 'Personal' | 'Work') => void;
  updateFieldValue: (fieldType: string, value: string, section: FieldSection) => void;
  splitUniversalField: (fieldType: string, currentValue: string, targetSection: 'personal' | 'work', targetIndex: number) => void;
  consolidateToUniversal: (fieldType: string, currentValue: string, targetIndex: number) => void;
  reorderFieldsInSection: (originalFieldType: string, targetFieldType: string, section: FieldSection) => void;
  
  // Get field data
  getFieldData: (fieldType: string, section?: FieldSection) => ContactEntry | undefined;
  isFieldHidden: (fieldType: string, viewMode: 'Personal' | 'Work') => boolean;
  
  // Confirmation handling
  markChannelAsConfirmed: (fieldType: string) => void;
  isChannelUnconfirmed: (fieldType: string) => boolean;
}

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

  // Animate carousel to match selected mode
  const animateCarousel = useCallback((mode: 'Personal' | 'Work') => {
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
  }, [carouselRef]);

  // Load from localStorage on mount
  const loadFromStorage = useCallback(() => {
    try {
      const savedCategory = localStorage.getItem('nekt-sharing-category') as 'Personal' | 'Work';
      if (savedCategory && ['Personal', 'Work'].includes(savedCategory)) {
        setSelectedMode(savedCategory);
        // Animate carousel after loading from storage
        setTimeout(() => animateCarousel(savedCategory), 0);
      }
      setHasLoadedFromStorage(true);
    } catch (error) {
      console.warn('Failed to load sharing category from localStorage:', error);
      setHasLoadedFromStorage(true);
    }
  }, [animateCarousel]);

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
    animateCarousel(mode);
  }, [selectedMode, animateCarousel]);

  return {
    selectedMode,
    hasLoadedFromStorage,
    loadFromStorage,
    handleModeChange
  };
};

export const useEditProfileFields = ({ 
  profile,
  session,
  initialImages = { profileImage: '', backgroundImage: '' },
  onFieldsChange
}: UseEditProfileFieldsProps): UseEditProfileFieldsReturn => {
  
  // Track confirmed channels locally
  const [confirmedChannels, setConfirmedChannels] = useState<Set<string>>(new Set());
  const confirmedChannelsRef = useRef<Set<string>>(new Set());
  
  // Calculate initial fields from Firebase profile data
  const calculateInitialFields = useCallback((): ContactEntry[] => {
    return profile?.contactEntries || [
      { fieldType: 'name', value: session?.user?.name || '', section: 'universal', order: 0, isVisible: true, confirmed: false },
      { fieldType: 'bio', value: '', section: 'universal', order: 1, isVisible: true, confirmed: false },
      { fieldType: 'email', value: session?.user?.email || '', section: 'universal', order: 2, isVisible: true, confirmed: false },
      { fieldType: 'phone', value: '', section: 'universal', order: 3, isVisible: true, confirmed: false }
    ];
  }, [profile?.contactEntries, session?.user?.name, session?.user?.email]);
  
  // Helper function to ensure all fieldTypes exist in both Personal and Work sections
  const ensureAllFieldsExist = useCallback((baseFields: ContactEntry[]): ContactEntry[] => {
    const existingEntries = new Map<string, Set<string>>(); // fieldType -> Set of sections
    
    // Track what already exists
    baseFields.forEach(field => {
      if (!existingEntries.has(field.fieldType)) {
        existingEntries.set(field.fieldType, new Set());
      }
      existingEntries.get(field.fieldType)!.add(field.section);
    });
    
    
    const missingFields: ContactEntry[] = [];
    
    // For each social platform, ensure it exists in BOTH personal and work sections
    ALL_SUPPORTED_FIELD_TYPES.forEach(fieldType => {
      if (!['name', 'bio', 'phone', 'email'].includes(fieldType)) {
        const existingSections = existingEntries.get(fieldType) || new Set();
        
        // Ensure Personal section entry exists
        if (!existingSections.has('personal')) {
          missingFields.push({
            fieldType,
            value: '',
            section: 'personal',
            order: 1000 + missingFields.length,
            isVisible: false,
            confirmed: true  // Blank fields should be confirmed by default
          });
        }
        
        // Ensure Work section entry exists
        if (!existingSections.has('work')) {
          missingFields.push({
            fieldType,
            value: '',
            section: 'work',
            order: 1000 + missingFields.length,
            isVisible: false,
            confirmed: true  // Blank fields should be confirmed by default
          });
        }
      }
    });
    
    return [...baseFields, ...missingFields];
  }, []);
  
  // Unified state: ALL field data in one place (including hidden placeholders)
  const [fields, setFields] = useState<ContactEntry[]>(() => ensureAllFieldsExist(calculateInitialFields()));
  
  // Update fields when profile changes (e.g., after save)
  useEffect(() => {
    const newInitialFields = calculateInitialFields();
    if (newInitialFields && newInitialFields.length > 0) {
      const newFields = ensureAllFieldsExist(newInitialFields);
      
      // Preserve existing confirmations when profile updates
      const preservedFields = newFields.map(newField => {
        const existingField = fields.find(f => 
          f.fieldType === newField.fieldType && f.section === newField.section
        );
        
        // If we have an existing field with local confirmations, preserve them
        if (existingField) {
          const isLocallyConfirmed = confirmedChannelsRef.current.has(newField.fieldType);
          return {
            ...newField,
            confirmed: isLocallyConfirmed || newField.confirmed
          };
        }
        
        return newField;
      });
      
      setFields(preservedFields);
    }
  }, [profile, calculateInitialFields, ensureAllFieldsExist]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Image state (separate from text fields)
  const [images, setImages] = useState<{ profileImage: string; backgroundImage: string }>(initialImages);
  const imagesRef = useRef(images);
  
  // Keep ref updated
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  
  // Update fields and notify
  const updateFields = useCallback((newFields: ContactEntry[]) => {
    setFields(newFields);
    // Use ref to avoid dependency
    onFieldsChange?.(newFields, imagesRef.current);
  }, [onFieldsChange]);
  
  
  // Update images and notify
  const updateImages = useCallback((newImages: { profileImage: string; backgroundImage: string }) => {
    setImages(newImages);
    onFieldsChange?.(fields, newImages);
  }, [onFieldsChange, fields]);
  
  // Get field value by fieldType
  const getFieldValue = useCallback((fieldType: string): string => {
    const field = fields.find(f => f.fieldType === fieldType);
    return field?.value || '';
  }, [fields]);
  
  // Set field value by fieldType
  const setFieldValue = useCallback((fieldType: string, value: string) => {
    const updatedFields = fields.map(field => {
      if (field.fieldType === fieldType) {
        return {
          ...field,
          value: value
        };
      }
      return field;
    });
    updateFields(updatedFields);
  }, [fields, updateFields]);
  
  // Update field value and visibility (section-specific)
  const updateFieldValue = useCallback((fieldType: string, value: string, section: FieldSection) => {
    const updatedFields = fields.map(field => {
      if (field.fieldType === fieldType && field.section === section) {
        return {
          ...field,
          value: value,
          isVisible: field.isVisible // Keep current visibility state
        };
      }
      return field;
    });
    updateFields(updatedFields);
  }, [fields, updateFields]);
  
  // Get image value
  const getImageValue = useCallback((type: 'profileImage' | 'backgroundImage'): string => {
    return images[type];
  }, [images]);
  
  // Set image value
  const setImageValue = useCallback((type: 'profileImage' | 'backgroundImage', value: string) => {
    updateImages({ ...images, [type]: value });
  }, [images, updateImages]);
  
  // Keep ref in sync with state
  useEffect(() => {
    confirmedChannelsRef.current = confirmedChannels;
  }, [confirmedChannels]);

  // Mark a channel as confirmed
  const markChannelAsConfirmed = useCallback((fieldType: string) => {
    setConfirmedChannels(prev => {
      const newSet = new Set(prev).add(fieldType);
      confirmedChannelsRef.current = newSet;
      return newSet;
    });
    // Use setFields directly to avoid batching conflicts with updateFieldValue
    setFields(prevFields => prevFields.map(field => 
      field.fieldType === fieldType ? { ...field, confirmed: true } : field
    ));
  }, []);
  
  // Check if a channel is unconfirmed
  const isChannelUnconfirmed = useCallback((fieldType: string): boolean => {
    // If user has manually confirmed it this session, it's confirmed
    if (confirmedChannels.has(fieldType)) return false;
    
    // Find the field entry
    const field = fields.find(f => f.fieldType === fieldType);
    if (!field) return false;
    
    // Only show as unconfirmed if it has content but isn't confirmed
    return Boolean(field.value && field.value.trim() !== '') && !Boolean(field.confirmed);
  }, [confirmedChannels, fields]);
  
  // Field organization by section
  const fieldsBySection = useMemo(() => ({
    universal: fields.filter(f => f.section === 'universal'),
    personal: fields.filter(f => f.section === 'personal'),
    work: fields.filter(f => f.section === 'work')
  }), [fields]);
  
  // Check if sections are empty
  const isPersonalEmpty = fieldsBySection.personal.filter(f => f.isVisible && f.value && f.value.trim() !== '').length === 0;
  const isWorkEmpty = fieldsBySection.work.filter(f => f.isVisible && f.value && f.value.trim() !== '').length === 0;
  
  // Toggle field visibility (hide/show) - handles universal field splitting when hiding
  const toggleFieldVisibility = useCallback((fieldType: string, viewMode: 'Personal' | 'Work') => {
    const targetSection = viewMode.toLowerCase() as 'personal' | 'work';
    
    // Check if this is a universal field being hidden
    const universalField = fields.find(f => f.fieldType === fieldType && f.section === 'universal');
    
    if (universalField) {
      // Universal field being hidden: split into both sections as hidden
      const fieldsWithoutFieldType = fields.filter(f => f.fieldType !== fieldType);
      
      // Create Personal and Work entries as HIDDEN
      const personalEntry: ContactEntry = {
        fieldType: fieldType,
        value: universalField.value,
        confirmed: universalField.confirmed,
        section: 'personal',
        isVisible: false, // Hidden by default
        order: universalField.order // Preserve order
      };
      
      const workEntry: ContactEntry = {
        fieldType: fieldType,
        value: universalField.value,
        confirmed: universalField.confirmed,
        section: 'work',
        isVisible: false, // Hidden by default
        order: universalField.order // Preserve order
      };
      
      updateFields([...fieldsWithoutFieldType, personalEntry, workEntry]);
      return;
    }
    
    // Regular personal/work field visibility toggle (all fields now exist in array)
    const updatedFields = fields.map(field => {
      if (field.fieldType === fieldType && field.section === targetSection) {
        return {
          ...field,
          isVisible: !field.isVisible
        };
      }
      return field;
    });

    updateFields(updatedFields);
  }, [fields, updateFields]);
  
  // Split a universal field into separate Personal and Work entries
  const splitUniversalField = useCallback((fieldType: string, currentValue: string, targetSection: 'personal' | 'work', targetIndex: number) => {
    
    // Remove ALL entries for this fieldType (universal, personal, work) to avoid duplicates
    const fieldsWithoutFieldType = fields.filter(field => 
      field.fieldType !== fieldType
    );
    
    // Create new Personal and Work entries with the current value
    const personalEntry: ContactEntry = {
      fieldType: fieldType,
      value: currentValue,
      section: 'personal',
      isVisible: Boolean(currentValue), // Visible if has content
      order: 0, // Will be reassigned based on position
      confirmed: true
    };
    
    const workEntry: ContactEntry = {
      fieldType: fieldType,
      value: currentValue,
      section: 'work',
      isVisible: Boolean(currentValue), // Visible if has content
      order: 0, // Will be reassigned based on position
      confirmed: true
    };

    // Position-aware split: place target entry at specific position, other entry at top of its section
    const personalFields = fieldsWithoutFieldType.filter(f => f.section === 'personal');
    const workFields = fieldsWithoutFieldType.filter(f => f.section === 'work');
    const universalFields = fieldsWithoutFieldType.filter(f => f.section === 'universal');

    const newPersonalFields = [...personalFields];
    const newWorkFields = [...workFields];

    if (targetSection === 'personal') {
      // Insert personal entry at target position, work entry at top
      newPersonalFields.splice(targetIndex, 0, personalEntry);
      newWorkFields.unshift(workEntry);
    } else {
      // Insert work entry at target position, personal entry at top
      newWorkFields.splice(targetIndex, 0, workEntry);
      newPersonalFields.unshift(personalEntry);
    }

    const updatedFields = [...universalFields, ...newPersonalFields, ...newWorkFields];
    
    updateFields(updatedFields);
  }, [fields, updateFields]);
  
  // Consolidate personal/work entries into a single universal entry
  const consolidateToUniversal = useCallback((fieldType: string, currentValue: string, targetIndex: number) => {
    
    // Remove ALL entries for this fieldType (both personal, work, and any existing universal)
    // This includes empty placeholder entries that might exist
    const fieldsWithoutFieldType = fields.filter(f => f.fieldType !== fieldType);
    
    // Create single universal entry with the provided value
    const universalEntry: ContactEntry = {
      fieldType: fieldType,
      value: currentValue,
      confirmed: true,
      section: 'universal',
      isVisible: true, // Universal fields are always visible
      order: targetIndex
    };
    
    const updatedFields = [...fieldsWithoutFieldType, universalEntry];
    
    updateFields(updatedFields);
  }, [fields, updateFields]);
  
  // Reorder fields within the same section (for same-section drag and drop)
  const reorderFieldsInSection = useCallback((originalFieldType: string, targetFieldType: string, section: FieldSection) => {
    
    // Get all fields in the target section
    const sectionFields = fields.filter(f => f.section === section);
    const otherFields = fields.filter(f => f.section !== section);
    
    // Find the original and target fields
    const originalFieldIndex = sectionFields.findIndex(f => f.fieldType === originalFieldType);
    const targetFieldIndex = sectionFields.findIndex(f => f.fieldType === targetFieldType);
    
    if (originalFieldIndex === -1 || targetFieldIndex === -1) {
      console.warn('🚨 REORDER: Could not find fields to reorder', { originalFieldIndex, targetFieldIndex });
      return;
    }
    
    // Reorder the section fields by swapping
    const reorderedSectionFields = [...sectionFields];
    [reorderedSectionFields[originalFieldIndex], reorderedSectionFields[targetFieldIndex]] = 
      [reorderedSectionFields[targetFieldIndex], reorderedSectionFields[originalFieldIndex]];
    
    // Update order properties to reflect new positions
    const updatedSectionFields = reorderedSectionFields.map((field, index) => ({
      ...field,
      order: index
    }));
    
    // Combine with other sections
    const updatedFields = [...otherFields, ...updatedSectionFields];
    
    updateFields(updatedFields);
  }, [fields, updateFields]);
  
  // Get field data
  const getFieldData = useCallback((fieldType: string, section?: FieldSection) => {
    if (section) {
      return fields.find(field => field.fieldType === fieldType && field.section === section);
    }
    return fields.find(field => field.fieldType === fieldType);
  }, [fields]);

  // Check if field is hidden
  const isFieldHidden = useCallback((fieldType: string, viewMode: 'Personal' | 'Work') => {
    const targetSection = viewMode.toLowerCase() as 'personal' | 'work';
    const field = getFieldData(fieldType, targetSection);
    return !field?.isVisible;
  }, [getFieldData]);
  
  // Get fields organized for specific view mode (Personal or Work)
  const getFieldsForView = useCallback((viewMode: 'Personal' | 'Work') => {
    const currentSectionName = viewMode.toLowerCase() as 'personal' | 'work';
    
    
    // Helper function to sort fields by their order property (from Firebase data)
    const sortByOrder = (fieldList: ContactEntry[]) => {
      return fieldList.sort((a, b) => {
        // Use the order field from the data
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        return orderA - orderB;
      });
    };
    
    const result = {
      // Universal fields always show (sorted by order)
      universalFields: sortByOrder(
        fields.filter(field => field.section === 'universal')
      ),
      
      // Current section fields that are visible (sorted by order)
      currentFields: sortByOrder(
        fields.filter(field => 
          field.section === currentSectionName && field.isVisible
        )
      ),
      
      // Hidden fields = current section fields that are not visible AND don't exist in universal
      hiddenFields: sortByOrder(
        fields.filter(field => {
          if (field.section !== currentSectionName || field.isVisible) return false;
          
          // Don't show as hidden if this platform already exists in universal
          const existsInUniversal = fields.some(f => f.fieldType === field.fieldType && f.section === 'universal');
          return !existsInUniversal;
        })
      )
    };
    
    return result;
  }, [fields]);
  
  return {
    // Unified field access
    getFieldValue,
    setFieldValue,
    
    // Image access
    getImageValue,
    setImageValue,
    
    // Field organization
    universalFields: fieldsBySection.universal,
    personalFields: fieldsBySection.personal,
    workFields: fieldsBySection.work,
    
    // Field organization by view mode
    getFieldsForView,
    
    // Section state
    isPersonalEmpty,
    isWorkEmpty,
    
    // Field actions
    toggleFieldVisibility,
    updateFieldValue,
    splitUniversalField,
    consolidateToUniversal,
    reorderFieldsInSection,
    
    // Get field data
    getFieldData,
    isFieldHidden,
    
    // Confirmation handling
    markChannelAsConfirmed,
    isChannelUnconfirmed,
  };
};