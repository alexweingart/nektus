import { SocialProfile } from '@/types/profile';

/**
his function is kept for editing existing profiles
 */

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
