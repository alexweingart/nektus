// Legacy interface - keep for backward compatibility during migration
export interface SocialProfile {
  username: string;
  url: string;
  userConfirmed: boolean;
  automatedVerification?: boolean;    // AI + verification result
  discoveryMethod?: 'ai' | 'manual' | 'email-guess' | 'phone-guess';
  fieldSection?: {
    section: 'personal' | 'work' | 'hidden' | 'universal';
    originalSection?: 'personal' | 'work';
    order?: number;
  };
}

// New unified contact entry interface
export interface ContactEntry {
  platform: 'phone' | 'email' | 'facebook' | 'instagram' | 'x' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'wechat';
  section: 'personal' | 'work' | 'universal';
  userConfirmed: boolean;
  isVisible?: boolean; // Whether this field is shown (visible) or hidden in the section
  automatedVerification?: boolean;
  discoveryMethod?: 'ai' | 'manual' | 'email-guess' | 'phone-guess';
  order?: number; // User's custom ordering within section
  
  // Platform-specific data
  // For phone
  internationalPhone?: string;
  nationalPhone?: string;
  
  // For email
  email?: string;
  
  // For social platforms
  username?: string;
  url?: string;
}

// New ContactChannels structure - array-based
export interface ContactChannels {
  entries: ContactEntry[];
}

// Legacy ContactChannels interface - keep for backward compatibility during migration
export interface LegacyContactChannels {
  phoneInfo: {
    internationalPhone: string;
    nationalPhone: string;
    userConfirmed: boolean;
    fieldSection?: {
      section: 'personal' | 'work' | 'hidden' | 'universal';
      originalSection?: 'personal' | 'work';
      order?: number;
    };
  };
  email: {
    email: string;
    userConfirmed: boolean;
    fieldSection?: {
      section: 'personal' | 'work' | 'hidden' | 'universal';
      originalSection?: 'personal' | 'work';
      order?: number;
    };
  };
  facebook: SocialProfile;
  instagram: SocialProfile;
  x: SocialProfile;
  linkedin: SocialProfile;
  snapchat: SocialProfile;
  whatsapp: SocialProfile;
  telegram: SocialProfile;
  wechat: SocialProfile;
}

export interface UserProfile {
  userId: string;
  name: string;
  bio: string;
  profileImage: string;
  backgroundImage: string;
  lastUpdated: number;
  contactChannels: ContactChannels;
  // AI generation completion flags - persist across sessions
  aiGeneration?: {
    bioGenerated: boolean;
    avatarGenerated: boolean;
    backgroundImageGenerated: boolean;
  };
}

// Unified bio and social generation types
export interface BioAndSocialGenerationResponse {
  bio: string;
  contactChannels: ContactChannels;
  success: boolean;
  socialProfilesDiscovered: number;
  socialProfilesVerified: number;
}

export interface AIBioAndSocialResult {
  bio: string;
  socialProfiles: {
    facebook?: string | null;
    instagram?: string | null;
    linkedin?: string | null;
    x?: string | null;
  };
}
