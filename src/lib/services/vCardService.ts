/**
 * Service for generating vCard 4.0 files from profile data
 */

import { UserProfile } from '@/types/profile';

export interface VCardOptions {
  includePhoto?: boolean;
  includeSocialMedia?: boolean;
  includeNotes?: boolean;
}

/**
 * Helper function to create a base64-encoded photo line for vCard 3.0
 * Required for iOS contacts to display the photo correctly
 */
async function makePhotoLine(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl);
    const mime = res.headers.get('content-type') || 'image/jpeg';
    const type = mime.includes('png') ? 'PNG' : 'JPEG';
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');

    // 75-byte soft-wrap as required by RFC 2425
    const chunks: string[] = [];
    for (let i = 0; i < b64.length; i += 75) {
      chunks.push(b64.slice(i, i + 75));
    }
    return `PHOTO;ENCODING=b;TYPE=${type}:${chunks.join('\r\n ')}`;
  } catch (error) {
    console.warn('Failed to encode photo as base64:', error);
    // Fallback to URI format if base64 encoding fails
    return `PHOTO;VALUE=URI:${imageUrl}`;
  }
}

/**
 * Generate a vCard 4.0 string from a profile
 */
export const generateVCard = (profile: UserProfile, options: VCardOptions = {}): string => {
  const {
    includePhoto = true,
    includeSocialMedia = true,
    includeNotes = true
  } = options;

  const lines: string[] = [];
  
  // vCard header
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:4.0');
  
  // Basic information
  if (profile.name) {
    // FN (Formatted Name) - required field
    lines.push(`FN:${escapeVCardValue(profile.name)}`);
    
    // N (Name) - structured name
    const nameParts = profile.name.split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : profile.name;
    lines.push(`N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`);
  }
  
  // Phone numbers
  if (profile.contactChannels?.phoneInfo?.internationalPhone) {
    lines.push(`TEL;TYPE=CELL:${profile.contactChannels.phoneInfo.internationalPhone}`);
  }
  
  // Email
  if (profile.contactChannels?.email?.email) {
    lines.push(`EMAIL:${escapeVCardValue(profile.contactChannels.email.email)}`);
  }
  
  // Photo/Avatar
  if (includePhoto && profile.profileImage) {
    // For remote URLs, we'll reference them directly
    lines.push(`PHOTO:${profile.profileImage}`);
  }
  
  // Social media and other contact channels
  if (includeSocialMedia && profile.contactChannels) {
    // Social media profiles
    Object.entries(profile.contactChannels).forEach(([platform, data]) => {
      if (platform === 'phoneInfo' || platform === 'email') return; // Skip phone and email, already handled
      
      if (data && typeof data === 'object' && 'username' in data && data.username) {
        const url = getSocialMediaUrl(platform, data.username);
        if (url) {
          const platformType = getPlatformTypeForIOS(platform);
          lines.push(`URL;TYPE=${platformType}:${url}`);
        }
      }
    });
  }
  
  // Notes/Bio
  if (includeNotes && profile.bio) {
    lines.push(`NOTE:${escapeVCardValue(profile.bio)}`);
  }
  
  // Nektus-specific data as extended properties
  lines.push(`X-NEKTUS-PROFILE-ID:${profile.userId || ''}`);
  if (profile.lastUpdated) {
    lines.push(`X-NEKTUS-UPDATED:${new Date(profile.lastUpdated).toISOString()}`);
  }
  
  // Add timestamp
  lines.push(`REV:${new Date().toISOString()}`);
  
  // vCard footer
  lines.push('END:VCARD');
  
  return lines.join('\r\n');
};

/**
 * Escape special characters in vCard values
 */
const escapeVCardValue = (value: string): string => {
  if (!value) return '';
  
  return value
    .replace(/\\/g, '\\\\')    // Escape backslashes
    .replace(/;/g, '\\;')      // Escape semicolons
    .replace(/,/g, '\\,')      // Escape commas
    .replace(/\n/g, '\\n')     // Escape newlines
    .replace(/\r/g, '');       // Remove carriage returns
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
    wechat: 'weixin://dl/chat?',
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
    x: 'Twitter',  // Map X platform to Twitter for iOS compatibility
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
export const createVCardFile = (profile: UserProfile, options?: VCardOptions): Blob => {
  const vCardContent = generateVCard(profile, options);
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
export const downloadVCard = (profile: UserProfile, options?: VCardOptions): void => {
  const vCardBlob = createVCardFile(profile, options);
  const filename = generateVCardFilename(profile);
  
  // Create download link
  const url = URL.createObjectURL(vCardBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
};

/**
 * Open vCard in new tab (useful for iOS)
 */
export const openVCardInNewTab = (profile: UserProfile, options?: VCardOptions): void => {
  const vCardBlob = createVCardFile(profile, options);
  const filename = generateVCardFilename(profile);
  
  // Create download link
  const url = URL.createObjectURL(vCardBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
};

/**
 * Generate a vCard 3.0 string optimized for iOS with X-SOCIALPROFILE
 * This follows Apple's requirements for proper icon display
 */
export const generateVCardForIOS = async (profile: UserProfile, options: VCardOptions = {}): Promise<string> => {
  const {
    includePhoto = true,
    includeSocialMedia = true,
    includeNotes = true
  } = options;

  const lines: string[] = [];
  
  // vCard header - Use 3.0 for iOS compatibility
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  lines.push('PRODID:-//Nektus//vCard 1.0//EN');
  
  // Basic information
  if (profile.name) {
    // FN (Formatted Name) - required field
    lines.push(`FN:${escapeVCardValue(profile.name)}`);
    
    // N (Name) - structured name
    const nameParts = profile.name.split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : profile.name;
    lines.push(`N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`);
  }
  
  // Phone numbers
  if (profile.contactChannels?.phoneInfo?.internationalPhone) {
    lines.push(`TEL;TYPE=CELL:${profile.contactChannels.phoneInfo.internationalPhone}`);
  }
  
  // Email
  if (profile.contactChannels?.email?.email) {
    lines.push(`EMAIL:${escapeVCardValue(profile.contactChannels.email.email)}`);
  }
  
  // Photo/Avatar - Use base64 encoding for iOS compatibility
  if (includePhoto && profile.profileImage) {
    const photoLine = await makePhotoLine(profile.profileImage);
    lines.push(photoLine);
  }
  
  // Social media profiles using X-SOCIALPROFILE for iOS compatibility
  if (includeSocialMedia && profile.contactChannels) {
    const processedPlatforms = new Set<string>();
    
    Object.entries(profile.contactChannels).forEach(([platform, data]) => {
      if (platform === 'phoneInfo' || platform === 'email') return; // Skip phone and email, already handled
      
      if (data && typeof data === 'object' && 'username' in data && data.username) {
        const url = getSocialMediaUrl(platform, data.username);
        if (url) {
          const platformType = getPlatformTypeForIOS(platform);
          
          // Avoid duplicates by tracking processed platform types
          if (!processedPlatforms.has(platformType)) {
            processedPlatforms.add(platformType);
            
            // Use lowercase tokens and add value=uri parameter
            const token = platformType.toLowerCase();
            lines.push(`X-SOCIALPROFILE;type=${token};value=uri:${url}`);
          }
        }
      }
    });
  }
  
  // Notes/Bio
  if (includeNotes && profile.bio) {
    lines.push(`NOTE:${escapeVCardValue(profile.bio)}`);
  }
  
  // Nektus-specific data as extended properties
  if (profile.userId) {
    lines.push(`X-NEKTUS-PROFILE-ID:${profile.userId}`);
  }
  if (profile.lastUpdated) {
    lines.push(`X-NEKTUS-UPDATED:${new Date(profile.lastUpdated).toISOString()}`);
  }
  
  // Add timestamp
  lines.push(`REV:${new Date().toISOString()}`);
  
  // vCard footer
  lines.push('END:VCARD');
  
  return lines.join('\r\n');
};

/**
 * Display vCard inline for iOS (opens with proper headers)
 */
export const displayVCardInlineForIOS = async (profile: UserProfile, options?: VCardOptions): Promise<void> => {
  const vCardContent = await generateVCardForIOS(profile, options);
  const filename = generateVCardFilename(profile);
  
  // Create a blob with proper vCard MIME type
  const vCardBlob = new Blob([vCardContent], { 
    type: 'text/vcard;charset=utf-8' 
  });
  
  const url = URL.createObjectURL(vCardBlob);
  
  console.log('📲 Opening vCard for iOS:', filename);
  
  // For iOS, use direct navigation to trigger the vCard handler
  window.location.href = url; 
  
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 5000);
};
