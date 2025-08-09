/**
 * Profile filtering utilities for contact sharing
 * Filters profile data based on selected sharing categories (All, Personal, Work)
 */

import type { UserProfile, ContactChannels, ContactEntry, LegacyContactChannels, SocialProfile } from '@/types/profile';
import { ensureNewContactChannelsFormat } from './profileTransforms';

export type SharingCategory = 'Personal' | 'Work';

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
  // Filter contact channels by section (Personal or Work)
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
 * Filter contact channels based on sharing category - NEW ARRAY FORMAT
 * @param contactChannels - The complete contact channels object
 * @param category - The sharing category ('Personal' or 'Work')
 * @returns Filtered contact channels
 */
function filterContactChannelsByCategory(
  contactChannels: ContactChannels,
  category: 'Personal' | 'Work'
): ContactChannels {
  // Ensure we're working with the new format
  const normalizedChannels = ensureNewContactChannelsFormat(contactChannels as any);
  
  // Determine which sections to include
  const allowedSections = category === 'Personal' 
    ? ['universal', 'personal'] 
    : ['universal', 'work'];
  
  // Filter entries based on allowed sections
  const filteredEntries = normalizedChannels.entries.filter(entry => 
    allowedSections.includes(entry.section)
  );
  
  return { entries: filteredEntries };
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
  const filteredProfile = filterProfileByCategory(profile, category);
  const { contactChannels } = filteredProfile;
  
  // Check if there are any entries with content
  return contactChannels.entries.some(entry => {
    const hasContent = entry.platform === 'phone' ? !!entry.internationalPhone || !!entry.nationalPhone :
                      entry.platform === 'email' ? !!entry.email :
                      !!entry.username;
    return hasContent;
  });
} 