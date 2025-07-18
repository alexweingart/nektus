/**
 * Service for generating vCard 3.0 files from profile data
 */

import { UserProfile } from '@/types/profile';

export interface VCardOptions {
  includePhoto?: boolean;
  includeSocialMedia?: boolean;
  includeNotes?: boolean;
  contactUrl?: string; // Optional contact URL to include in notes
}

/**
 * Create a base64-encoded photo line for vCard 3.0
 */
async function makePhotoLine(imageUrl: string): Promise<string> {
  try {
    // Try to fetch image with proper error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout
    
    // Add more headers to avoid CORS issues
    const res = await fetch(imageUrl, { 
      signal: controller.signal,
      mode: 'cors',
      // Bypass service worker cache for image processing to ensure fresh response
      cache: 'no-cache',
      headers: {
        'User-Agent': 'Nektus/1.0',
        'Accept': 'image/*'
      }
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    }
    
    const arrayBuffer = await res.arrayBuffer();
    
    if (arrayBuffer.byteLength > 1024 * 1024) {
      throw new Error('Image too large (>1MB)');
    }
    if (arrayBuffer.byteLength > 200 * 1024) {
      console.warn('Image size exceeds 200KB, may cause vCard compatibility issues');
    }
    
    const b64 = Buffer.from(arrayBuffer).toString('base64');
    return formatPhotoLine(b64);
    
  } catch (error) {
    console.warn('Failed to encode photo as base64, falling back to URI:', error);
    
    // For Google images that fail, provide better fallback - skip the photo entirely
    // rather than including a broken URL
    if (imageUrl.includes('googleusercontent.com') || imageUrl.includes('lh3.googleusercontent.com')) {
      console.warn('[vCard] Skipping Google profile image due to access restrictions. Consider rehosting the image to Firebase Storage.');
      return ''; // Return empty string to skip the photo
    }
    
    return `PHOTO;VALUE=URI:${imageUrl}`;
  }
}

/**
 * Format base64 data into proper vCard photo line with line folding
 */
function formatPhotoLine(base64Data: string): string {
  const photoPrefix = 'PHOTO;ENCODING=b;TYPE=JPEG:';
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
  
  if (profile.name) {
    lines.push(`FN:${escapeVCardValue(profile.name)}`);
    
    const nameParts = profile.name.split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : profile.name;
    lines.push(`N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`);
  }
  
  if (profile.contactChannels?.phoneInfo?.internationalPhone) {
    lines.push(`TEL;TYPE=CELL:${profile.contactChannels.phoneInfo.internationalPhone}`);
  }
  
  if (profile.contactChannels?.email?.email) {
    lines.push(`EMAIL:${escapeVCardValue(profile.contactChannels.email.email)}`);
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
  
  if (includeSocialMedia && profile.contactChannels) {
    const processedPlatforms = new Set<string>();
    
    Object.entries(profile.contactChannels).forEach(([platform, data]) => {
      if (platform === 'phoneInfo' || platform === 'email') return;
      
      if (data && typeof data === 'object' && 'username' in data && data.username) {
        const url = getSocialMediaUrl(platform, data.username);
        if (url) {
          const platformType = getPlatformTypeForIOS(platform);
          
          if (!processedPlatforms.has(platformType)) {
            processedPlatforms.add(platformType);
            lines.push(`X-SOCIALPROFILE;type=${platformType.toUpperCase()}:${url}`);
          }
        }
      }
    });
  }
  
  if (includeNotes) {
    let notes = '';
    
    // Add bio if available
    if (profile.bio) {
      notes += profile.bio;
    }
    
    // Add contact URL if provided
    if (contactUrl) {
      if (notes) notes += '\\n\\n'; // Add spacing if bio exists
      notes += `View full profile: ${contactUrl}`;
    }
    
    // Only add NOTE line if we have content
    if (notes) {
      lines.push(`NOTE:${escapeVCardValue(notes)}`);
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
  const name = profile.name || 'contact';
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
 * Check if we're in an embedded browser
 */
const isEmbeddedBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  const embeddedIndicators = [
    'gsa/',
    'googleapp',
    'fb',
    'fban',
    'fbav',
    'instagram',
    'twitter',
    'line/',
    'wechat',
    'weibo',
    'webview',
    'chrome-mobile',
  ];
  
  const isEmbedded = embeddedIndicators.some(indicator => userAgent.includes(indicator));
  
  console.log('🔍 User Agent:', userAgent);
  console.log('🔍 Is Embedded Browser:', isEmbedded);
  
  return isEmbedded;
};

/**
 * Display vCard inline for iOS
 */
export const displayVCardInlineForIOS = async (profile: UserProfile, options?: VCardOptions): Promise<void> => {
  console.log('📱 displayVCardInlineForIOS called for:', profile.name);
  
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
  
  try {
    console.log('📱 Using direct navigation for Safari');
    window.location.href = url;
  } catch (error) {
    console.warn('📱 Safari vCard approach failed, showing instructions:', error);
    showVCardInstructions(profile, vCardContent);
  }
  
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 5000);
  
  console.log('📱 displayVCardInlineForIOS completed');
};

/**
 * Show instructions to user when automatic vCard handling fails
 */
const showVCardInstructions = (profile: UserProfile, vCardContent: string): void => {
  const contactName = profile.name || 'Contact';
  
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
