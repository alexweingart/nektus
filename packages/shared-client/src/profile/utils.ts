/**
 * Profile utility functions
 * Shared between web and iOS for consistent profile handling
 */

import type { UserProfile } from '@nektus/shared-types';
import { ClientProfileService } from './save';

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

/**
 * Auto-detect and update timezone if different from browser timezone
 * Returns updated profile with new timezone
 */
export async function syncTimezone(
  profile: UserProfile,
  _userId: string
): Promise<UserProfile> {
  const browserTimezone = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : null;

  if (browserTimezone && profile.timezone !== browserTimezone) {
    console.log(`[ProfileUtils] Updating timezone from ${profile.timezone || 'undefined'} to ${browserTimezone}`);

    // Update timezone in Firebase (silent update)
    await ClientProfileService.saveProfile({
      ...profile,
      timezone: browserTimezone
    });

    // Return updated profile
    const updatedProfile = { ...profile, timezone: browserTimezone };
    console.log(`[ProfileUtils] Timezone updated successfully`);
    return updatedProfile;
  }

  return profile;
}
