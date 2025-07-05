export interface SocialProfile {
  username: string;
  url: string;
  userConfirmed: boolean;
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
