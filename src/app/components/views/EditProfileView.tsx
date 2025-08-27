'use client';

import React, { useRef, useCallback, useMemo, useState } from 'react';
import { useProfile } from '../../context/ProfileContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import EditTitleBar from '../ui/EditTitleBar';
import FieldRenderer, { type FieldRendererHandle } from './FieldRenderer';
import { useEditProfileFields } from '@/lib/hooks/useEditProfileFields';
import { getOptimalProfileImageUrl } from '@/lib/utils/imageUtils';
import type { DragDropInfo } from '@/lib/hooks/useDragAndDrop';
import type { ContactEntry } from '@/types/profile';


interface EditProfileViewProps {
  onDragStateChange?: (isDragging: boolean) => void;
}

const EditProfileView: React.FC<EditProfileViewProps> = ({ onDragStateChange }) => {
  
  const { data: session } = useSession();
  const { profile, saveProfile, isSaving: isProfileSaving } = useProfile();
  const router = useRouter();
  const fieldRendererRef = useRef<FieldRendererHandle>(null);
  const [selectedMode, setSelectedMode] = useState<'Personal' | 'Work'>(() => {
    // Initialize from localStorage, fallback to 'Personal'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nekt-sharing-category');
      return (saved as 'Personal' | 'Work') || 'Personal';
    }
    return 'Personal';
  });
  
  // Initial images setup
  const initialImages = {
    profileImage: getOptimalProfileImageUrl(session?.user?.image || profile?.profileImage || '', 400),
    backgroundImage: profile?.backgroundImage || ''
  };
  
  // Unified field management hook - this is our single source of truth
  
  const fieldSectionManager = useEditProfileFields({
    profile,
    session,
    initialImages
  });
  
  
  // Create frozen field snapshot ONCE for drag operations - truly stable during drag
  const initialFields = useMemo(() => {
    // Get complete field list for all sections (universal + personal + work)
    const universalFields = fieldSectionManager.getFieldsBySection('universal');
    const personalFields = fieldSectionManager.getFieldsBySection('personal');
    const workFields = fieldSectionManager.getFieldsBySection('work');
    
    // Combine all fields in order - this is our frozen snapshot for drag operations
    const combined = [...universalFields, ...personalFields, ...workFields];
    
    return combined;
  }, [fieldSectionManager]);
  
  
  // Drag completion handler - receives final result without managing drag state
  const handleDragComplete = useCallback((dropInfo: DragDropInfo) => {
    console.log('📥 [handleDragComplete] Using final field order from ref');
    console.log('  - Final order:', dropInfo.fields.map(f => `${f.fieldType}-${f.section}`));
    console.log('  - Final dragged field:', `${dropInfo.draggedField.fieldType}-${dropInfo.draggedField.section}`);
    console.log('  - Original dragged field:', dropInfo.originalField ? `${dropInfo.originalField.fieldType}-${dropInfo.originalField.section}` : 'none');
    
    // Simple: just update FieldManager with the final field order
    // Pass both original and final field info for cross-section detection
    fieldSectionManager.updateFromDragDrop(dropInfo.fields, dropInfo.draggedField, dropInfo.originalField);
    
    console.log('✅ [handleDragComplete] FieldManager updated with new order');
  }, [fieldSectionManager]);
  
  // Mode change handler
  const handleModeChange = useCallback((mode: 'Personal' | 'Work') => {
    setSelectedMode(mode);
  }, []);

  // Handle save profile
  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await fieldRendererRef.current?.saveProfile();
      router.back();
    } catch (error) {
      console.error('Save failed:', error);
    }
  }, [router]);

  // Save request handler for FieldRenderer
  const handleSaveRequest = useCallback(async () => {
    // Get current fields from field manager, not from ref
    const currentFields = [
      ...fieldSectionManager.getFieldsBySection('universal'),
      ...fieldSectionManager.getFieldsBySection('personal').filter(f => f.isVisible || (f.value && f.value.trim() !== '')),
      ...fieldSectionManager.getFieldsBySection('work').filter(f => f.isVisible || (f.value && f.value.trim() !== ''))
    ];
    
    // Mark all fields with content as confirmed for Firebase save
    const confirmedFields = currentFields.map(field => {
      if (field.value && field.value.trim() !== '') {
        return { ...field, confirmed: true };
      }
      return field;
    });
    
    // Construct profile data for save with confirmed fields
    const profileData = {
      contactEntries: confirmedFields,
      profileImage: fieldSectionManager.getImageValue('profileImage') || '',
      backgroundImage: fieldSectionManager.getImageValue('backgroundImage') || ''
    };
    
    // Call the save function
    await saveProfile(profileData);
  }, [saveProfile, fieldSectionManager]);

  return (
    <div className="flex flex-col items-center px-4 py-2 pb-8 relative">
      <div className="w-full max-w-[var(--max-content-width,448px)] space-y-5">
        <EditTitleBar 
          onBack={() => router.back()}
          onSave={handleSave}
          isSaving={isProfileSaving}
        />

        {/* FieldRenderer handles field rendering and manages drag state internally */}
        <FieldRenderer
          ref={fieldRendererRef}
          session={session}
          fieldSectionManager={fieldSectionManager}
          initialFields={initialFields}
          selectedMode={selectedMode}
          onModeChange={handleModeChange}
          onSaveRequest={handleSaveRequest}
          onDragStateChange={onDragStateChange}
          onDragComplete={handleDragComplete}
        />
      </div>
    </div>
  );
};

export default EditProfileView;
