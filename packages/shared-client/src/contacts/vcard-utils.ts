/**
 * Platform-agnostic vCard utilities
 * These utilities can be used on both web and iOS
 */

import { UserProfile } from '@nektus/shared-types';
import { getFieldValue } from '../profile/transforms';

export interface VCardOptions {
  includePhoto?: boolean;
  includeSocialMedia?: boolean;
  includeNotes?: boolean;
  contactUrl?: string;
  skipPhotoFetch?: boolean;
}

/**
 * Platform configuration for social media
 */
export const SOCIAL_PLATFORMS = {
  twitter: { url: 'https://twitter.com/', iosName: 'Twitter' },
  x: { url: 'https://x.com/', iosName: 'Twitter' },
  instagram: { url: 'https://instagram.com/', iosName: 'Instagram' },
  linkedin: { url: 'https://linkedin.com/in/', iosName: 'LinkedIn' },
  facebook: { url: 'https://facebook.com/', iosName: 'Facebook' },
  snapchat: { url: 'https://snapchat.com/add/', iosName: 'Snapchat' },
  telegram: { url: 'https://t.me/', iosName: 'Telegram' },
  whatsapp: { url: 'https://wa.me/', iosName: 'WhatsApp' },
  wechat: { url: 'https://weixin.qq.com/r/', iosName: 'WeChat' },
} as const;

/**
 * Escape special characters in vCard values
 */
export function escapeVCardValue(value: string): string {
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
export function getSocialMediaUrl(platform: string, username: string): string | null {
  const platformConfig = SOCIAL_PLATFORMS[platform.toLowerCase() as keyof typeof SOCIAL_PLATFORMS];
  return platformConfig ? `${platformConfig.url}${username}` : null;
}

/**
 * Get platform type formatted for iOS vCard X-SOCIALPROFILE
 */
export function getPlatformTypeForIOS(platform: string): string {
  const platformConfig = SOCIAL_PLATFORMS[platform.toLowerCase() as keyof typeof SOCIAL_PLATFORMS];
  return platformConfig?.iosName || platform;
}

/**
 * Format base64 photo data for vCard with proper line folding
 */
export function formatPhotoLine(base64Data: string, imageType: string = 'JPEG'): string {
  const photoPrefix = `PHOTO;ENCODING=BASE64;TYPE=${imageType}:`;
  const prefixLength = photoPrefix.length;
  const firstLineSpace = 75 - prefixLength;
  const firstChunk = base64Data.slice(0, firstLineSpace);
  const remainingData = base64Data.slice(firstLineSpace);

  let photoLine = photoPrefix + firstChunk;

  for (let i = 0; i < remainingData.length; i += 74) {
    const chunk = remainingData.slice(i, i + 74);
    photoLine += '\r\n ' + chunk;
  }

  return photoLine;
}

/**
 * Detect image type from binary data magic bytes
 */
export function detectImageTypeFromBytes(uint8Array: Uint8Array): string {
  // JPEG: FF D8 FF
  if (uint8Array.length >= 3 && uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
    return 'JPEG';
  }

  // PNG: 89 50 4E 47
  if (uint8Array.length >= 4 && uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
    return 'PNG';
  }

  // GIF: 47 49 46
  if (uint8Array.length >= 3 && uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46) {
    return 'GIF';
  }

  // WebP: starts with RIFF and contains WEBP
  if (uint8Array.length >= 12 &&
      uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46 &&
      uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50) {
    return 'WEBP';
  }

  // Default to JPEG if unknown
  return 'JPEG';
}

/**
 * Generate vCard content lines (without photo - that's platform-specific)
 * Returns an array of vCard lines that can be joined with \r\n
 */
export function generateVCardLines(
  profile: UserProfile,
  options: VCardOptions = {}
): string[] {
  const {
    includeSocialMedia = true,
    includeNotes = true,
    contactUrl
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

  // Handle phone and email from contactEntries
  if (profile.contactEntries) {
    const phoneEntry = profile.contactEntries.find(e => e.fieldType === 'phone');
    if (phoneEntry?.value) {
      lines.push(`TEL;TYPE=CELL:${phoneEntry.value}`);
    }

    const emailEntry = profile.contactEntries.find(e => e.fieldType === 'email');
    if (emailEntry?.value && !emailEntry.value.endsWith('@privaterelay.appleid.com')) {
      lines.push(`EMAIL:${escapeVCardValue(emailEntry.value)}`);
    }
  }

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

  // Add website URL as proper URL field
  if (contactUrl) {
    lines.push(`URL:${contactUrl}`);
  }

  if (includeNotes) {
    const bio = getFieldValue(profile.contactEntries, 'bio');
    if (bio) {
      lines.push(`NOTE:${escapeVCardValue(bio)}`);
    }
  }

  if (profile.userId) {
    lines.push(`X-NEKTUS-PROFILE-ID:${profile.userId}`);
  }
  if (profile.lastUpdated) {
    lines.push(`X-NEKTUS-UPDATED:${new Date(profile.lastUpdated).toISOString()}`);
  }

  lines.push(`REV:${new Date().toISOString()}`);
  lines.push('END:VCARD');

  return lines;
}

/**
 * Generate vCard filename from profile
 */
export function generateVCardFilename(profile: UserProfile): string {
  const name = getFieldValue(profile.contactEntries, 'name') || 'contact';
  const safeName = name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  return `${safeName}_contact.vcf`;
}
