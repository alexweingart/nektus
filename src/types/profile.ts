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

export interface ContactChannels {
  phoneInfo: {
    internationalPhone: string;
    nationalPhone: string;
    userConfirmed: boolean;
  };
  email: {
    email: string;
    userConfirmed: boolean;
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
