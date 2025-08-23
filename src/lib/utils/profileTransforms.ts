/**
 * Profile data transformation utilities
 * Handles conversion between form state and saved profile data
 */

import type { UserProfile, ContactEntry } from '@/types/profile';
import type { CountryCode } from 'libphonenumber-js';
import { processSocialProfile } from '@/lib/utils/socialMedia';

/**
 * Get a field value from ContactEntry array by fieldType
 */
export function getFieldValue(contactEntries: ContactEntry[] | undefined, fieldType: string): string {
  if (!contactEntries) return '';
  const entry = contactEntries.find(e => e.fieldType === fieldType);
  return entry?.value || '';
}

/**
 * Generate social URL using existing socialMedia utilities
 */
export function generateSocialUrl(fieldType: string, username: string): string {
  if (!username || fieldType === 'email' || fieldType === 'phone') return '';
  
  // Special cases that don't use standard URL patterns
  if (fieldType === 'whatsapp') return `+${username}`;
  if (fieldType === 'wechat') return '';
  
  // Use existing socialMedia utility and strip the protocol to maintain same format
  const dummyProfile = { username, url: '', userConfirmed: true };
  const processedProfile = processSocialProfile(fieldType as Parameters<typeof processSocialProfile>[0], dummyProfile);
  
  // Strip https:// to maintain the same format as before
  return processedProfile.url.replace(/^https?:\/\//, '');
}

/**
 * Transform a saved UserProfile (from Firebase) into ContactEntry[] and images for editing
 * Note: For true new users, newUserService.createDefaultProfile() should be called first
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
  // This shouldn't happen if newUserService ran properly, but handle gracefully
  console.warn('Profile exists but missing contactEntries - this may indicate an issue with profile creation');
  
  return { 
    contactEntries: [],
    images 
  };
}

/**
 * Extract phone number data from unified fields or digits
 */
export function extractPhoneData(
  digitsOrFields: string | ContactEntry[],
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
  let digits: string;
  
  if (typeof digitsOrFields === 'string') {
    digits = digitsOrFields;
  } else {
    // Extract from unified fields
    const phoneEntry = digitsOrFields.find(e => e.fieldType === 'phone');
    digits = phoneEntry?.value || '';
  }
  
  if (!digits) {
    return { internationalPhone: '', nationalPhone: '' };
  }
  
  const { internationalPhone, nationalPhone } = formatPhoneNumber(digits, phoneCountry);
  return { internationalPhone, nationalPhone };
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