/**
 * Profile data transformation utilities
 * Handles conversion between form state and saved profile data
 */

import type { UserProfile, ContactChannels, SocialProfile } from '@/types/profile';
import type { ProfileFormData, SocialProfileFormEntry, SocialPlatform } from '@/types/forms';
import type { CountryCode } from 'libphonenumber-js';

/**
 * Transform a saved UserProfile into form data for editing
 */
export function profileToFormData(
  profileData?: UserProfile | null,
  sessionUser?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
): ProfileFormData {
  // Initialize form data with profile data or session fallbacks
  const name = profileData?.name || sessionUser?.name || '';
  const bio = profileData?.bio || '';
  const email = profileData?.contactChannels?.email?.email || sessionUser?.email || '';
  const picture = profileData?.profileImage || sessionUser?.image || '/default-avatar.png';
  const backgroundImage = profileData?.backgroundImage || '';
  
  // Initialize social profiles from contactChannels
  const socialProfiles: Array<SocialProfileFormEntry> = [];
  
  // Add phone if available
  if (profileData?.contactChannels?.phoneInfo) {
    socialProfiles.push({
      platform: 'phone',
      username: profileData.contactChannels.phoneInfo.nationalPhone || '',
      shareEnabled: true,
      filled: !!profileData.contactChannels.phoneInfo.nationalPhone,
      confirmed: profileData.contactChannels.phoneInfo.userConfirmed
    });
  }
  
  // Add email
  if (profileData?.contactChannels?.email) {
    socialProfiles.push({
      platform: 'email',
      username: profileData.contactChannels.email.email || '',
      shareEnabled: true,
      filled: !!profileData.contactChannels.email.email,
      confirmed: profileData.contactChannels.email.userConfirmed
    });
  }
  
  // Add social profiles
  const socialPlatforms: (keyof ContactChannels)[] = [
    'facebook', 'instagram', 'x', 'whatsapp', 'snapchat', 'telegram', 'wechat', 'linkedin'
  ];
  
  socialPlatforms.forEach(platform => {
    const channel = profileData?.contactChannels?.[platform] as SocialProfile | undefined;
    if (channel?.username !== undefined) {
      socialProfiles.push({
        platform,
        username: channel.username || '',
        shareEnabled: true,
        filled: !!channel.username,
        confirmed: channel.userConfirmed || false
      });
    }
  });

  return {
    name,
    bio,
    email,
    picture,
    socialProfiles,
    backgroundImage
  };
}

/**
 * Extract phone number data from form state
 */
export function extractPhoneData(
  digits: string,
  phoneCountry: CountryCode,
  formatPhoneNumber: (digits: string, countryCode?: CountryCode) => {
    internationalPhone: string;
    nationalPhone: string;
    error?: string;
  }
): {
  internationalPhone: string;
  nationalPhone: string;
} {
  if (!digits) {
    return {
      internationalPhone: '',
      nationalPhone: ''
    };
  }

  const phoneResult = formatPhoneNumber(digits, phoneCountry);
  
  if (phoneResult.error) {
    console.warn('Phone formatting warning:', phoneResult.error);
  }
  
  return {
    internationalPhone: phoneResult.internationalPhone,
    nationalPhone: phoneResult.nationalPhone
  };
}

/**
 * Transform form data into a ContactChannels structure
 */
export function formDataToContactChannels(
  formData: ProfileFormData,
  phoneData: { internationalPhone: string; nationalPhone: string },
  hasPhoneNumber: boolean,
  generateSocialUrl: (platform: SocialPlatform, username: string) => string,
  existingContactChannels?: ContactChannels
): ContactChannels {
  // Create base contact channels structure
  const baseContactChannels: ContactChannels = {
    // Initialize required fields with defaults
    phoneInfo: {
      internationalPhone: '',
      nationalPhone: '',
      userConfirmed: false
    },
    email: {
      email: '',
      userConfirmed: false
    },
    // Initialize all social platforms
    facebook: { username: '', url: '', userConfirmed: false },
    instagram: { username: '', url: '', userConfirmed: false },
    x: { username: '', url: '', userConfirmed: false },
    linkedin: { username: '', url: '', userConfirmed: false },
    snapchat: { username: '', url: '', userConfirmed: false },
    whatsapp: { username: '', url: '', userConfirmed: false },
    telegram: { username: '', url: '', userConfirmed: false },
    wechat: { username: '', url: '', userConfirmed: false }
  };

  // Update phone info
  if (hasPhoneNumber) {
    baseContactChannels.phoneInfo = {
      internationalPhone: phoneData.internationalPhone,
      nationalPhone: phoneData.nationalPhone,
      userConfirmed: true
    };
  } else if (existingContactChannels?.phoneInfo) {
    // Preserve existing phone info if no new phone number
    baseContactChannels.phoneInfo = existingContactChannels.phoneInfo;
  }

  // Update email info
  if (formData.email) {
    baseContactChannels.email = {
      email: formData.email,
      userConfirmed: false
    };
  } else if (existingContactChannels?.email) {
    // Preserve existing email if no new email
    baseContactChannels.email = existingContactChannels.email;
  }

  // Process social profiles from form data
  const socialPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'];
  
  // First, collect all social platforms that are present in the form data (exclude phone/email)
  const presentPlatforms = new Set(formData.socialProfiles
    .filter((p: SocialProfileFormEntry) => p.platform !== 'phone' && p.platform !== 'email')
    .map((p: SocialProfileFormEntry) => p.platform));
  
  // Process all known social platforms
  socialPlatforms.forEach(platform => {
    // If platform is not in present platforms, set it to empty
    if (!presentPlatforms.has(platform)) {
      (baseContactChannels as any)[platform] = { username: '', url: '', userConfirmed: false };
    }
  });
  
  // Then process the ones that are in the form data
  formData.socialProfiles.forEach((profileEntry: SocialProfileFormEntry) => {
    const { platform, username } = profileEntry;
    
    // Handle email separately (already processed above)
    if (platform === 'email') {
      return;
    }
    
    // Skip phone as it's handled separately
    if (platform === 'phone') {
      return;
    }
    
    // Handle other social platforms
    if (socialPlatforms.includes(platform)) {
      const url = username ? generateSocialUrl(platform as SocialPlatform, username) : '';
      
      const socialChannel: SocialProfile = {
        username: username || '',
        url,
        userConfirmed: true
      };
      
      // Type-safe way to update the social channel
      switch (platform) {
        case 'facebook':
          baseContactChannels.facebook = socialChannel;
          break;
        case 'instagram':
          baseContactChannels.instagram = socialChannel;
          break;
        case 'x':
          baseContactChannels.x = socialChannel;
          break;
        case 'whatsapp':
          baseContactChannels.whatsapp = socialChannel;
          break;
        case 'snapchat':
          baseContactChannels.snapchat = socialChannel;
          break;
        case 'telegram':
          baseContactChannels.telegram = socialChannel;
          break;
        case 'wechat':
          baseContactChannels.wechat = socialChannel;
          break;
        case 'linkedin':
          baseContactChannels.linkedin = socialChannel;
          break;
      }
    }
  });

  return baseContactChannels;
}

/**
 * Transform form data and phone data into a complete UserProfile update
 */
export function formDataToProfile(
  formData: ProfileFormData,
  phoneData: { internationalPhone: string; nationalPhone: string },
  hasPhoneNumber: boolean,
  hasNewBackgroundImage: boolean,
  generateSocialUrl: (platform: SocialPlatform, username: string) => string,
  existingProfile?: UserProfile
): Partial<UserProfile> {
  // Create contact channels
  const contactChannels = formDataToContactChannels(
    formData,
    phoneData,
    hasPhoneNumber,
    generateSocialUrl,
    existingProfile?.contactChannels
  );

  // Create the updated profile
  const updatedProfile: Partial<UserProfile> = {
    ...existingProfile, // Preserve existing profile data
    name: formData.name,
    bio: formData.bio,
    profileImage: formData.picture,
    // Only update backgroundImage if there's a new one, otherwise preserve existing
    backgroundImage: hasNewBackgroundImage ? formData.backgroundImage : existingProfile?.backgroundImage || '',
    lastUpdated: Date.now(),
    contactChannels
  };

  return updatedProfile;
}
