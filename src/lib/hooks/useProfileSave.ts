import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CountryCode } from 'libphonenumber-js';
import type { UserProfile } from '@/types/profile';
import type { ProfileFormData } from '@/types/forms';
import { saveProfileData as saveProfileDataService } from '@/lib/services/profileSaveService';

// Hook props interface
interface UseProfileSaveProps {
  profile?: UserProfile;
  saveProfile: (profile: Partial<UserProfile>, options?: any) => Promise<UserProfile | null>;
  hasNewBackgroundImage?: boolean;
}

// Hook return interface
interface UseProfileSaveReturn {
  saveProfileData: (formData: ProfileFormData, digits: string, phoneCountry: CountryCode) => Promise<void>;
  isSaving: boolean;
  saveError: string | null;
  clearError: () => void;
}

export const useProfileSave = ({ 
  profile, 
  saveProfile, 
  hasNewBackgroundImage = false 
}: UseProfileSaveProps): UseProfileSaveReturn => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();

  const clearError = useCallback(() => {
    setSaveError(null);
  }, []);

  const saveProfileData = useCallback(async (
    formData: ProfileFormData, 
    digits: string, 
    phoneCountry: CountryCode
  ) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Use the service function for the business logic
      const result = await saveProfileDataService(
        formData,
        digits,
        phoneCountry,
        profile,
        hasNewBackgroundImage,
        saveProfile
      );
      
      if (result) {
        console.log('Profile saved successfully, redirecting to home page');
        
        // Redirect to profile view
        if (router) {
          router.push('/');
        } else {
          console.warn('Router is not available');
          // Fallback to window.location if router is not available
          window.location.href = '/';
        }
      } else {
        throw new Error('Failed to save profile - no result returned');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save profile';
      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [profile, saveProfile, hasNewBackgroundImage, isSaving, router]);

  return {
    saveProfileData,
    isSaving,
    saveError,
    clearError
  };
};
