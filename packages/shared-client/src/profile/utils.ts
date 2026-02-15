/**
 * Profile utility functions
 * Shared between web and iOS for consistent profile handling
 */

import type { UserProfile } from '@nektus/shared-types';
import { ClientProfileService } from './save';

/**
 * Ensure a hex color is light enough to be readable on dark backgrounds.
 * Converts to HSL, clamps lightness to a minimum, and converts back to hex.
 */
export function ensureReadableColor(hex: string, minLightness = 60): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  // Clamp lightness to minimum
  l = Math.max(l, minLightness / 100);

  // HSL to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r2: number, g2: number, b2: number;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1 / 3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

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
