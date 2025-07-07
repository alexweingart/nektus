/**
 * Profile filtering utilities for contact sharing
 * Filters profile data based on selected sharing categories (All, Personal, Work)
 */

import type { UserProfile, ContactChannels, SocialProfile } from '@/types/profile';

export type SharingCategory = 'All' | 'Personal' | 'Work';

/**
 * Filter a user profile based on the selected sharing category
 * @param profile - The complete user profile
 * @param category - The sharing category selected by the user
 * @returns Filtered profile with only the appropriate contact channels
 */
export function filterProfileByCategory(
  profile: UserProfile, 
  category: SharingCategory
): UserProfile {
  // For 'All' category, return the complete profile (confirmed and unconfirmed channels)
  if (category === 'All') {
    return profile;
  }
  
  // For Personal and Work, filter contact channels by section
  const filteredContactChannels = filterContactChannelsByCategory(
    profile.contactChannels, 
    category
  );
  
  return {
    ...profile,
    contactChannels: filteredContactChannels
  };
}

/**
 * Filter contact channels based on sharing category
 * @param contactChannels - The complete contact channels object
 * @param category - The sharing category ('Personal' or 'Work')
 * @returns Filtered contact channels
 */
function filterContactChannelsByCategory(
  contactChannels: ContactChannels,
  category: 'Personal' | 'Work'
): ContactChannels {
  // Determine which sections to include
  const allowedSections = category === 'Personal' 
    ? ['universal', 'personal'] 
    : ['universal', 'work'];
  
  // Always include universal channels (phone and email)
  const filteredChannels: ContactChannels = {
    phoneInfo: contactChannels.phoneInfo,
    email: contactChannels.email,
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
  
  // Filter social media channels based on their section
  const socialPlatforms: (keyof ContactChannels)[] = [
    'facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'
  ];
  
  socialPlatforms.forEach(platform => {
    const channel = contactChannels[platform] as SocialProfile;
    
    if (channel && channel.username) {
      // Determine the channel's section
      const channelSection = channel.fieldSection?.section || getDefaultSectionForPlatform(platform);
      
      // Include the channel if it's in an allowed section
      if (allowedSections.includes(channelSection)) {
        (filteredChannels as any)[platform] = channel;
      }
      // If not in allowed section, it stays as empty/default (already initialized above)
    }
  });
  
  return filteredChannels;
}

/**
 * Get the default section for a platform (fallback when fieldSection is not set)
 * @param platform - The social media platform
 * @returns The default section for the platform
 */
function getDefaultSectionForPlatform(platform: keyof ContactChannels): string {
  // Default section assignments based on platform
  const defaultSections: Record<string, string> = {
    facebook: 'personal',
    instagram: 'personal', 
    x: 'personal',
    snapchat: 'personal',
    whatsapp: 'personal',
    telegram: 'personal',
    wechat: 'personal',
    linkedin: 'work'
  };
  
  return defaultSections[platform as string] || 'personal';
}

/**
 * Check if a profile has any shareable channels for a given category
 * Useful for UI validation
 * @param profile - The user profile to check
 * @param category - The sharing category
 * @returns True if there are channels to share in this category
 */
export function hasShareableChannelsForCategory(
  profile: UserProfile,
  category: SharingCategory
): boolean {
  if (category === 'All') {
    // Check if any channels have content
    const { contactChannels } = profile;
    return !!(
      contactChannels.phoneInfo?.internationalPhone ||
      contactChannels.email?.email ||
      contactChannels.facebook?.username ||
      contactChannels.instagram?.username ||
      contactChannels.x?.username ||
      contactChannels.linkedin?.username ||
      contactChannels.snapchat?.username ||
      contactChannels.whatsapp?.username ||
      contactChannels.telegram?.username ||
      contactChannels.wechat?.username
    );
  }
  
  const filteredProfile = filterProfileByCategory(profile, category);
  return hasShareableChannelsForCategory(filteredProfile, 'All');
} 