
// Field sections for profile organization
export type FieldSection = 'universal' | 'personal' | 'work';

// Unified contact entry interface - handles ALL profile fields
export interface ContactEntry {
  fieldType: string;           // 'name', 'bio', 'email', 'phone', 'instagram', etc.
  value: string;               // The actual field value
  section: FieldSection;
  order: number;               // Consistent ordering across all fields
  isVisible: boolean;          // Whether field is shown or hidden
  confirmed: boolean;          // User has confirmed this field
  automatedVerification?: boolean;
  discoveryMethod?: 'ai' | 'manual' | 'email-guess' | 'phone-guess';
}

export interface UserProfile {
  userId: string;
  profileImage: string;
  backgroundImage: string;
  lastUpdated: number;
  contactEntries: ContactEntry[];  // Everything is now a ContactEntry (name, bio, contacts)
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
  contactEntries: ContactEntry[];
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
