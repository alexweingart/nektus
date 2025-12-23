/**
 * Profile filtering utilities for contact sharing
 * Filters profile data based on selected sharing categories (All, Personal, Work)
 */

import type { UserProfile, ContactEntry } from '@/types/profile';

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
  // Filter contact entries by section (Personal or Work)
  const filteredContactEntries = filterContactEntriesByCategory(
    profile.contactEntries, 
    category
  );
  
  return {
    ...profile,
    contactEntries: filteredContactEntries
  };
}

/**
 * Filter contact entries based on sharing category
 * @param contactEntries - The complete contact entries array
 * @param category - The sharing category ('Personal' or 'Work')
 * @returns Filtered contact entries
 */
function filterContactEntriesByCategory(
  contactEntries: ContactEntry[] | undefined,
  category: 'Personal' | 'Work'
): ContactEntry[] {
  if (!contactEntries) return [];
  
  // Determine which sections to include
  const allowedSections = category === 'Personal' 
    ? ['universal', 'personal'] 
    : ['universal', 'work'];
  
  // Filter entries based on allowed sections and visibility
  return contactEntries.filter(entry => 
    allowedSections.includes(entry.section) && entry.isVisible
  );
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
  const { contactEntries } = filteredProfile;
  
  // Check if there are any entries with content
  return contactEntries.some(entry => {
    return !!entry.value && entry.value.trim() !== '';
  });
}