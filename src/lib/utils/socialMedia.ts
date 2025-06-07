import { SocialProfile } from '@/types/profile';

// Simple function to extract username from email (everything before @)
function extractUsernameFromEmail(email: string): string {
  if (!email || !email.includes('@')) return '';
  return email.split('@')[0];
}

// Social media URL patterns
const SOCIAL_URL_PATTERNS = {
  facebook: 'https://facebook.com/',
  instagram: 'https://instagram.com/',
  x: 'https://x.com/',
  linkedin: 'https://linkedin.com/in/',
  snapchat: 'https://snapchat.com/add/',
  whatsapp: 'https://wa.me/',
  telegram: 'https://t.me/',
  wechat: 'weixin://dl/chat?',
} as const;

// Generate social media profiles from email
export function generateSocialProfilesFromEmail(email: string, phoneNumber?: string): Record<string, SocialProfile> {
  const username = extractUsernameFromEmail(email);
  
  const profiles: Record<string, SocialProfile> = {};
  
  // Generate profiles for username-based platforms
  (['facebook', 'instagram', 'x', 'linkedin', 'snapchat'] as const).forEach(platform => {
    profiles[platform] = {
      username: username,
      url: username ? `${SOCIAL_URL_PATTERNS[platform]}${username}` : '',
      userConfirmed: false
    };
  });
  
  // Handle phone-based platforms
  if (phoneNumber) {
    const cleanPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
    
    profiles.whatsapp = {
      username: cleanPhone,
      url: `${SOCIAL_URL_PATTERNS.whatsapp}${cleanPhone}`,
      userConfirmed: false
    };
    
    profiles.telegram = {
      username: cleanPhone,
      url: `${SOCIAL_URL_PATTERNS.telegram}${cleanPhone}`,
      userConfirmed: false
    };
    
    profiles.wechat = {
      username: cleanPhone,
      url: `${SOCIAL_URL_PATTERNS.wechat}${cleanPhone}`,
      userConfirmed: false
    };
  } else {
    // Empty phone-based profiles
    ['whatsapp', 'telegram', 'wechat'].forEach(platform => {
      profiles[platform] = {
        username: '',
        url: '',
        userConfirmed: false
      };
    });
  }
  
  return profiles;
}

// Process existing social profiles to ensure URLs are generated from usernames
export function processSocialProfile(platform: string, profile: SocialProfile): SocialProfile {
  if (!profile.username) return profile;
  
  const urlPattern = SOCIAL_URL_PATTERNS[platform as keyof typeof SOCIAL_URL_PATTERNS];
  if (!urlPattern) return profile;
  
  return {
    ...profile,
    url: profile.username ? `${urlPattern}${profile.username}` : '',
  };
}
