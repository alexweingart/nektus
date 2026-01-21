/**
 * vCard generation for iOS
 * Used as fallback when native contacts permission is denied or in App Clip
 *
 * Simplified from: apps/web/src/client/contacts/vcard.ts
 */

import { Linking, Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { UserProfile } from '@nektus/shared-types';
import { getFieldValue } from '@nektus/shared-client';

/**
 * Platform configuration for social media
 */
const PLATFORMS: Record<string, { url: string; iosName: string }> = {
  twitter: { url: 'https://twitter.com/', iosName: 'Twitter' },
  x: { url: 'https://x.com/', iosName: 'Twitter' },
  instagram: { url: 'https://instagram.com/', iosName: 'Instagram' },
  linkedin: { url: 'https://linkedin.com/in/', iosName: 'LinkedIn' },
  facebook: { url: 'https://facebook.com/', iosName: 'Facebook' },
  snapchat: { url: 'https://snapchat.com/add/', iosName: 'Snapchat' },
  telegram: { url: 'https://t.me/', iosName: 'Telegram' },
  whatsapp: { url: 'https://wa.me/', iosName: 'WhatsApp' },
  wechat: { url: 'https://weixin.qq.com/r/', iosName: 'WeChat' },
};

/**
 * Escape special characters in vCard values
 */
function escapeVCardValue(value: string): string {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Get social media URL from platform and username
 */
function getSocialMediaUrl(platform: string, username: string): string | null {
  const platformConfig = PLATFORMS[platform.toLowerCase()];
  return platformConfig ? `${platformConfig.url}${username}` : null;
}

/**
 * Get platform type formatted for iOS vCard X-SOCIALPROFILE
 */
function getPlatformTypeForIOS(platform: string): string {
  const platformConfig = PLATFORMS[platform.toLowerCase()];
  return platformConfig?.iosName || platform;
}

export interface VCardOptions {
  includePhoto?: boolean;
  includeSocialMedia?: boolean;
  includeNotes?: boolean;
  contactUrl?: string;
}

/**
 * Generate vCard 3.0 string from profile data
 * Note: Photo is not included in iOS version to keep it simple and fast
 */
export function generateVCard(profile: UserProfile, options: VCardOptions = {}): string {
  const {
    includeSocialMedia = false, // Disabled by default for faster save UI
    includeNotes = true,
    contactUrl,
  } = options;

  const lines: string[] = [];

  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  lines.push('PRODID:-//Nektus//vCard 1.0//EN');

  const name = getFieldValue(profile.contactEntries, 'name');
  if (name) {
    lines.push(`FN:${escapeVCardValue(name)}`);

    const nameParts = name.split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : name;
    lines.push(`N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`);
  }

  // Handle phone and email
  if (profile.contactEntries) {
    const phoneEntry = profile.contactEntries.find(e => e.fieldType === 'phone');
    if (phoneEntry?.value) {
      lines.push(`TEL;TYPE=CELL:${phoneEntry.value}`);
    }

    const emailEntry = profile.contactEntries.find(e => e.fieldType === 'email');
    if (emailEntry?.value) {
      lines.push(`EMAIL:${escapeVCardValue(emailEntry.value)}`);
    }
  }

  // Social media profiles
  if (includeSocialMedia && profile.contactEntries) {
    const processedPlatforms = new Set<string>();

    profile.contactEntries.forEach((entry) => {
      if (['phone', 'email', 'name', 'bio'].includes(entry.fieldType)) return;

      if (entry.value) {
        const url = getSocialMediaUrl(entry.fieldType, entry.value);
        if (url) {
          const platformType = getPlatformTypeForIOS(entry.fieldType);

          if (!processedPlatforms.has(platformType)) {
            processedPlatforms.add(platformType);
            lines.push(`X-SOCIALPROFILE;type=${platformType.toUpperCase()}:${url}`);
          }
        }
      }
    });
  }

  // Website URL
  if (contactUrl) {
    lines.push(`URL:${contactUrl}`);
  }

  // Notes (bio)
  if (includeNotes) {
    const bio = getFieldValue(profile.contactEntries, 'bio');
    if (bio) {
      lines.push(`NOTE:${escapeVCardValue(bio)}`);
    }
  }

  // Custom fields for Nekt tracking
  if (profile.userId) {
    lines.push(`X-NEKTUS-PROFILE-ID:${profile.userId}`);
  }
  if (profile.lastUpdated) {
    lines.push(`X-NEKTUS-UPDATED:${new Date(profile.lastUpdated).toISOString()}`);
  }

  lines.push(`REV:${new Date().toISOString()}`);
  lines.push('END:VCARD');

  return lines.join('\r\n');
}

/**
 * Generate a filename for the vCard
 */
export function generateVCardFilename(profile: UserProfile): string {
  const name = getFieldValue(profile.contactEntries, 'name') || 'contact';
  const safeName = name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  return `${safeName}_contact.vcf`;
}

/**
 * Open vCard in iOS Contacts app
 * This creates a temporary file and opens it with the system handler
 */
export async function openVCard(profile: UserProfile, options?: VCardOptions): Promise<boolean> {
  try {
    const vCardContent = generateVCard(profile, options);
    const filename = generateVCardFilename(profile);
    const filePath = `${FileSystem.cacheDirectory}${filename}`;

    // Write vCard to temp file
    await FileSystem.writeAsStringAsync(filePath, vCardContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      console.warn('[vCard] Sharing not available on this device');
      return false;
    }

    // Open the vCard file - iOS will show the "Add to Contacts" UI
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/vcard',
      UTI: 'public.vcard',
      dialogTitle: 'Add Contact',
    });

    // Clean up temp file after a delay
    setTimeout(async () => {
      try {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }
    }, 5000);

    return true;
  } catch (error) {
    console.error('[vCard] Failed to open vCard:', error);
    return false;
  }
}
