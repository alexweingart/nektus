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
 * Uses RFC 2426 compliant format for maximum compatibility across contact applications
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
      headers: {
        'User-Agent': 'Nektus/1.0',
        'Accept': 'image/*'
      }
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    }
    
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    
    // Check image size (warn if over 200KB, error if over 1MB)
    if (arrayBuffer.byteLength > 1024 * 1024) {
      throw new Error('Image too large (>1MB)');
    }
    if (arrayBuffer.byteLength > 200 * 1024) {
      console.warn('Image size exceeds 200KB, may cause vCard compatibility issues');
    }
    
    // Always use JPEG for maximum compatibility
    const type = 'JPEG';
    const b64 = Buffer.from(arrayBuffer).toString('base64');

    // RFC 2426 strict compliance for vCard 3.0 photo format
    // The photo line should be exactly: PHOTO;ENCODING=b;TYPE=JPEG:base64data
    // Lines MUST be folded at 75 characters (including CRLF)
    // Continuation lines MUST start with a space
    
    const photoPrefix = `PHOTO;ENCODING=b;TYPE=${type}:`;
    const prefixLength = photoPrefix.length;
    
    // Calculate how much base64 data fits on first line
    const firstLineSpace = 75 - prefixLength;
    const firstChunk = b64.slice(0, firstLineSpace);
    const remainingData = b64.slice(firstLineSpace);
    
    // Build the photo line with proper folding
    let photoLine = photoPrefix + firstChunk;
    
    // Add remaining data in 74-character chunks (75 - 1 for the leading space)
    for (let i = 0; i < remainingData.length; i += 74) {
      const chunk = remainingData.slice(i, i + 74);
      photoLine += '\r\n ' + chunk; // RFC 2426 requires CRLF + space for continuation
    }
    
    return photoLine;
    
  } catch (error) {
    console.warn('Failed to encode photo as base64, trying fallback methods:', error);
    
    // Fallback 1: Try data URI format (vCard 4.0 style but some 3.0 readers support it)
    try {
      const res = await fetch(imageUrl);
      if (res.ok) {
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            // Extract just the base64 part
            const base64Data = dataUrl.split(',')[1];
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
            resolve(photoLine);
          };
          reader.readAsDataURL(blob);
        });
      }
    } catch (fallbackError) {
      console.warn('Fallback 1 failed:', fallbackError);
    }
    
    // Fallback 2: URI reference (least compatible but better than nothing)
    return `PHOTO;VALUE=URI:${imageUrl}`;
  }
}

/**
 * Helper function to create a base64-encoded photo line for vCard 4.0
 * Uses the new vCard 4.0 format with data: URI
 */
async function makePhotoLineV4(imageUrl: string): Promise<string> {
  try {
    // Fetch the image with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const res = await fetch(imageUrl, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Nektus/1.0'
      }
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    }
    
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    
    // Check image size (limit to 200KB for better compatibility)
    if (arrayBuffer.byteLength > 200 * 1024) {
      console.warn('Image size exceeds 200KB, may cause vCard issues');
    }
    
    const b64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Use vCard 4.0 data: URI format
    return `PHOTO:data:${contentType};base64,${b64}`;
  } catch (error) {
    console.warn('Failed to encode photo as base64 for vCard 4.0:', error);
    // Fallback to URI format if base64 encoding fails
    return `PHOTO:${imageUrl}`;
  }
}

/**
 * Generate a vCard 3.0 string from a profile (default format for maximum compatibility)
 * Uses vCard 3.0 for better compatibility across contact applications
 */
export const generateVCard = async (profile: UserProfile, options: VCardOptions = {}): Promise<string> => {
  // Use vCard 3.0 format for maximum compatibility - especially for photos
  return generateVCard30(profile, options);
};

/**
 * Generate a vCard 3.0 string optimized for maximum compatibility
 * This format has the best support across contact applications for photos
 */
export const generateVCard30 = async (profile: UserProfile, options: VCardOptions = {}): Promise<string> => {
  const {
    includePhoto = true,
    includeSocialMedia = true,
    includeNotes = true
  } = options;

  const lines: string[] = [];
  
  // vCard header - Use 3.0 for maximum compatibility
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
  
  // Photo/Avatar - Use base64 encoding for maximum compatibility
  if (includePhoto && profile.profileImage) {
    try {
      const photoLine = await makePhotoLine(profile.profileImage);
      lines.push(photoLine);
    } catch (error) {
      console.warn('Failed to encode photo for vCard 3.0:', error);
      // Skip photo if encoding fails rather than breaking the entire vCard
    }
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
            
            // Use the correct X-SOCIALPROFILE format that iOS recognizes for icons
            lines.push(`X-SOCIALPROFILE;type=${platformType.toUpperCase()}:${url}`);
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
 * Generate a vCard 4.0 string from a profile (for future compatibility)
 * Note: vCard 4.0 has limited support, especially for photos
 */
export const generateVCard40 = async (profile: UserProfile, options: VCardOptions = {}): Promise<string> => {
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
  
  // Photo/Avatar - Use base64 encoding for vCard 4.0 (limited compatibility)
  if (includePhoto && profile.profileImage) {
    try {
      const photoLine = await makePhotoLineV4(profile.profileImage);
      lines.push(photoLine);
    } catch (error) {
      console.warn('Failed to encode photo for vCard 4.0:', error);
      // Skip photo if encoding fails rather than breaking the entire vCard
    }
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
export const openVCardInNewTab = async (profile: UserProfile, options?: VCardOptions): Promise<void> => {
  const vCardBlob = await createVCardFile(profile, options);
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
 * Alias for generateVCard30 - kept for backward compatibility
 * @deprecated Use generateVCard() or generateVCard30() instead
 */
export const generateVCardForIOS = async (profile: UserProfile, options: VCardOptions = {}): Promise<string> => {
  return generateVCard30(profile, options);
};

/**
 * Check if we're in an embedded browser (like Google app)
 */
const isEmbeddedBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check for common embedded browser indicators
  const embeddedIndicators = [
    'gsa/', // Google Search App
    'googleapp', // Google App
    'fb', // Facebook
    'fban', // Facebook App
    'fbav', // Facebook App
    'instagram',
    'twitter',
    'line/',
    'wechat',
    'weibo',
    'webview', // Generic webview
    'chrome-mobile', // Chrome custom tabs
  ];
  
  const isEmbedded = embeddedIndicators.some(indicator => userAgent.includes(indicator));
  
  console.log('🔍 User Agent:', userAgent);
  console.log('🔍 Is Embedded Browser:', isEmbedded);
  
  return isEmbedded;
};

/**
 * Display vCard inline for iOS (opens with proper headers)
 * Enhanced with multiple fallback strategies for embedded browsers
 */
export const displayVCardInlineForIOS = async (profile: UserProfile, options?: VCardOptions): Promise<void> => {
  console.log('📱 displayVCardInlineForIOS called for:', profile.name);
  
  const isEmbedded = isEmbeddedBrowser();
  console.log('🔍 Embedded browser detected:', isEmbedded);
  
  if (isEmbedded) {
    // For embedded browsers (like Google app), skip vCard entirely
    // This will be handled by the contact save flow with Google Contacts integration
    console.log('📱 Embedded browser detected, skipping vCard (will use Google Contacts flow)');
    return;
  }
  
  // Only try vCard for Safari (non-embedded browser)
  console.log('📱 Safari detected, attempting vCard download');
  
  // Use simplified vCard for maximum compatibility (no social media, just essentials)
  const vCardContent = await generateSimpleVCard(profile);
  const filename = generateVCardFilename(profile);
  
  console.log('📱 Generated simplified vCard content length:', vCardContent.length);
  console.log('📱 Generated filename:', filename);
  
  // Create a blob with proper vCard MIME type
  const vCardBlob = new Blob([vCardContent], { 
    type: 'text/vcard;charset=utf-8' 
  });
  
  const url = URL.createObjectURL(vCardBlob);
  
  console.log('📲 Opening vCard for iOS Safari:', filename);
  console.log('📲 Blob URL:', url);
  
  try {
    // Try original approach for Safari
    console.log('📱 Using direct navigation for Safari');
    window.location.href = url;
  } catch (error) {
    console.warn('📱 Safari vCard approach failed, showing instructions:', error);
    
    // Final fallback - show user instructions
    showVCardInstructions(profile, vCardContent);
  }
  
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 5000);
  
  console.log('📱 displayVCardInlineForIOS completed');
};

/**
 * Download vCard using click approach for iOS
 */
const downloadVCardForIOS = async (profile: UserProfile, options?: VCardOptions): Promise<void> => {
  const vCardContent = await generateVCardForIOS(profile, options);
  const filename = generateVCardFilename(profile);
  
  try {
    // Method 1: Try blob URL approach
    const vCardBlob = new Blob([vCardContent], { 
      type: 'text/vcard;charset=utf-8' 
    });
    
    const url = URL.createObjectURL(vCardBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // Add some attributes that might help with iOS compatibility
    link.rel = 'noopener';
    link.target = '_blank';
    
    // Try to trigger download
    document.body.appendChild(link);
    
    // Add small delay before clicking
    setTimeout(() => {
      link.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    }, 50);
    
  } catch (error) {
    console.warn('📱 Blob download failed, trying data URL approach:', error);
    
    // Method 2: Try data URL approach as fallback
    try {
      const dataUrl = `data:text/vcard;charset=utf-8,${encodeURIComponent(vCardContent)}`;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.style.display = 'none';
      link.rel = 'noopener';
      link.target = '_blank';
      
      document.body.appendChild(link);
      
      setTimeout(() => {
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
        }, 100);
      }, 50);
      
    } catch (dataError) {
      console.warn('📱 Data URL download failed:', dataError);
      throw dataError; // Re-throw to trigger the instructions fallback
    }
  }
};

/**
 * Show instructions to user when automatic vCard handling fails
 */
const showVCardInstructions = (profile: UserProfile, vCardContent: string): void => {
  const contactName = profile.name || 'Contact';
  
  // Create a simple modal with instructions
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
  
  // Add event listeners
  const copyBtn = content.querySelector('#copy-vcard') as HTMLButtonElement;
  const closeBtn = content.querySelector('#close-modal') as HTMLButtonElement;
  
  copyBtn.addEventListener('click', () => {
    const textarea = content.querySelector('textarea') as HTMLTextAreaElement;
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices
    
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
  
  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
};



/**
 * Generate a simplified vCard 3.0 without social media
 * Includes only: name, phone, email, bio, photo
 */
export const generateSimpleVCard = async (profile: UserProfile): Promise<string> => {
  const options: VCardOptions = {
    includePhoto: true,
    includeSocialMedia: false, // Exclude social media for simplicity
    includeNotes: true
  };
  
  return generateVCard30(profile, options);
};

/**
 * Alias for generateSimpleVCard - kept for backward compatibility
 * @deprecated Use generateSimpleVCard() instead
 */
export const generateSimpleVCardForIOS = async (profile: UserProfile): Promise<string> => {
  return generateSimpleVCard(profile);
};

/**
 * Debug function to test vCard photo encoding
 * This helps identify issues with image URLs, encoding, and format
 */
export const debugVCardPhoto = async (imageUrl: string): Promise<{
  success: boolean;
  issues: string[];
  photoLine?: string;
  imageInfo?: {
    size: number;
    contentType: string;
    canFetch: boolean;
  };
}> => {
  const issues: string[] = [];
  let imageInfo: any = {};
  
  try {
    // Test 1: Can we fetch the image?
    const res = await fetch(imageUrl, {
      mode: 'cors',
      headers: {
        'Accept': 'image/*'
      }
    });
    
    if (!res.ok) {
      issues.push(`Image fetch failed: ${res.status} ${res.statusText}`);
      return { success: false, issues };
    }
    
    const contentType = res.headers.get('content-type') || 'unknown';
    const arrayBuffer = await res.arrayBuffer();
    
    imageInfo = {
      size: arrayBuffer.byteLength,
      contentType: contentType,
      canFetch: true
    };
    
    // Test 2: Size checks
    if (arrayBuffer.byteLength > 1024 * 1024) {
      issues.push('Image is larger than 1MB - too big for vCard');
    } else if (arrayBuffer.byteLength > 200 * 1024) {
      issues.push('Image is larger than 200KB - may cause compatibility issues');
    }
    
    // Test 3: Content type
    if (!contentType.includes('image/')) {
      issues.push(`Invalid content type: ${contentType}`);
    }
    
    // Test 4: Try to create base64
    const b64 = Buffer.from(arrayBuffer).toString('base64');
    if (!b64) {
      issues.push('Failed to create base64 encoding');
      return { success: false, issues, imageInfo };
    }
    
    // Test 5: Create photo line
    const photoLine = await makePhotoLine(imageUrl);
    
    // Test 6: Validate photo line format
    if (!photoLine.startsWith('PHOTO;ENCODING=b;TYPE=')) {
      issues.push('Photo line does not start with correct vCard 3.0 format');
    }
    
    if (photoLine.includes('VALUE=URI')) {
      issues.push('Fell back to URI format - base64 encoding failed');
    }
    
    // Test 7: Check line length (should be folded at 75 chars)
    const lines = photoLine.split('\r\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 75) {
        issues.push(`Line ${i} is too long (${lines[i].length} chars) - should be max 75`);
      }
      if (i > 0 && !lines[i].startsWith(' ')) {
        issues.push(`Continuation line ${i} should start with space`);
      }
    }
    
    return {
      success: issues.length === 0,
      issues,
      photoLine,
      imageInfo
    };
    
  } catch (error) {
    issues.push(`Error during debug: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, issues, imageInfo };
  }
};

/**
 * Generate a test vCard with a small embedded image to test photo functionality
 * This helps determine if the issue is with image fetching or vCard format
 */
export const generateTestVCardWithPhoto = (profile: UserProfile): string => {
  // Small 16x16 red square in JPEG format (base64 encoded)
  const testImageBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAQABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
  
  const lines: string[] = [];
  
  // vCard header - Use 3.0 for maximum compatibility
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  lines.push('PRODID:-//Nektus//Test vCard 1.0//EN');
  
  // Basic information
  if (profile.name) {
    lines.push(`FN:${escapeVCardValue(profile.name)}`);
    const nameParts = profile.name.split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : profile.name;
    lines.push(`N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`);
  }
  
  // Phone number
  if (profile.contactChannels?.phoneInfo?.nationalPhone) {
    lines.push(`TEL;TYPE=CELL:${escapeVCardValue(profile.contactChannels.phoneInfo.nationalPhone)}`);
  }
  
  // Email
  if (profile.contactChannels?.email?.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(profile.contactChannels.email.email)}`);
  }
  
  // Test photo with proper RFC 2426 formatting
  const photoPrefix = 'PHOTO;ENCODING=b;TYPE=JPEG:';
  const prefixLength = photoPrefix.length;
  const firstLineSpace = 75 - prefixLength;
  const firstChunk = testImageBase64.slice(0, firstLineSpace);
  const remainingData = testImageBase64.slice(firstLineSpace);
  
  let photoLine = photoPrefix + firstChunk;
  for (let i = 0; i < remainingData.length; i += 74) {
    const chunk = remainingData.slice(i, i + 74);
    photoLine += '\r\n ' + chunk;
  }
  lines.push(photoLine);
  
  // vCard footer
  lines.push('END:VCARD');
  
  return lines.join('\r\n');
};
