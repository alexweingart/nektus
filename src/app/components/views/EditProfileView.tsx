'use client';

import React, { useRef, useCallback } from 'react';
import { useProfile } from '../../context/ProfileContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import EditTitleBar from '../ui/EditTitleBar';
import FieldRenderer, { type FieldRendererHandle } from './FieldRenderer';


interface EditProfileViewProps {
  onDragStateChange?: (isDragging: boolean) => void;
}

const EditProfileView: React.FC<EditProfileViewProps> = ({ onDragStateChange }) => {
  const { data: session } = useSession();
  const { profile, saveProfile, isSaving: isProfileSaving } = useProfile();
  const router = useRouter();
  const fieldRendererRef = useRef<FieldRendererHandle>(null);

  // Handle save profile
  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await fieldRendererRef.current?.saveProfile();
      router.back();
    } catch (error) {
      console.error('[EditProfileView] Save failed:', error);
    }
  }, [router]);

  // Save request handler for FieldRenderer
  const handleSaveRequest = useCallback(async () => {
    // Get current fields at call time, not at creation time
    const currentFields = fieldRendererRef.current?.getAllFields() || [];
    
    // Construct profile data for save
    const profileData = {
      contactEntries: currentFields,
      profileImage: profile?.profileImage || '',
      backgroundImage: profile?.backgroundImage || ''
    };
    
    // Call the save function
    await saveProfile(profileData);
  }, [saveProfile, profile]);

  return (
    <div className="flex flex-col items-center px-4 py-4 pb-8 relative space-y-5">
      <div className="w-full max-w-[var(--max-content-width,448px)]">
        <EditTitleBar 
          onBack={() => router.back()}
          onSave={handleSave}
          isSaving={isProfileSaving}
        />
      </div>

      {/* FieldRenderer handles all field rendering and drag & drop logic */}
      <FieldRenderer
        ref={fieldRendererRef}
        session={session}
        onDragStateChange={onDragStateChange}
        onSaveRequest={handleSaveRequest}
      />
    </div>
  );
};

export default EditProfileView;
