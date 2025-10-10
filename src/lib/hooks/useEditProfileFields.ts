'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Session } from 'next-auth';
import type { ContactEntry, FieldSection, UserProfile } from '@/types/profile';


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
  
  // Field filtering functions
  getFieldsBySection: (section: FieldSection) => ContactEntry[];
  getVisibleFields: (section: FieldSection) => ContactEntry[];
  
  // Simplified field view functions
  getVisibleFieldsForView: (viewMode: 'Personal' | 'Work') => ContactEntry[];
  getHiddenFieldsForView: (viewMode: 'Personal' | 'Work') => ContactEntry[];
  
  // Section state
  isPersonalEmpty: boolean;
  isWorkEmpty: boolean;
  
  // Field actions
  toggleFieldVisibility: (fieldType: string, viewMode: 'Personal' | 'Work') => void;
  updateFieldValue: (fieldType: string, value: string, section: FieldSection) => void;
  addFields: (newFields: ContactEntry[]) => void;
  splitUniversalField: (fieldType: string, currentValue: string, targetSection: 'personal' | 'work', targetIndex: number) => void;
  consolidateToUniversal: (fieldType: string, currentValue: string, targetIndex: number) => void;
  
  // Get field data
  getFieldData: (fieldType: string, section?: FieldSection) => ContactEntry | undefined;
  isFieldHidden: (fieldType: string, viewMode: 'Personal' | 'Work') => boolean;
  
  // Confirmation handling
  markChannelAsConfirmed: (fieldType: string) => void;
  isChannelUnconfirmed: (fieldType: string) => boolean;

  // Drag and drop support
  updateFromDragDrop: (newFields: ContactEntry[], finalDraggedField?: ContactEntry, originalDraggedField?: ContactEntry) => void;
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
    const firebaseData = profile?.contactEntries;
    // Updated per spec: Only name and bio in universal, phone and email in personal + work
    const defaultData: ContactEntry[] = [
      { fieldType: 'name', value: session?.user?.name || '', section: 'universal' as FieldSection, order: 0, isVisible: true, confirmed: false },
      { fieldType: 'bio', value: '', section: 'universal' as FieldSection, order: 1, isVisible: true, confirmed: false },
      { fieldType: 'phone', value: '', section: 'personal' as FieldSection, order: 0, isVisible: true, confirmed: false },
      { fieldType: 'email', value: session?.user?.email || '', section: 'personal' as FieldSection, order: 1, isVisible: true, confirmed: false },
      { fieldType: 'phone', value: '', section: 'work' as FieldSection, order: 0, isVisible: true, confirmed: false },
      { fieldType: 'email', value: session?.user?.email || '', section: 'work' as FieldSection, order: 1, isVisible: true, confirmed: false }
    ];

    const result = firebaseData || defaultData;


    return result;
  }, [profile?.contactEntries, session?.user?.name, session?.user?.email]);
  
  // Helper function to ensure proper field structure (recreate hidden placeholders)
  // Ensures each fieldType has EITHER 1 instance in universal OR instances in both personal and work
  const ensureProperFieldStructure = useCallback((baseFields: ContactEntry[]): ContactEntry[] => {
    // Extract phone/email values from universal section before filtering (for migration)
    const universalPhoneValue = baseFields.find(f => f.fieldType === 'phone' && f.section === 'universal')?.value || '';
    const universalEmailValue = baseFields.find(f => f.fieldType === 'email' && f.section === 'universal')?.value || '';

    // Remove phone/email from universal section (per spec - only name and bio in universal)
    const filteredFields = baseFields.filter(field =>
      !(field.section === 'universal' && (field.fieldType === 'phone' || field.fieldType === 'email'))
    );

    const existingByType = new Map<string, Map<string, ContactEntry>>(); // fieldType -> section -> entry

    // Track what already exists (after filtering)
    filteredFields.forEach(field => {
      if (!existingByType.has(field.fieldType)) {
        existingByType.set(field.fieldType, new Map());
      }
      existingByType.get(field.fieldType)!.set(field.section, field);
    });

    const missingFields: ContactEntry[] = [];

    // Phone and email MUST exist in both personal and work (per spec)
    const requiredContactFields = ['phone', 'email'];
    requiredContactFields.forEach(fieldType => {
      const existingSections = existingByType.get(fieldType) || new Map();
      const hasPersonal = existingSections.has('personal');
      const hasWork = existingSections.has('work');

      // Use migrated value from universal if it exists
      const migratedValue = fieldType === 'phone' ? universalPhoneValue : universalEmailValue;

      if (!hasPersonal) {
        missingFields.push({
          fieldType,
          value: migratedValue,
          section: 'personal' as FieldSection,
          order: fieldType === 'phone' ? 0 : 1,
          isVisible: true,
          confirmed: !!migratedValue // Mark as confirmed if we migrated a value
        });
      }
      if (!hasWork) {
        missingFields.push({
          fieldType,
          value: migratedValue,
          section: 'work' as FieldSection,
          order: fieldType === 'phone' ? 0 : 1,
          isVisible: true,
          confirmed: !!migratedValue // Mark as confirmed if we migrated a value
        });
      }
    });

    const allSocialFieldTypes = [
      'facebook', 'instagram', 'x', 'linkedin', 'snapchat',
      'whatsapp', 'telegram', 'wechat'
    ];

    // For each social platform, ensure proper structure
    allSocialFieldTypes.forEach(fieldType => {
      const existingSections = existingByType.get(fieldType) || new Map();
      
      // Rule: fieldType should have EITHER 1 in universal OR both personal and work
      const hasUniversal = existingSections.has('universal');
      const hasPersonal = existingSections.has('personal');
      const hasWork = existingSections.has('work');
      
      // If it exists in universal, don't create personal/work placeholders
      if (hasUniversal) {
        return; // This field is properly structured
      }
      
      // If it exists in personal OR work, ensure it exists in BOTH
      if (hasPersonal || hasWork) {
        if (!hasPersonal) {
          missingFields.push({
            fieldType,
            value: '',
            section: 'personal' as FieldSection,
            order: 1000 + missingFields.length,
            isVisible: false,
            confirmed: true // User-initiated structure
          });
        }
        if (!hasWork) {
          missingFields.push({
            fieldType,
            value: '',
            section: 'work' as FieldSection,
            order: 1000 + missingFields.length,
            isVisible: false,
            confirmed: true // User-initiated structure
          });
        }
      } else {
        // Doesn't exist anywhere - create placeholders in both personal and work
        missingFields.push({
          fieldType,
          value: '',
          section: 'personal' as FieldSection,
          order: 1000 + missingFields.length,
          isVisible: false,
          confirmed: true // User-initiated structure
        });
        missingFields.push({
          fieldType,
          value: '',
          section: 'work' as FieldSection,
          order: 1000 + missingFields.length + 1,
          isVisible: false,
          confirmed: true // User-initiated structure
        });
      }
    });

    return [...filteredFields, ...missingFields];
  }, []);
  
  // Unified state: ALL field data in one place (including hidden placeholders)
  const [fields, setFields] = useState<ContactEntry[]>(() => ensureProperFieldStructure(calculateInitialFields()));
  
  // Update fields when profile changes (e.g., after save)
  useEffect(() => {
    // Only process when profile actually changes (not on every render)
    if (!profile?.contactEntries) return;
    
    const newInitialFields = calculateInitialFields();
    if (newInitialFields && newInitialFields.length > 0) {
      // Apply smart field structure logic to recreate hidden placeholders
      // but respect the drag-and-drop changes from Firebase
      const newFields = ensureProperFieldStructure(newInitialFields);
      setFields(newFields);
    }
  }, [profile?.contactEntries, calculateInitialFields, ensureProperFieldStructure]);
  
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
    console.log('[updateFieldValue]', { fieldType, section, newValue: value, isEmpty: !value || value.trim() === '' });
    const updatedFields = fields.map(field => {
      if (field.fieldType === fieldType && field.section === section) {
        console.log('[updateFieldValue] Updating field', {
          fieldType,
          section,
          oldValue: field.value,
          newValue: value,
          wasVisible: field.isVisible,
          staysVisible: field.isVisible
        });
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

  // Add new fields (or update existing ones if they already exist)
  const addFields = useCallback((newFields: ContactEntry[]) => {
    console.log('[useEditProfileFields] Adding fields:', newFields);

    // Instead of just appending, check if field already exists and update it
    let updatedFields = [...fields];

    newFields.forEach(newField => {
      const existingIndex = updatedFields.findIndex(f =>
        f.fieldType === newField.fieldType &&
        f.section === newField.section
      );

      if (existingIndex !== -1) {
        console.log('[useEditProfileFields] Field already exists, updating:', {
          fieldType: newField.fieldType,
          section: newField.section,
          oldValue: updatedFields[existingIndex].value,
          newValue: newField.value
        });
        // Replace existing field with new one
        updatedFields[existingIndex] = newField;
      } else {
        console.log('[useEditProfileFields] Adding new field:', {
          fieldType: newField.fieldType,
          section: newField.section,
          value: newField.value
        });
        // Add new field
        updatedFields.push(newField);
      }
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
  
  // Field filtering functions
  const getFieldsBySection = useCallback((section: FieldSection): ContactEntry[] => {
    const sectionFields = fields.filter(f => f.section === section);
    
    // Sort by order property
    const sorted = sectionFields.sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      return orderA - orderB;
    });
    
    return sorted;
  }, [fields]);
  
  const getVisibleFields = useCallback((section: FieldSection): ContactEntry[] => {
    const sectionFields = getFieldsBySection(section);
    const visible = sectionFields.filter(f => f.isVisible);

    // Check for duplicates
    const fieldTypeCounts: Record<string, ContactEntry[]> = {};
    sectionFields.forEach(f => {
      const key = f.fieldType;
      if (!fieldTypeCounts[key]) fieldTypeCounts[key] = [];
      fieldTypeCounts[key].push(f);
    });

    Object.entries(fieldTypeCounts).forEach(([fieldType, entries]) => {
      if (entries.length > 1) {
        console.error(`[getVisibleFields] DUPLICATE DETECTED: ${entries.length}x ${fieldType} in ${section}`, entries.map(e => ({
          value: e.value || 'EMPTY',
          isVisible: e.isVisible,
          order: e.order
        })));
      }
    });

    console.log(`[getVisibleFields] section=${section}, total=${sectionFields.length}, visible=${visible.length}`, visible.map(f => `${f.fieldType}:${f.value ? 'hasValue' : 'empty'}`));
    return visible;
  }, [getFieldsBySection]);
  
  // Check if sections are empty
  const isPersonalEmpty = getVisibleFields('personal').filter(f => f.value && f.value.trim() !== '').length === 0;
  const isWorkEmpty = getVisibleFields('work').filter(f => f.value && f.value.trim() !== '').length === 0;
  
  // Toggle field visibility (hide/show) - handles universal field splitting when hiding
  const toggleFieldVisibility = useCallback((fieldType: string, viewMode: 'Personal' | 'Work') => {
    const targetSection = viewMode.toLowerCase() as 'personal' | 'work';

    console.log('[toggleFieldVisibility] CALLED', { fieldType, viewMode, targetSection });
    console.log('[toggleFieldVisibility] Current fields:', fields.map(f => `${f.fieldType}-${f.section}:visible=${f.isVisible},value=${f.value || 'empty'}`));

    // Check if this is a universal field being hidden
    const universalField = fields.find(f => f.fieldType === fieldType && f.section === 'universal');

    if (universalField) {
      console.log('[toggleFieldVisibility] Found universal field, splitting into hidden personal/work');
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

    // Find the field being toggled
    const targetField = fields.find(f => f.fieldType === fieldType && f.section === targetSection);
    console.log('[toggleFieldVisibility] Toggling field', {
      fieldType,
      section: targetSection,
      currentlyVisible: targetField?.isVisible,
      hasValue: !!targetField?.value,
      actualValue: targetField?.value
    });

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

    console.log('[toggleFieldVisibility] Updated fields:', updatedFields.map(f => `${f.fieldType}-${f.section}:visible=${f.isVisible},value=${f.value || 'empty'}`));
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
      isVisible: true, // Always visible when split from universal
      order: 0, // Will be reassigned based on position
      confirmed: true
    };
    
    const workEntry: ContactEntry = {
      fieldType: fieldType,
      value: currentValue,
      section: 'work',
      isVisible: true, // Always visible when split from universal
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
    
    // IMPORTANT: Assign proper order values based on final array positions
    const orderedFields = updatedFields.map((field, index) => ({
      ...field,
      order: index
    }));
    
    
    updateFields(orderedFields);
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
  
  // Drag and drop support - apply final field order and handle cross-section business logic
  const updateFromDragDrop = useCallback((newFields: ContactEntry[], finalDraggedField?: ContactEntry, originalDraggedField?: ContactEntry) => {

    // Handle cross-section business logic if needed
    if (finalDraggedField && originalDraggedField && finalDraggedField.section !== originalDraggedField.section) {

      // Special handling for universal → personal/work: use splitUniversalField
      if (originalDraggedField.section === 'universal' && (finalDraggedField.section === 'personal' || finalDraggedField.section === 'work')) {

        // Find where the field was dropped in the global array
        const globalIndex = newFields.findIndex(f => f.fieldType === finalDraggedField.fieldType && f.section === finalDraggedField.section);

        // Calculate section-specific index by counting how many fields of the target section come before this position
        const targetSectionFieldsBefore = globalIndex >= 0
          ? newFields.slice(0, globalIndex).filter(f => f.section === finalDraggedField.section).length
          : 0;


        splitUniversalField(
          finalDraggedField.fieldType,
          finalDraggedField.value,
          finalDraggedField.section as 'personal' | 'work',
          targetSectionFieldsBefore
        );
        return; // splitUniversalField handles the full update
      }
      
      // Other cross-section moves (personal ↔ work, personal/work → universal)

      // Find the position where the field was dropped in the newFields array
      const dropPosition = newFields.findIndex(f =>
        f.fieldType === finalDraggedField.fieldType && f.section === finalDraggedField.section
      );


      // Remove all existing entries for this field type to avoid duplicates
      const fieldsWithoutFieldType = newFields.filter(f => f.fieldType !== finalDraggedField.fieldType);


      // Insert the dragged field at the correct position
      let finalFieldsWithCorrectSection: ContactEntry[];
      if (dropPosition >= 0 && dropPosition <= fieldsWithoutFieldType.length) {
        // Insert at the specific position
        finalFieldsWithCorrectSection = [
          ...fieldsWithoutFieldType.slice(0, dropPosition),
          finalDraggedField,
          ...fieldsWithoutFieldType.slice(dropPosition)
        ];
      } else {
        // Fallback: append to end if position is invalid
        finalFieldsWithCorrectSection = [...fieldsWithoutFieldType, finalDraggedField];
      }
      
      // Apply final field order with correct order properties
      const orderedFields = finalFieldsWithCorrectSection.map((field, index) => ({
        ...field,
        order: index
      }));
      
      updateFields(orderedFields);
    } else {
      // Same-section drag - just apply the final field order with correct order properties

      const orderedFields = newFields.map((field, index) => ({
        ...field,
        order: index
      }));

      updateFields(orderedFields);
    }

  }, [updateFields, splitUniversalField]);
  
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
  
  // Helper function to sort fields by their order property (from Firebase data)
  const sortByOrder = useCallback((fieldList: ContactEntry[]) => {
    return fieldList.sort((a, b) => {
      // Use the order field from the data
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      return orderA - orderB;
    });
  }, []);
  
  // Get visible fields for view (universal + current section visible) - used for drag operations
  const getVisibleFieldsForView = useCallback((viewMode: 'Personal' | 'Work'): ContactEntry[] => {
    const currentSectionName = viewMode.toLowerCase() as 'personal' | 'work';
    
    const universalFields = getFieldsBySection('universal');
    const currentSectionFields = getVisibleFields(currentSectionName);
    
    return sortByOrder([...universalFields, ...currentSectionFields]);
  }, [getFieldsBySection, getVisibleFields, sortByOrder]);
  
  // Get hidden fields for view (current section hidden, excluding fields that exist in universal)
  // Phase 5: Also filter out blank fields
  const getHiddenFieldsForView = useCallback((viewMode: 'Personal' | 'Work'): ContactEntry[] => {
    const currentSectionName = viewMode.toLowerCase() as 'personal' | 'work';

    const hiddenFields = getFieldsBySection(currentSectionName).filter(field => {
      if (field.isVisible) return false;

      // Phase 5: Filter out blank fields (no value or only whitespace)
      if (!field.value || field.value.trim() === '') return false;

      // Don't show as hidden if this platform already exists in universal
      const existsInUniversal = getFieldsBySection('universal').some(f => f.fieldType === field.fieldType);
      return !existsInUniversal;
    });

    return sortByOrder(hiddenFields);
  }, [getFieldsBySection, sortByOrder]);
  
  return {
    // Unified field access
    getFieldValue,
    setFieldValue,
    
    // Image access
    getImageValue,
    setImageValue,
    
    // Field filtering functions
    getFieldsBySection,
    getVisibleFields,
    
    // Simplified field view functions
    getVisibleFieldsForView,
    getHiddenFieldsForView,
    
    // Section state
    isPersonalEmpty,
    isWorkEmpty,
    
    // Field actions
    toggleFieldVisibility,
    updateFieldValue,
    addFields,
    splitUniversalField,
    consolidateToUniversal,
    
    // Get field data
    getFieldData,
    isFieldHidden,
    
    // Confirmation handling
    markChannelAsConfirmed,
    isChannelUnconfirmed,

    // Drag and drop support
    updateFromDragDrop,
  };
};