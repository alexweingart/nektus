/**
 * Service for generating vCard 3.0 files from profile data
 */

import { UserProfile } from '@/types/profile';
import { getFieldValue } from './profileTransforms';
import { isEmbeddedBrowser } from './platformDetection';
import { getHighResGoogleImage } from './imageUtils';

export interface VCardOptions {
  includePhoto?: boolean;
  includeSocialMedia?: boolean;
  includeNotes?: boolean;
  contactUrl?: string; // Optional contact URL to include in notes
  skipPhotoFetch?: boolean; // Skip photo fetching for instant vCard display (iOS optimization)
}

/**
 * Fetch with timeout and abort controller
 */
async function fetchWithTimeout(url: string, timeout: number, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      ...options,
      signal: controller.signal,
      cache: 'no-cache',
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function logVCardError(message: string, error: unknown): void {
  console.warn(`[vCard] ${message}:`, error instanceof Error ? error.message : error);
}

/**
 * Convert image URL to optimal version for vCard compatibility
 * Uses high-res Google images when available, otherwise optimizes through Next.js
 */
function getOptimizedImageUrl(imageUrl: string): string {
  // If already a Next.js optimized URL, return as-is
  if (imageUrl.includes('/_next/image?')) {
    return imageUrl;
  }

  // For Google profile images, use high-res version directly (better quality than Next.js optimization)
  if (imageUrl.includes('googleusercontent.com')) {
    return getHighResGoogleImage(imageUrl, 300, true); // 300px for better quality in vCard
  }

  // If it's a Firebase Storage URL, optimize it through Next.js
  if (imageUrl.includes('firebasestorage.googleapis.com') || imageUrl.includes('firebasestorage.app')) {
    const encodedUrl = encodeURIComponent(imageUrl);
    // Use moderate size for vCard compatibility (250px, better quality than before)
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/_next/image?url=${encodedUrl}&w=250&q=75`;
  }

  // For other URLs, return as-is
  return imageUrl;
}

/**
 * Create a base64-encoded photo line for vCard 3.0
 */
async function makePhotoLine(imageUrl: string): Promise<string> {
  try {
    // Use optimized image URL for better vCard compatibility
    const optimizedUrl = getOptimizedImageUrl(imageUrl);
    
    // Try optimized URL first, then fallback to original
    let res: Response;
    try {
      res = await fetchWithTimeout(optimizedUrl, 15000);
    } catch (_error) {
      if (optimizedUrl !== imageUrl) {
        res = await fetchWithTimeout(imageUrl, 8000);
      } else {
        throw _error;
      }
    }
    
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    }
    
    const arrayBuffer = await res.arrayBuffer();
    
    if (arrayBuffer.byteLength > 1.5 * 1024 * 1024) {
      throw new Error('Image too large (>1.5MB)');
    }
    if (arrayBuffer.byteLength > 200 * 1024) {
      console.warn('Image size exceeds 200KB, may cause vCard compatibility issues');
    }
    
    // Detect image type from Content-Type header or image data
    const imageType = detectImageType(res, arrayBuffer);
    
    // Convert ArrayBuffer to base64 (Browser-compatible approach)
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
    const b64 = btoa(binaryString);
    
    const photoLine = formatPhotoLine(b64, imageType);
    
    return photoLine;
    
  } catch (error) {
    logVCardError('Failed to encode photo as base64, skipping photo', error);
    return "";
  }
}

function detectImageType(response: Response, arrayBuffer: ArrayBuffer): string {
  // First try Content-Type header
  const contentType = response.headers.get('content-type');
  if (contentType) {
    if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) return 'JPEG';
    if (contentType.includes('image/png')) return 'PNG';
    if (contentType.includes('image/gif')) return 'GIF';
    if (contentType.includes('image/webp')) return 'WEBP';
  }
  
  // Fallback: detect from image data magic bytes
  const uint8Array = new Uint8Array(arrayBuffer);
  
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

function formatPhotoLine(base64Data: string, imageType: string = 'JPEG'): string {
  // Use traditional BASE64 encoding with line folding for vCard compatibility
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


export const generateVCard = async (profile: UserProfile, options: VCardOptions = {}): Promise<string> => {
  const {
    includePhoto = true,
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
    if (emailEntry?.value) {
      lines.push(`EMAIL:${escapeVCardValue(emailEntry.value)}`);
    }
  }
  
  if (includePhoto && profile.profileImage) {
    try {
      const photoLine = await makePhotoLine(profile.profileImage);
      // Only add the photo line if it's not empty (empty means we skipped it)
      if (photoLine.trim() !== '') {
        lines.push(photoLine);
      }
    } catch (_error) {
      logVCardError('Failed to encode photo for vCard 3.0', _error);
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
    // Only add bio to notes, not the contact URL
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
  
  return lines.join('\r\n');
};

/**
 * Escape special characters in vCard values
 */
const escapeVCardValue = (value: string): string => {
  if (!value) return '';
  
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
};

/**
 * Platform configuration for social media
 */
const PLATFORMS = {
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
 * Get social media URL from platform and username
 */
const getSocialMediaUrl = (platform: string, username: string): string | null => {
  const platformConfig = PLATFORMS[platform.toLowerCase() as keyof typeof PLATFORMS];
  return platformConfig ? `${platformConfig.url}${username}` : null;
};

/**
 * Get platform type formatted for iOS vCard X-SOCIALPROFILE
 */
const getPlatformTypeForIOS = (platform: string): string => {
  const platformConfig = PLATFORMS[platform.toLowerCase() as keyof typeof PLATFORMS];
  return platformConfig?.iosName || platform;
};

export const createVCardFile = async (profile: UserProfile, options?: VCardOptions): Promise<Blob> => {
  const vCardContent = await generateVCard(profile, options);
  return new Blob([vCardContent], { type: 'text/vcard;charset=utf-8' });
};

/**
 * Generate a filename for the vCard
 */
export const generateVCardFilename = (profile: UserProfile): string => {
  const name = getFieldValue(profile.contactEntries, 'name') || 'contact';
  const safeName = name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  return `${safeName}_contact.vcf`;
};

export const downloadVCard = async (profile: UserProfile, options?: VCardOptions): Promise<void> => {
  const vCardBlob = await createVCardFile(profile, options);
  const filename = generateVCardFilename(profile);
  
  const url = URL.createObjectURL(vCardBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Add consolidated saveVCard function that auto-selects the best method based on platform or explicit override
 */
export const saveVCard = async (
  profile: UserProfile,
  options: VCardOptions & { forceMethod?: 'download' | 'ios-inline' } = {}
): Promise<void> => {
  const { forceMethod, ...vCardOptions } = options;

  if (forceMethod === 'download') {
    return downloadVCard(profile, vCardOptions);
  }

  if (forceMethod === 'ios-inline') {
    return displayVCardInlineForIOS(profile, vCardOptions);
  }

  // Auto-detect platform based on user agent
  const isIOS = typeof window !== 'undefined' && /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());

  if (isIOS) {
    return displayVCardInlineForIOS(profile, vCardOptions);
  }

  return downloadVCard(profile, vCardOptions);
};


/**
 * Display vCard inline for iOS
 */
export const displayVCardInlineForIOS = async (profile: UserProfile, options?: VCardOptions): Promise<void> => {
  const isEmbedded = isEmbeddedBrowser();

  if (isEmbedded) {
    return;
  }

  // iOS-specific vCard options for optimal UX:
  // - includePhoto: configurable via skipPhotoFetch for instant display
  // - includeSocialMedia: false (reduces scroll distance to save button)
  // - includeNotes: true (bio provides useful context)
  const vCardBlob = await createVCardFile(profile, {
    includePhoto: !options?.skipPhotoFetch,
    includeSocialMedia: false,
    includeNotes: true,
    contactUrl: options?.contactUrl
  });
  const url = URL.createObjectURL(vCardBlob);
  
  return new Promise<void>((resolve) => {
    try {
      window.location.href = url;

      const cleanup = () => {
        window.removeEventListener('focus', cleanupAndResolve);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        URL.revokeObjectURL(url);
      };

      const cleanupAndResolve = () => {
        cleanup();
        resolve();
      };

      const handleVisibilityChange = () => {
        if (!document.hidden) cleanupAndResolve();
      };

      window.addEventListener('focus', cleanupAndResolve);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      setTimeout(cleanupAndResolve, 10000);

    } catch {
      generateVCard(profile, {
        includePhoto: !options?.skipPhotoFetch,
        includeSocialMedia: false,
        includeNotes: true,
        contactUrl: options?.contactUrl
      }).then(vCardContent => {
        showVCardInstructions(profile, vCardContent);
        URL.revokeObjectURL(url);
        resolve();
      });
    }
  });
};

const showVCardInstructions = (profile: UserProfile, vCardContent: string): void => {
  const contactName = getFieldValue(profile.contactEntries, 'name') || 'Contact';
  
  const modal = document.createElement('div');
  modal.className = 'vcard-modal-backdrop';
  
  const content = document.createElement('div');
  content.className = 'vcard-modal-content vcard-modal';
  
  content.innerHTML = `
    <h3>Save ${contactName}'s Contact</h3>
    <p>To save this contact to your phone:</p>
    <ol>
      <li>Copy the contact info below</li>
      <li>Open your Contacts app</li>
      <li>Create a new contact</li>
      <li>Paste the information</li>
    </ol>
    <textarea readonly>${vCardContent}</textarea>
    <div class="vcard-modal-buttons">
      <button id="copy-vcard" class="vcard-modal-btn copy">Copy</button>
      <button id="close-modal" class="vcard-modal-btn close">Close</button>
    </div>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  const copyBtn = content.querySelector('#copy-vcard') as HTMLButtonElement;
  const closeBtn = content.querySelector('#close-modal') as HTMLButtonElement;
  
  copyBtn.addEventListener('click', () => {
    const textarea = content.querySelector('textarea') as HTMLTextAreaElement;
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    try {
      document.execCommand('copy');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });
  
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
};

