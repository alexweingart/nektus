import { useState, useCallback, useRef, useEffect } from 'react';
import type { ContactEntry, FieldSection, UserProfile } from '@nektus/shared-types';

/**
 * Unified field management hook for iOS - stores ALL field data (text + images) in one place
 */
interface UseEditProfileFieldsProps {
  profile?: UserProfile | null;
  session?: { user?: { name?: string | null; email?: string | null; id?: string } } | null;
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
  getAllFields: () => ContactEntry[];

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
  updateFieldOrder: (section: 'personal' | 'work', newOrder: ContactEntry[]) => void;

  // Get field data
  getFieldData: (fieldType: string, section?: FieldSection) => ContactEntry | undefined;
  isFieldHidden: (fieldType: string, viewMode: 'Personal' | 'Work') => boolean;

}

export const useEditProfileFields = ({
  profile,
  session,
  initialImages = { profileImage: '' },
  onFieldsChange
}: UseEditProfileFieldsProps): UseEditProfileFieldsReturn => {

  // Calculate initial fields from Firebase profile data
  const calculateInitialFields = useCallback((): ContactEntry[] => {
    const firebaseData = profile?.contactEntries;
    const defaultData: ContactEntry[] = [
      { fieldType: 'name', value: session?.user?.name || '', section: 'universal' as FieldSection, order: 0, isVisible: true, confirmed: true },
      { fieldType: 'bio', value: '', section: 'universal' as FieldSection, order: 1, isVisible: true, confirmed: true },
      { fieldType: 'phone', value: '', section: 'personal' as FieldSection, order: 0, isVisible: true, confirmed: true },
      { fieldType: 'email', value: session?.user?.email || '', section: 'personal' as FieldSection, order: 1, isVisible: true, confirmed: true },
      { fieldType: 'phone', value: '', section: 'work' as FieldSection, order: 0, isVisible: true, confirmed: true },
      { fieldType: 'email', value: session?.user?.email || '', section: 'work' as FieldSection, order: 1, isVisible: true, confirmed: true }
    ];

    return firebaseData || defaultData;
  }, [profile?.contactEntries, session?.user?.name, session?.user?.email]);

  // Unified state: ALL field data in one place
  const [fields, setFields] = useState<ContactEntry[]>(() => calculateInitialFields());

  // Update fields when profile changes
  useEffect(() => {
    if (!profile?.contactEntries) return;

    const newInitialFields = calculateInitialFields();
    if (newInitialFields && newInitialFields.length > 0) {
      setFields(newInitialFields);
    }
  }, [profile?.contactEntries, calculateInitialFields]);

  // Image state
  const [images, setImages] = useState<{ profileImage: string }>(initialImages);
  const imagesRef = useRef(images);
  const fieldsRef = useRef(fields);

  // Sync profile image when profile changes (handles async profile loading)
  // Only sync if: profile has an image AND (we have no image OR our image is a remote URL that differs)
  // Don't overwrite local file:// previews (user just picked an image)
  useEffect(() => {
    if (profile?.profileImage) {
      const currentImage = images.profileImage;
      const isLocalPreview = currentImage?.startsWith('file://');
      const shouldSync = !currentImage || (!isLocalPreview && currentImage !== profile.profileImage);
      if (shouldSync) {
        setImages({ profileImage: profile.profileImage });
      }
    }
  }, [profile?.profileImage, images.profileImage]);

  // Keep refs updated
  useEffect(() => {
    imagesRef.current = images;
    fieldsRef.current = fields;
  }, [images, fields]);

  // Update fields and notify
  const updateFields = useCallback((newFields: ContactEntry[]) => {
    setFields(newFields);
    onFieldsChange?.(newFields, imagesRef.current);
  }, [onFieldsChange]);

  // Update images and notify
  const updateImages = useCallback((newImages: { profileImage: string }) => {
    setImages(newImages);
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
        return { ...field, value };
      }
      return field;
    });
    updateFields(updatedFields);
  }, [fields, updateFields]);

  // Update field value (section-specific)
  const updateFieldValue = useCallback((fieldType: string, value: string, section: FieldSection) => {
    const updatedFields = fields.map(field => {
      if (field.fieldType === fieldType && field.section === section) {
        return { ...field, value, isVisible: field.isVisible };
      }
      return field;
    });
    updateFields(updatedFields);
  }, [fields, updateFields]);

  // Add new fields
  const addFields = useCallback((newFields: ContactEntry[]) => {
    const updatedFields = [...fields];

    newFields.forEach(newField => {
      const existingIndex = updatedFields.findIndex(f =>
        f.fieldType === newField.fieldType && f.section === newField.section
      );

      if (existingIndex !== -1) {
        updatedFields[existingIndex] = newField;
      } else {
        updatedFields.push(newField);
      }
    });

    updateFields(updatedFields);
  }, [fields, updateFields]);

  // Update field order (for drag-and-drop reordering)
  const updateFieldOrder = useCallback((section: 'personal' | 'work', newOrder: ContactEntry[]) => {
    // Update order numbers based on new position
    const reorderedFields = newOrder.map((field, index) => ({
      ...field,
      order: index,
    }));

    // Replace section fields with reordered ones
    const otherFields = fields.filter(f => f.section !== section);
    updateFields([...otherFields, ...reorderedFields]);
  }, [fields, updateFields]);

  // Get image value
  const getImageValue = useCallback((type: 'profileImage'): string => {
    return images[type];
  }, [images]);

  // Set image value
  const setImageValue = useCallback((type: 'profileImage', value: string) => {
    updateImages({ ...images, [type]: value });
  }, [images, updateImages]);

  // Field filtering functions
  const getFieldsBySection = useCallback((section: FieldSection): ContactEntry[] => {
    const sectionFields = fields.filter(f => f.section === section);
    return sectionFields.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [fields]);

  const getVisibleFields = useCallback((section: FieldSection): ContactEntry[] => {
    return getFieldsBySection(section).filter(f => f.isVisible);
  }, [getFieldsBySection]);

  // Check if sections are empty
  const isPersonalEmpty = getVisibleFields('personal').filter(f => f.value && f.value.trim() !== '').length === 0;
  const isWorkEmpty = getVisibleFields('work').filter(f => f.value && f.value.trim() !== '').length === 0;

  // Toggle field visibility
  const toggleFieldVisibility = useCallback((fieldType: string, viewMode: 'Personal' | 'Work') => {
    const targetSection = viewMode.toLowerCase() as 'personal' | 'work';

    const updatedFields = fields.map(field => {
      if (field.fieldType === fieldType && field.section === targetSection) {
        return { ...field, isVisible: !field.isVisible };
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

  // Get visible fields for view
  const getVisibleFieldsForView = useCallback((viewMode: 'Personal' | 'Work'): ContactEntry[] => {
    const currentSectionName = viewMode.toLowerCase() as 'personal' | 'work';
    const universalFields = getFieldsBySection('universal');
    const currentSectionFields = getVisibleFields(currentSectionName);

    return [...universalFields, ...currentSectionFields].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [getFieldsBySection, getVisibleFields]);

  // Get hidden fields for view
  const getHiddenFieldsForView = useCallback((viewMode: 'Personal' | 'Work'): ContactEntry[] => {
    const currentSectionName = viewMode.toLowerCase() as 'personal' | 'work';

    const hiddenFields = getFieldsBySection(currentSectionName).filter(field => {
      if (field.isVisible) return false;
      if (!field.value || field.value.trim() === '') return false;
      const existsInUniversal = getFieldsBySection('universal').some(f => f.fieldType === field.fieldType);
      return !existsInUniversal;
    });

    return hiddenFields.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [getFieldsBySection]);

  // Get all fields
  const getAllFields = useCallback((): ContactEntry[] => {
    return [...fields];
  }, [fields]);

  return {
    getFieldValue,
    setFieldValue,
    getImageValue,
    setImageValue,
    getFieldsBySection,
    getVisibleFields,
    getAllFields,
    getVisibleFieldsForView,
    getHiddenFieldsForView,
    isPersonalEmpty,
    isWorkEmpty,
    toggleFieldVisibility,
    updateFieldValue,
    addFields,
    updateFieldOrder,
    getFieldData,
    isFieldHidden,
  };
};

