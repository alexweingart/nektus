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
          lines.push(`URL;TYPE=${platform.toUpperCase()}:${url}`);
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
    instagram: 'https://instagram.com/',
    linkedin: 'https://linkedin.com/in/',
    facebook: 'https://facebook.com/',
    snapchat: 'https://snapchat.com/add/',
    telegram: 'https://t.me/',
    whatsapp: 'https://wa.me/',
  };
  
  const baseUrl = platformUrls[platform.toLowerCase()];
  return baseUrl ? `${baseUrl}${username}` : null;
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
  const url = URL.createObjectURL(vCardBlob);
  
  const newWindow = window.open(url, '_blank');
  if (!newWindow) {
    // Fallback to download if popup blocked
    downloadVCard(profile, options);
  }
  
  // Clean up URL after a delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 5000);
};

/**
 * Generate a vCard 4.0 string optimized for iOS with X-SOCIALPROFILE
 */
export const generateVCardForIOS = (profile: UserProfile, options: VCardOptions = {}): string => {
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
    lines.push(`PHOTO:${profile.profileImage}`);
  }
  
  // Social media profiles using X-SOCIALPROFILE for iOS
  if (includeSocialMedia && profile.contactChannels) {
    Object.entries(profile.contactChannels).forEach(([platform, data]) => {
      if (platform === 'phoneInfo' || platform === 'email') return; // Skip phone and email, already handled
      
      if (data && typeof data === 'object' && 'username' in data && data.username) {
        const url = getSocialMediaUrl(platform, data.username);
        if (url) {
          // Use X-SOCIALPROFILE for iOS compatibility
          lines.push(`X-SOCIALPROFILE;TYPE=${platform.toLowerCase()};X-SERVICE=${platform.toLowerCase()}:${url}`);
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
 * Display vCard inline for iOS (opens with proper headers)
 */
export const displayVCardInlineForIOS = (profile: UserProfile, options?: VCardOptions): void => {
  const vCardContent = generateVCardForIOS(profile, options);
  const filename = generateVCardFilename(profile);
  
  // Create a blob with proper vCard MIME type
  const vCardBlob = new Blob([vCardContent], { 
    type: 'text/vcard;charset=utf-8' 
  });
  
  const url = URL.createObjectURL(vCardBlob);
  
  // Create a link that will trigger iOS to handle the vCard
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // Set headers via data attributes (iOS Safari will respect these)
  link.setAttribute('data-content-type', 'text/vcard');
  link.setAttribute('data-content-disposition', `inline; filename="${filename}"`);
  link.setAttribute('data-cache-control', 'no-store');
  
  // Trigger the download/open
  link.click();
  
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 5000);
};
