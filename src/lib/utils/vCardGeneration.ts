/**
 * Service for generating vCard 3.0 files from profile data
 */

import { UserProfile } from '@/types/profile';
import { getFieldValue } from './profileTransforms';
import { isEmbeddedBrowser } from './platformDetection';

export interface VCardOptions {
  includePhoto?: boolean;
  includeSocialMedia?: boolean;
  includeNotes?: boolean;
  contactUrl?: string; // Optional contact URL to include in notes
}

/**
 * Convert Firebase Storage URL to Next.js optimized image URL for vCard compatibility
 */
function getOptimizedImageUrl(imageUrl: string): string {
  // If already a Next.js optimized URL, return as-is
  if (imageUrl.includes('/_next/image?')) {
    return imageUrl;
  }
  
  // If it's a Firebase Storage URL, optimize it through Next.js
  if (imageUrl.includes('firebasestorage.googleapis.com') || imageUrl.includes('firebasestorage.app')) {
    const encodedUrl = encodeURIComponent(imageUrl);
    // Use very small size for vCard compatibility (150px max, low quality for smaller file size)
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/_next/image?url=${encodedUrl}&w=150&q=40`;
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
    console.log(`[vCard] Original URL: ${imageUrl}`);
    console.log(`[vCard] Optimized URL: ${optimizedUrl}`);
    
    // Try to fetch image with proper error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout
    
    // Simplified fetch without potentially problematic headers
    let res = await fetch(optimizedUrl, { 
      signal: controller.signal,
      
      // Bypass service worker cache for image processing to ensure fresh response
      cache: 'no-cache',
    });
    clearTimeout(timeoutId);
    
    // If Next.js optimization fails, try the original URL as fallback
    if (!res.ok && optimizedUrl !== imageUrl) {
      console.log(`[vCard] Optimization failed (${res.status}), trying original URL...`);
      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 8000);
      
      try {
        res = await fetch(imageUrl, { 
          signal: fallbackController.signal,
          cache: 'no-cache',
        });
        clearTimeout(fallbackTimeoutId);
      } catch {
        clearTimeout(fallbackTimeoutId);
        throw new Error(`Both optimized and original URLs failed: ${res.status} ${res.statusText}`);
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
    
    console.log(`[vCard] Image details:`, {
      originalUrl: imageUrl,
      optimizedUrl: optimizedUrl,
      size: arrayBuffer.byteLength,
      type: imageType,
      base64Length: b64.length,
      base64Preview: b64.substring(0, 50) + '...'
    });
    
    const photoLine = formatPhotoLine(b64, imageType);
    console.log(`[vCard] Generated photo line preview:`, photoLine.substring(0, 100) + '...');
    
    return photoLine;
    
  } catch (error) {
    console.warn('Failed to encode photo as base64, skipping photo:', error);
    console.warn('Error details:', error instanceof Error ? error.message : error);
    console.warn('Image URL that failed:', imageUrl);
    
    // Note: Removed Google image skipping - let it fall back to URI method
    
    return "";  // Mobile contact apps don't support URI photos
  }
}

/**
 * Detect image type from response headers or image data
 */
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

/**
 * Format base64 data into proper vCard photo line with line folding
 */
function formatPhotoLine(base64Data: string, imageType: string = 'JPEG'): string {
  // Try data URI format first (RFC 6350 compliant)
  const mimeType = imageType.toLowerCase() === 'jpeg' ? 'image/jpeg' : `image/${imageType.toLowerCase()}`;
  const dataUri = `data:${mimeType};base64,${base64Data}`;
  
  if (dataUri.length < 75) {
    return `PHOTO:${dataUri}`;
  }
  
  // If data URI is too long, use traditional BASE64 encoding with line folding
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
 * Generate a vCard 3.0 string from a profile
 */
export const generateVCard = async (profile: UserProfile, options: VCardOptions = {}): Promise<string> => {
  return generateVCard30(profile, options);
};

/**
 * Generate a vCard 3.0 string from a profile
 */
export const generateVCard30 = async (profile: UserProfile, options: VCardOptions = {}): Promise<string> => {
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
    } catch (error) {
      console.warn('Failed to encode photo for vCard 3.0:', error);
    }
  }
  
  if (includeSocialMedia && profile.contactEntries) {
    const processedPlatforms = new Set<string>();
    
    profile.contactEntries.forEach((entry) => {
      if (entry.fieldType === 'phone' || entry.fieldType === 'email' || entry.fieldType === 'name' || entry.fieldType === 'bio') return;
      
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
 * Get social media URL from platform and username
 */
const getSocialMediaUrl = (platform: string, username: string): string | null => {
  const platformUrls: Record<string, string> = {
    twitter: 'https://twitter.com/',
    x: 'https://x.com/',
    instagram: 'https://instagram.com/',
    linkedin: 'https://linkedin.com/in/',
    facebook: 'https://facebook.com/',
    snapchat: 'https://snapchat.com/add/',
    telegram: 'https://t.me/',
    whatsapp: 'https://wa.me/',
    wechat: 'https://weixin.qq.com/r/',
  };
  
  const baseUrl = platformUrls[platform.toLowerCase()];
  return baseUrl ? `${baseUrl}${username}` : null;
};

/**
 * Get platform type formatted for iOS vCard X-SOCIALPROFILE
 */
const getPlatformTypeForIOS = (platform: string): string => {
  const platformMap: Record<string, string> = {
    twitter: 'Twitter',
    x: 'Twitter',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    snapchat: 'Snapchat',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    wechat: 'WeChat',
  };
  
  return platformMap[platform.toLowerCase()] || platform;
};

/**
 * Create a downloadable vCard file
 */
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

/**
 * Download a vCard file
 */
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
  console.log('📱 displayVCardInlineForIOS called for:', getFieldValue(profile.contactEntries, 'name'));
  
  const isEmbedded = isEmbeddedBrowser();
  console.log('🔍 Embedded browser detected:', isEmbedded);
  
  if (isEmbedded) {
    console.log('📱 Embedded browser detected, skipping vCard (will use Google Contacts flow)');
    return;
  }
  
  console.log('📱 Safari detected, attempting vCard download');
  
  const vCardContent = await generateSimpleVCard(profile, options?.contactUrl);
  const filename = generateVCardFilename(profile);
  
  console.log('📱 Generated simplified vCard content length:', vCardContent.length);
  console.log('📱 Generated filename:', filename);
  
  const vCardBlob = new Blob([vCardContent], { 
    type: 'text/vcard;charset=utf-8' 
  });
  
  const url = URL.createObjectURL(vCardBlob);
  
  console.log('📲 Opening vCard for iOS Safari:', filename);
  console.log('📲 Blob URL:', url);
  
  return new Promise<void>((resolve) => {
    try {
      console.log('📱 Using direct navigation for Safari');
      window.location.href = url;
      
      // Wait for user to dismiss the vCard popup before resolving
      // We detect this by listening for focus/visibility events
      const handleFocusReturn = () => {
        console.log('📱 Focus returned to page, vCard likely dismissed');
        cleanup();
        resolve();
      };
      
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          console.log('📱 Page became visible again, vCard likely dismissed');
          cleanup();
          resolve();
        }
      };
      
      const cleanup = () => {
        window.removeEventListener('focus', handleFocusReturn);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        URL.revokeObjectURL(url);
      };
      
      // Listen for when user returns to the page (vCard dismissed)
      window.addEventListener('focus', handleFocusReturn);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Fallback timeout in case events don't fire
      setTimeout(() => {
        console.log('📱 Timeout reached, assuming vCard was dismissed');
        cleanup();
        resolve();
      }, 10000); // 10 second timeout
      
    } catch (error) {
      console.warn('📱 Safari vCard approach failed, showing instructions:', error);
      showVCardInstructions(profile, vCardContent);
      URL.revokeObjectURL(url);
      resolve(); // Resolve immediately if error occurs
    }
  });
};

/**
 * Show instructions to user when automatic vCard handling fails
 */
const showVCardInstructions = (profile: UserProfile, vCardContent: string): void => {
  const contactName = getFieldValue(profile.contactEntries, 'name') || 'Contact';
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 12px;
    max-width: 400px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  content.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #333;">Save ${contactName}'s Contact</h3>
    <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
      To save this contact to your phone:
    </p>
    <ol style="text-align: left; color: #666; margin: 0 0 20px 0; padding-left: 20px;">
      <li>Copy the contact info below</li>
      <li>Open your Contacts app</li>
      <li>Create a new contact</li>
      <li>Paste the information</li>
    </ol>
    <textarea readonly style="width: 100%; height: 120px; margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-family: monospace; font-size: 12px; background: #f9f9f9;">${vCardContent}</textarea>
    <div style="margin-top: 20px;">
      <button id="copy-vcard" style="background: #007AFF; color: white; border: none; padding: 10px 20px; border-radius: 6px; margin-right: 10px; cursor: pointer;">Copy</button>
      <button id="close-modal" style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Close</button>
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

/**
 * Generate a simplified vCard 3.0 without social media
 */
export const generateSimpleVCard = async (profile: UserProfile, contactUrl?: string): Promise<string> => {
  const options: VCardOptions = {
    includePhoto: true,
    includeSocialMedia: false,
    includeNotes: true,
    contactUrl
  };
  
  return generateVCard30(profile, options);
};
