/**
 * Form-related type definitions for profile editing and setup
 * These types are for form state management, distinct from the saved data types in profile.ts
 */

// Country type for phone number input components
export interface Country {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
}

// Define the social platform type for form handling
export type SocialPlatform = 
  | 'facebook' 
  | 'instagram' 
  | 'x' 
  | 'linkedin' 
  | 'snapchat' 
  | 'whatsapp' 
  | 'telegram' 
  | 'wechat' 
  | 'email' 
  | 'phone';

// Define the social profile entry type for form state (distinct from the saved SocialProfile)
export interface SocialProfileFormEntry {
  platform: string;
  username: string;
  shareEnabled: boolean;
  filled?: boolean;
  confirmed?: boolean;
}

// Define the main form data structure for profile editing
export interface ProfileFormData {
  name: string;
  bio: string;
  email: string;
  picture: string;
  socialProfiles: Array<SocialProfileFormEntry>;
  backgroundImage: string;
}

// Array of social platforms that exist in ContactChannels (for type-safe iteration)
export const CONTACT_CHANNEL_SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'x',
  'linkedin',
  'snapchat',
  'whatsapp',
  'telegram',
  'wechat'
] as const;

// Type for the contact channel social platforms
export type ContactChannelSocialPlatform = typeof CONTACT_CHANNEL_SOCIAL_PLATFORMS[number];
