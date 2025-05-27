"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';

// Define the structure of our contact channels
type ContactChannel = 
  | { type: 'phoneInfo'; internationalPhone: string; nationalPhone: string; userConfirmed: boolean }
  | { type: 'email'; email: string; userConfirmed: boolean }
  | { type: 'social'; platform: 'facebook' | 'instagram' | 'x' | 'whatsapp' | 'snapchat' | 'telegram' | 'wechat' | 'linkedin'; username: string; url: string; userConfirmed: boolean };

// Define the structure of our profile data
export type SocialProfile = {
  platform: 'facebook' | 'instagram' | 'x' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'wechat' | 'email' | 'phone';
  username: string;
  url?: string;
  shareEnabled: boolean;
  filled?: boolean;
  userConfirmed?: boolean;
  countryUserConfirmed?: boolean;
};

// Define the structure of contact channels in the profile
type ProfileContactChannels = {
  phoneInfo: {
    internationalPhone: string;
    nationalPhone: string;
    userConfirmed: boolean;
  };
  email: {
    email: string;
    userConfirmed: boolean;
  };
  facebook: { username: string; url: string; userConfirmed: boolean };
  instagram: { username: string; url: string; userConfirmed: boolean };
  x: { username: string; url: string; userConfirmed: boolean };
  whatsapp: { username: string; url: string; userConfirmed: boolean };
  snapchat: { username: string; url: string; userConfirmed: boolean };
  telegram: { username: string; url: string; userConfirmed: boolean };
  wechat: { username: string; url: string; userConfirmed: boolean };
  linkedin: { username: string; url: string; userConfirmed: boolean };
};

export type UserProfile = {
  userId: string;
  name: string;
  nameUserConfirmed?: boolean;
  email: string;
  emailUserConfirmed?: boolean;
  picture: string;
  pictureUserConfirmed?: boolean;
  internationalPhone: string;
  nationalPhone: string;
  internationalPhoneUserConfirmed?: boolean;
  nationalPhoneUserConfirmed?: boolean;
  country?: string;
  countryUserConfirmed?: boolean;
  handle: string;
  socialProfiles: SocialProfile[];
  bio?: string;
  backgroundImage?: string;
  lastUpdated: any;
  
  // Social media fields
  facebookUsername?: string;
  facebookUrl?: string;
  facebookUserConfirmed?: boolean;
  instagramUsername?: string;
  instagramUrl?: string;
  instagramUserConfirmed?: boolean;
  snapchatUsername?: string;
  snapchatUrl?: string;
  snapchatUserConfirmed?: boolean;
  linkedinUsername?: string;
  linkedinUrl?: string;
  linkedinUserConfirmed?: boolean;
  whatsappUsername?: string;
  whatsappUrl?: string;
  whatsappUserConfirmed?: boolean;
  telegramUsername?: string;
  telegramUrl?: string;
  telegramUserConfirmed?: boolean;
  wechatUsername?: string;
  wechatUrl?: string;
  wechatUserConfirmed?: boolean;
  xUsername?: string;
  xUrl?: string;
  xUserConfirmed?: boolean;
};

// Create a context for our profile data
type ProfileContextType = {
  profile: UserProfile | null;
  isLoading: boolean;
  saveProfile: (profileData: Partial<UserProfile>) => Promise<UserProfile | null>;
  clearProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  isLoading: true,
  saveProfile: async () => null,
  clearProfile: async () => {},
});

// Hook to use the profile context
export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

// Key for localStorage
const STORAGE_KEY = 'nektus_user_profile';

// Provider component that makes profile data available throughout the app
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionEmail = session?.user?.email;

  // Load profile from localStorage
  const loadProfile = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const cachedProfile = localStorage.getItem(STORAGE_KEY);
      if (cachedProfile) {
        const parsed = JSON.parse(cachedProfile);
        if (parsed.userId === userId) {
          setProfile(parsed);
          return;
        }
      }
      
      // If no profile exists, create a new one
      if (session?.user) {
        const newProfile: UserProfile = {
          userId,
          name: session.user.name || '',
          email: session.user.email || '',
          picture: session.user.image || '',
          internationalPhone: '',
          nationalPhone: '',
          internationalPhoneUserConfirmed: false,
          nationalPhoneUserConfirmed: false,
          country: 'US',
          countryUserConfirmed: false,
          handle: '',
          socialProfiles: [],
          lastUpdated: Date.now(),
        };
        
        setProfile(newProfile);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Load profile when session changes
  useEffect(() => {
    if (sessionEmail) {
      loadProfile(sessionEmail);
    } else {
      setProfile(null);
      setIsLoading(false);
    }
  }, [sessionEmail, loadProfile]);

  // Clear profile function
  const clearProfile = useCallback(async (): Promise<void> => {
    if (!session?.user?.email) return;
    
    try {
      // Clear from local storage
      localStorage.removeItem(STORAGE_KEY);
      
      // Reset profile state
      setProfile(null);
    } catch (error) {
      console.error('Error clearing profile:', error);
    }
  }, [session?.user?.email]);

    // Save profile to local storage
  const saveProfile = useCallback(async (profileData: Partial<UserProfile>): Promise<UserProfile | null> => {
    if (!session?.user?.email || !profile) return null;
    
    try {
      const updatedProfile: UserProfile = {
        ...profile,
        ...profileData,
        lastUpdated: Date.now()
      };
      
      // Update local state
      setProfile(updatedProfile);
      
      // Save to local storage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfile));
      
      return updatedProfile;
    } catch (error) {
      console.error('Error saving profile:', error);
      return null;
    }
  }, [session, profile]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    profile,
    isLoading,
    saveProfile,
    clearProfile
  }), [profile, isLoading, saveProfile, clearProfile]);

  return (
    <ProfileContext.Provider value={contextValue}>
      {children}
    </ProfileContext.Provider>
  );
}

export default ProfileContext;
