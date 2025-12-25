/**
 * Profile utility functions
 * Shared between web and iOS for consistent profile handling
 */

import type { UserProfile } from '@nektus/shared-types';

/**
 * Checks if a profile needs initial setup (phone number required)
 * @param profile - The user profile to check
 * @returns true if profile needs setup, false otherwise
 */
export function profileNeedsSetup(profile: UserProfile | null): boolean {
  if (!profile) return true;

  const hasPhone = profile.contactEntries?.some(
    (e) => e.fieldType === 'phone' && e.value?.trim()
  );

  return !hasPhone;
}

/**
 * Checks if a profile has a phone number configured
 * @param profile - The user profile to check
 * @returns true if profile has a phone number
 */
export function profileHasPhone(profile: UserProfile | null): boolean {
  if (!profile?.contactEntries) return false;

  const phoneEntry = profile.contactEntries.find(
    (e) => e.fieldType === 'phone'
  );

  return !!(phoneEntry?.value && phoneEntry.value.trim() !== '');
}
