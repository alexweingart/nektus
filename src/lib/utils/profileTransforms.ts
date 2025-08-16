/**
 * Profile data transformation utilities
 * Handles conversion between form state and saved profile data
 */

import type { UserProfile, ContactChannels, LegacyContactChannels, ContactEntry, SocialProfile } from '@/types/profile';
import type { ProfileFormData, SocialProfileFormEntry, SocialPlatform, FieldSection } from '@/types/forms';
import type { CountryCode } from 'libphonenumber-js';

/**
 * Convert legacy ContactChannels format to new array-based format
 */
export function migrateLegacyContactChannels(legacy: LegacyContactChannels): ContactChannels {
  const entries: ContactEntry[] = [];
  
  // Migrate phone
  if (legacy.phoneInfo?.internationalPhone || legacy.phoneInfo?.nationalPhone) {
    entries.push({
      platform: 'phone',
      section: (legacy.phoneInfo.fieldSection?.section as any) === 'hidden' ? 'personal' : 
               (legacy.phoneInfo.fieldSection?.section || 'universal') as 'personal' | 'work' | 'universal',
      userConfirmed: legacy.phoneInfo.userConfirmed,
      internationalPhone: legacy.phoneInfo.internationalPhone,
      nationalPhone: legacy.phoneInfo.nationalPhone
    });
  }
  
  // Migrate email
  if (legacy.email?.email) {
    entries.push({
      platform: 'email',
      section: (legacy.email.fieldSection?.section as any) === 'hidden' ? 'personal' : 
               (legacy.email.fieldSection?.section || 'universal') as 'personal' | 'work' | 'universal',
      userConfirmed: legacy.email.userConfirmed,
      email: legacy.email.email
    });
  }
  
  // Migrate social platforms
  const socialPlatforms: (keyof Omit<LegacyContactChannels, 'phoneInfo' | 'email'>)[] = [
    'facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'
  ];
  
  socialPlatforms.forEach(platform => {
    const socialProfile = legacy[platform];
    if (socialProfile?.username) {
      entries.push({
        platform: platform as any,
        section: (socialProfile.fieldSection?.section as any) === 'hidden' ? 'personal' : 
                 (socialProfile.fieldSection?.section || (platform === 'linkedin' ? 'work' : 'personal')) as 'personal' | 'work' | 'universal',
        userConfirmed: socialProfile.userConfirmed,
        username: socialProfile.username,
        url: socialProfile.url,
        automatedVerification: socialProfile.automatedVerification,
        discoveryMethod: socialProfile.discoveryMethod
      });
    }
  });
  
  return { entries };
}

/**
 * Check if ContactChannels is in legacy format and migrate if needed
 */
export function ensureNewContactChannelsFormat(contactChannels: any): ContactChannels {
  // If it already has entries array, it's the new format
  if (contactChannels?.entries) {
    return contactChannels as ContactChannels;
  }
  
  // If it has the old structure, migrate it
  if (contactChannels?.phoneInfo || contactChannels?.email || contactChannels?.facebook) {
    return migrateLegacyContactChannels(contactChannels as LegacyContactChannels);
  }
  
  // Empty or invalid, return empty new format
  return { entries: [] };
}

/**
 * Transform a saved UserProfile into form data for editing - SIMPLIFIED ARRAY APPROACH
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
  const picture = profileData?.profileImage || sessionUser?.image || '/default-avatar.png';
  const backgroundImage = profileData?.backgroundImage || '';
  
  // Get contact channels (migrate if needed)
  const contactChannels = profileData?.contactChannels ? 
    ensureNewContactChannelsFormat(profileData.contactChannels) : 
    { entries: [] };
  
  // Find email for form email field
  const emailEntry = contactChannels.entries.find(e => e.platform === 'email');
  const email = emailEntry?.email || sessionUser?.email || '';
  
  // Convert contact entries directly to form entries - PERFECT 1:1 MAPPING
  const socialProfiles: Array<SocialProfileFormEntry> = contactChannels.entries.map((entry, index) => {
    const username = entry.platform === 'phone' ? (entry.nationalPhone || '') :
                     entry.platform === 'email' ? (entry.email || '') :
                     (entry.username || '');
    const hasContent = !!username;
    
    return {
      platform: entry.platform,
      username,
      filled: hasContent,
      confirmed: entry.userConfirmed,
      section: entry.section,
      // Preserve visibility state, default to visible if has content
      isVisible: entry.isVisible !== undefined ? entry.isVisible : hasContent,
      order: entry.order || index // Use existing order or index as fallback
    };
  });
  
  // Add missing empty entries for all platforms in all sections
  const allPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'];
  const allSections: FieldSection[] = ['personal', 'work'];
  
  allPlatforms.forEach(platform => {
    allSections.forEach(section => {
      const exists = socialProfiles.some(p => p.platform === platform && p.section === section);
      if (!exists) {
        socialProfiles.push({
          platform,
          username: '',
          filled: false,
          confirmed: false,
          section,
          isVisible: false, // Empty fields start hidden
          order: socialProfiles.length // Use current length as order
        });
      }
    });
  });
  
  // Add universal phone/email if missing
  if (!socialProfiles.some(p => p.platform === 'phone')) {
    socialProfiles.push({
      platform: 'phone',
      username: '',
      filled: false,
      confirmed: false,
      section: 'universal',
      isVisible: false,
      order: socialProfiles.length
    });
  }
  
  if (!socialProfiles.some(p => p.platform === 'email') && email) {
    socialProfiles.push({
      platform: 'email',
      username: email,
      filled: !!email,
      confirmed: true,
      section: 'universal',
      isVisible: !!email,
      order: socialProfiles.length
    });
  }

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
 * Transform form data into a ContactChannels structure - NEW ARRAY-BASED FORMAT
 */
export function formDataToContactChannels(
  formData: ProfileFormData,
  phoneData: { internationalPhone: string; nationalPhone: string },
  hasPhoneNumber: boolean,
  generateSocialUrl: (platform: SocialPlatform, username: string) => string,
  existingContactChannels?: ContactChannels
): ContactChannels {
  const entries: ContactEntry[] = [];

  // Process ALL entries from form data directly - save exactly what user has populated
  formData.socialProfiles.forEach((profileEntry: SocialProfileFormEntry, index: number) => {
    const { platform, username, section } = profileEntry;
    
    // Handle phone
    if (platform === 'phone' && hasPhoneNumber) {
      entries.push({
        platform: 'phone',
        section: section as 'personal' | 'work' | 'universal',
        userConfirmed: true,
        internationalPhone: phoneData.internationalPhone,
        nationalPhone: phoneData.nationalPhone,
        order: 0 // Phone should always be first (matches PLATFORM_CONFIG)
      });
      return;
    }
    
    // Handle email
    if (platform === 'email' && formData.email) {
      entries.push({
        platform: 'email',
        section: section as 'personal' | 'work' | 'universal',
        userConfirmed: true,
        email: formData.email,
        order: 1 // Email should always be second (matches PLATFORM_CONFIG)
      });
      return;
    }
    
    // Handle social platforms - only save if has content
    const socialPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'];
    
    if (socialPlatforms.includes(platform) && username.trim()) {
      const url = generateSocialUrl(platform as SocialPlatform, username);
      const isVisible = (profileEntry as any).isVisible;
      
      entries.push({
        platform: platform as any,
        section: section as 'personal' | 'work' | 'universal',
        userConfirmed: true,
        username: username.trim(),
        url,
        isVisible, // Preserve visibility state
        order: index // Preserve user's custom order
      });
    }
  });

  return { entries };
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

  // We'll save section info directly to each SocialProfile in formDataToContactChannels
  // No need for separate fieldSections object anymore

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
