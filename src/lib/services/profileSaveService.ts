import type { CountryCode } from 'libphonenumber-js';
import type { UserProfile } from '@/types/profile';
import type { 
  SocialPlatform, 
  ProfileFormData
} from '@/types/forms';
import { formatPhoneNumber } from '@/lib/utils/phoneFormatter';
import { processSocialProfile } from '@/lib/utils/socialMedia';
import { extractPhoneData, formDataToProfile } from '@/lib/utils/profileTransforms';

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

// Service function for processing and saving profile data
export async function saveProfileData(
  formData: ProfileFormData,
  digits: string,
  phoneCountry: CountryCode,
  profile: UserProfile | undefined,
  hasNewBackgroundImage: boolean,
  saveProfile: (profile: Partial<UserProfile>, options?: any) => Promise<UserProfile | null>,
  confirmedChannels?: string[]
): Promise<UserProfile | null> {
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
    profile,
    confirmedChannels
  );
  
  // Save the updated profile
  if (!saveProfile) {
    throw new Error('saveProfile function is not available');
  }
  
  console.log('=== PROFILE SAVE START ===');
  console.log('Updated profile before save:', JSON.parse(JSON.stringify(updatedProfile)));
  
  // Save to context (which will save to localStorage)
  // Use directUpdate: true to ensure we do a direct update
  const result = await saveProfile(updatedProfile, { directUpdate: true });
  
  console.log('=== PROFILE SAVE COMPLETE ===');
  
  return result;
}
