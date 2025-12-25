/**
 * Profile data transformation utilities
 * Handles conversion between form state and saved profile data
 */

import type { UserProfile, ContactEntry } from '@nektus/shared-types';

/**
 * Get a field value from ContactEntry array by fieldType
 */
export function getFieldValue(contactEntries: ContactEntry[] | undefined, fieldType: string): string {
  if (!contactEntries) return '';
  const entry = contactEntries.find(e => e.fieldType === fieldType);
  return entry?.value || '';
}

/**
 * Generate social URL from platform and username
 */
export function generateSocialUrl(fieldType: string, username: string, includeProtocol: boolean = false): string {
  if (!username || fieldType === 'email' || fieldType === 'phone') return '';

  // Special cases that don't use standard URL patterns
  if (fieldType === 'whatsapp') return `+${username}`;
  if (fieldType === 'wechat') return '';

  // Social media URL patterns (AI-discoverable platforms only)
  const urlPatterns: Record<string, string> = {
    facebook: 'facebook.com/',
    instagram: 'instagram.com/',
    x: 'x.com/',
    linkedin: 'linkedin.com/in/',
    snapchat: 'snapchat.com/add/',
    telegram: 't.me/',
  };

  const urlPattern = urlPatterns[fieldType.toLowerCase()];
  if (!urlPattern) return '';

  const url = `${urlPattern}${username}`;
  return includeProtocol ? `https://${url}` : url;
}

/**
 * Transform a saved UserProfile (from Firebase) into ContactEntry[] and images for editing
 * Note: Profiles are created server-side by ServerProfileService.getOrCreateProfile() during authentication
 * This function handles existing users and edge cases with missing contactEntries
 */
export function firebaseToContactEntries(
  profileData?: UserProfile | null
): { contactEntries: ContactEntry[]; images: { profileImage: string; backgroundImage: string } } {
  if (!profileData) {
    // No profile data - return empty structure
    return {
      contactEntries: [],
      images: { profileImage: '', backgroundImage: '' }
    };
  }

  // Initialize images from profile
  const images = {
    profileImage: profileData.profileImage || '',
    backgroundImage: profileData.backgroundImage || ''
  };

  // For users with existing contactEntries, use them directly
  if (profileData.contactEntries?.length) {
    return {
      contactEntries: [...profileData.contactEntries],
      images
    };
  }

  // Edge case: profile exists but missing/empty contactEntries
  // This shouldn't happen if ServerProfileService ran properly, but handle gracefully
  console.warn('Profile exists but missing contactEntries - this may indicate an issue with profile creation');

  return {
    contactEntries: [],
    images
  };
}

/**
 * Sort ContactEntry array by order field
 */
export function sortContactEntries(entries: ContactEntry[]): ContactEntry[] {
  return [...entries].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Check if a ContactEntry has content
 */
export function hasContactEntryContent(entry: ContactEntry): boolean {
  return Boolean(entry.value && entry.value.trim() !== '');
}

/**
 * Extract phone number from ContactEntry array
 */
export function getPhoneNumber(contactEntries: ContactEntry[] | undefined): string {
  if (!contactEntries) return '';
  const phoneEntry = contactEntries.find(e => e.fieldType === 'phone');
  return phoneEntry?.value || '';
}

/**
 * Extract first name from full name
 */
export function getFirstName(fullName: string): string {
  return fullName.split(' ')[0] || fullName;
}
