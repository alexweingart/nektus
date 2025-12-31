/**
 * TODO: Refactor to match iOS architecture pattern
 * - Import profileNeedsSetup, profileHasPhone, syncTimezone from @nektus/shared-client
 * - Keep only NextAuth-specific SessionPhoneEntry and createSessionPhoneEntry here
 * - This file will become web-specific helpers only
 */

import type { UserProfile, ContactEntry } from '@/types/profile';
import { ClientProfileService } from '@/client/profile/firebase-save';

/**
 * Session phone entry type for NextAuth session
 */
export interface SessionPhoneEntry {
  platform: string;
  section?: string;
  userConfirmed?: boolean;
  internationalPhone?: string;
  nationalPhone?: string;
}

/**
 * Check if a profile has a phone number
 */
export function profileHasPhone(profile: UserProfile | null): boolean {
  if (!profile?.contactEntries) return false;

  const phoneEntry = profile.contactEntries.find(e => e.fieldType === 'phone');
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

/**
 * Create a session phone entry object for NextAuth session updates
 */
export function createSessionPhoneEntry(phoneEntry: ContactEntry): SessionPhoneEntry {
  return {
    platform: 'phone',
    section: phoneEntry.section || 'universal',
    userConfirmed: phoneEntry.confirmed || false,
    internationalPhone: phoneEntry.value,
    nationalPhone: phoneEntry.value || ''
  };
}
