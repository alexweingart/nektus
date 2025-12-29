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
  initialImages?: { profileImage: string };
  onFieldsChange?: (fields: ContactEntry[], images: { profileImage: string }) => void;
}

export interface UseEditProfileFieldsReturn {
  // Unified field access
  getFieldValue: (fieldType: string) => string;
  setFieldValue: (fieldType: string, value: string) => void;

  // Image access
  getImageValue: (type: 'profileImage') => string;
  setImageValue: (type: 'profileImage', value: string) => void;

  // Field filtering functions
  getFieldsBySection: (section: FieldSection) => ContactEntry[];
  getVisibleFields: (section: FieldSection) => ContactEntry[];
  getAllFields: () => ContactEntry[]; // Get all fields without filtering

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
  updateFieldOrder: (section: FieldSection, newFieldOrder: ContactEntry[]) => void;

  // Get field data
  getFieldData: (fieldType: string, section?: FieldSection) => ContactEntry | undefined;
  isFieldHidden: (fieldType: string, viewMode: 'Personal' | 'Work') => boolean;

  // Confirmation handling
  markChannelAsConfirmed: (fieldType: string) => void;
  isChannelUnconfirmed: (fieldType: string) => boolean;
}

/**
 * Custom hook for handling profile image uploads
 */
export const useImageUpload = (onColorsExtracted?: (colors: string[]) => void) => {
  const handleImageUpload = useCallback(async (
    file: File,
    uploadType: 'profile',
    onSuccess: (imageData: string) => void
  ) => {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const imageData = e.target?.result as string;

      // Show immediate preview with base64 (temporary)
      onSuccess(imageData);

      // Call the profile image API endpoint and wait for permanent URL
      const endpoint = 'profile-image';
      try {
        const response = await fetch(`/api/profile/generate/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData }),
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const data = await response.json();

        // Update with permanent URL from Firebase Storage
        if (data.imageUrl) {
          onSuccess(data.imageUrl);
        } else {
          throw new Error('No image URL returned from server');
        }

        // If colors were extracted, update the local state immediately
        if (data.backgroundColors && onColorsExtracted) {
          console.log('[useImageUpload] Background colors extracted:', data.backgroundColors);
          onColorsExtracted(data.backgroundColors);
        }
      } catch (error) {
        console.error(`Error uploading ${uploadType} image:`, error);
        alert(`Failed to upload ${uploadType} image. Please try again.`);
        // Revert to empty on error
        onSuccess('');
      }
    };
    reader.readAsDataURL(file);
  }, [onColorsExtracted]);

  const createUploadHandler = useCallback((
    uploadType: 'profile',
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
export const useProfileViewMode = (carouselRef: React.RefObject<HTMLDivElement | null>) => {
  const [selectedMode, setSelectedMode] = useState<'Personal' | 'Work'>('Personal');

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
    } catch (error) {
      console.warn('Failed to load sharing category from localStorage:', error);
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
    loadFromStorage,
    handleModeChange
  };
};

export const useEditProfileFields = ({
  profile,
  session,
  initialImages = { profileImage: '' },
  onFieldsChange
}: UseEditProfileFieldsProps): UseEditProfileFieldsReturn => {

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

    return firebaseData || defaultData;
  }, [profile?.contactEntries, session?.user?.name, session?.user?.email]);

  // Unified state: ALL field data in one place
  const [fields, setFields] = useState<ContactEntry[]>(() => calculateInitialFields());
  
  // Update fields when profile changes (e.g., after save)
  useEffect(() => {
    // Only process when profile actually changes (not on every render)
    if (!profile?.contactEntries) return;

    const newInitialFields = calculateInitialFields();
    if (newInitialFields && newInitialFields.length > 0) {
      setFields(newInitialFields);
    }
  }, [profile?.contactEntries, calculateInitialFields]);

  // Image state (separate from text fields)
  const [images, setImages] = useState<{ profileImage: string }>(initialImages);
  const imagesRef = useRef(images);
  const fieldsRef = useRef(fields);

  // Keep refs updated
  useEffect(() => {
    imagesRef.current = images;
    fieldsRef.current = fields;
  }, [images, fields]);
  
  // Update fields and notify
  const updateFields = useCallback((newFields: ContactEntry[]) => {
    setFields(newFields);
    // Use ref to avoid dependency
    onFieldsChange?.(newFields, imagesRef.current);
  }, [onFieldsChange]);


  // Update images and notify
  const updateImages = useCallback((newImages: { profileImage: string }) => {
    setImages(newImages);
    // Use ref to avoid dependency on fields
    onFieldsChange?.(fieldsRef.current, newImages);
  }, [onFieldsChange]);
  
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

  // Add new fields (or update existing ones if they already exist)
  const addFields = useCallback((newFields: ContactEntry[]) => {
    // Instead of just appending, check if field already exists and update it
    const updatedFields = [...fields];

    newFields.forEach(newField => {
      const existingIndex = updatedFields.findIndex(f =>
        f.fieldType === newField.fieldType &&
        f.section === newField.section
      );

      if (existingIndex !== -1) {
        // Replace existing field with new one
        updatedFields[existingIndex] = newField;
      } else {
        // Add new field
        updatedFields.push(newField);
      }
    });

    updateFields(updatedFields);
  }, [fields, updateFields]);
  
  // Get image value
  const getImageValue = useCallback((type: 'profileImage'): string => {
    return images[type];
  }, [images]);

  // Set image value
  const setImageValue = useCallback((type: 'profileImage', value: string) => {
    updateImages({ ...images, [type]: value });
  }, [images, updateImages]);
  
  // Mark a channel as confirmed
  const markChannelAsConfirmed = useCallback((fieldType: string) => {
    // Use setFields directly to avoid batching conflicts with updateFieldValue
    setFields(prevFields => prevFields.map(field =>
      field.fieldType === fieldType ? { ...field, confirmed: true } : field
    ));
  }, []);
  
  // Check if a channel is unconfirmed
  const isChannelUnconfirmed = useCallback((fieldType: string): boolean => {
    // Find the field entry
    const field = fields.find(f => f.fieldType === fieldType);
    if (!field) return false;

    // Only show as unconfirmed if it has content but isn't confirmed
    return Boolean(field.value && field.value.trim() !== '') && !Boolean(field.confirmed);
  }, [fields]);
  
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
    return sectionFields.filter(f => f.isVisible);
  }, [getFieldsBySection]);
  
  // Check if sections are empty
  const isPersonalEmpty = getVisibleFields('personal').filter(f => f.value && f.value.trim() !== '').length === 0;
  const isWorkEmpty = getVisibleFields('work').filter(f => f.value && f.value.trim() !== '').length === 0;
  
  // Toggle field visibility (hide/show) for personal/work fields
  const toggleFieldVisibility = useCallback((fieldType: string, viewMode: 'Personal' | 'Work') => {
    const targetSection = viewMode.toLowerCase() as 'personal' | 'work';

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

  // Update field order for a specific section (for drag & drop)
  const updateFieldOrder = useCallback((section: FieldSection, newFieldOrder: ContactEntry[]) => {
    // Get all fields from OTHER sections (keep them unchanged)
    const otherSectionFields = fields.filter(f => f.section !== section);

    // Get hidden fields from this section (not in newFieldOrder)
    const hiddenFieldsInSection = fields.filter(f =>
      f.section === section &&
      !newFieldOrder.some(nf => nf.fieldType === f.fieldType && nf.section === f.section)
    );

    // Update order values for the reordered section (visible fields)
    const reorderedFields = newFieldOrder.map((field, index) => ({
      ...field,
      order: index
    }));

    // Add hidden fields at the end with higher order values
    const hiddenFieldsWithOrder = hiddenFieldsInSection.map((field, index) => ({
      ...field,
      order: newFieldOrder.length + index
    }));

    // Combine: other sections + newly ordered visible fields + hidden fields
    const updatedFields = [...otherSectionFields, ...reorderedFields, ...hiddenFieldsWithOrder];

    updateFields(updatedFields);
  }, [fields, updateFields]);

  // Get visible fields for view (universal + current section visible) - used for drag operations
  const getVisibleFieldsForView = useCallback((viewMode: 'Personal' | 'Work'): ContactEntry[] => {
    const currentSectionName = viewMode.toLowerCase() as 'personal' | 'work';

    const universalFields = getFieldsBySection('universal');
    const currentSectionFields = getVisibleFields(currentSectionName);

    return [...universalFields, ...currentSectionFields].sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      return orderA - orderB;
    });
  }, [getFieldsBySection, getVisibleFields]);
  
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

    return hiddenFields.sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      return orderA - orderB;
    });
  }, [getFieldsBySection]);

  // Get all fields without any filtering - for save operations
  const getAllFields = useCallback((): ContactEntry[] => {
    return [...fields];
  }, [fields]);

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
    getAllFields,

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
    updateFieldOrder,

    // Get field data
    getFieldData,
    isFieldHidden,
    
    // Confirmation handling
    markChannelAsConfirmed,
    isChannelUnconfirmed,
  };
};