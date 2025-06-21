import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CountryCode } from 'libphonenumber-js';
import type { UserProfile } from '@/types/profile';
import type { 
  SocialPlatform, 
  ProfileFormData
} from '@/types/forms';
import { formatPhoneNumber } from '@/lib/utils/phoneFormatter';
import { processSocialProfile } from '@/lib/utils/socialMedia';
import { extractPhoneData, formDataToProfile } from '@/lib/utils/profileTransforms';

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

// Helper function to generate social URL using existing socialMedia utilities
const generateSocialUrl = (platform: SocialPlatform, username: string): string => {
  if (!username || platform === 'email' || platform === 'phone') return '';
  
  // Special cases that don't use standard URL patterns
  if (platform === 'whatsapp') return `+${username}`;
  if (platform === 'wechat') return '';
  
  // Use existing socialMedia utility and strip the protocol to maintain same format
  const dummyProfile = { username, url: '', userConfirmed: true };
  const processedProfile = processSocialProfile(platform, dummyProfile);
  
  // Strip https:// to maintain the same format as before
  return processedProfile.url.replace(/^https?:\/\//, '');
};

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
      // Extract phone data using transform utility
      const phoneData = extractPhoneData(digits, phoneCountry, formatPhoneNumber);
      const hasPhoneNumber = !!digits;

      // Transform form data to profile using transform utility
      const updatedProfile = formDataToProfile(
        formData,
        phoneData,
        hasPhoneNumber,
        hasNewBackgroundImage,
        generateSocialUrl,
        profile
      );
      
      // Save the updated profile
      if (!saveProfile) {
        throw new Error('saveProfile function is not available');
      }
      
      console.log('=== PROFILE SAVE START ===');
      console.log('Updated profile before save:', JSON.parse(JSON.stringify(updatedProfile)));
      
      // Save to context (which will save to localStorage)
      // Use directUpdate: true to ensure we do a direct update
      await saveProfile(updatedProfile, { directUpdate: true });
      
      console.log('=== PROFILE SAVE COMPLETE ===');
      
      // Redirect to profile view
      if (router) {
        router.push('/');
      } else {
        console.warn('Router is not available');
        // Fallback to window.location if router is not available
        window.location.href = '/';
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
