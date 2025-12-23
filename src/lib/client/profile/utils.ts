import type { UserProfile } from '@/types/profile';

/**
 * Check if a profile has a phone number
 */
export function profileHasPhone(profile: UserProfile | null): boolean {
  if (!profile?.contactEntries) return false;

  const phoneEntry = profile.contactEntries.find(e => e.fieldType === 'phone');
  return !!(phoneEntry?.value && phoneEntry.value.trim() !== '');
}
