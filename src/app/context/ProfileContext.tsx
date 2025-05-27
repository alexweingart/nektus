"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';

// Define the structure of contact channels
type PhoneInfo = {
  internationalPhone: string;
  nationalPhone: string;
  userConfirmed: boolean;
};

type EmailInfo = {
  email: string;
  userConfirmed: boolean;
};

type SocialChannel = {
  username: string;
  url: string;
  userConfirmed: boolean;
};

// Function to generate a GUID
const generateGuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export type UserProfile = {
  // Basic profile info
  userId: string; // Add userId field
  name: string;
  bio: string;
  profileImage: string;
  backgroundImage: string;
  lastUpdated: number;
  
  // Contact channels
  contactChannels: {
    phoneInfo: PhoneInfo;
    email: EmailInfo;
    facebook: SocialChannel;
    instagram: SocialChannel;
    x: SocialChannel;
    whatsapp: SocialChannel;
    snapchat: SocialChannel;
    telegram: SocialChannel;
    wechat: SocialChannel;
    linkedin: SocialChannel;
  };
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
        const defaultSocialChannel = {
          username: '',
          url: '',
          userConfirmed: false
        };

        const newProfile: UserProfile = {
          userId: generateGuid(), // Generate a new GUID for the user
          name: session.user.name || 'New User',
          bio: '',
          profileImage: session.user.image || '/default-avatar.png',
          backgroundImage: '',
          lastUpdated: Date.now(),
          contactChannels: {
            phoneInfo: {
              internationalPhone: '',
              nationalPhone: '',
              userConfirmed: false
            },
            email: {
              email: session.user.email || '',
              userConfirmed: false
            },
            facebook: { ...defaultSocialChannel },
            instagram: { ...defaultSocialChannel },
            x: { ...defaultSocialChannel },
            whatsapp: { ...defaultSocialChannel },
            snapchat: { ...defaultSocialChannel },
            telegram: { ...defaultSocialChannel },
            wechat: { ...defaultSocialChannel },
            linkedin: { ...defaultSocialChannel }
          }
        };
        
        setProfile(newProfile);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
        return newProfile;
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
      // Create a new object with all fields from the current profile
      const updatedProfile: UserProfile = {
        // Preserve the userId
        userId: profile.userId,
        // Basic profile info
        name: profileData.name ?? profile.name,
        bio: profileData.bio ?? profile.bio,
        profileImage: profileData.profileImage ?? profile.profileImage,
        backgroundImage: profileData.backgroundImage ?? profile.backgroundImage,
        lastUpdated: Date.now(),
        
        // Contact channels - merge existing with updates
        contactChannels: {
          // Phone info
          phoneInfo: {
            internationalPhone: profileData.contactChannels?.phoneInfo?.internationalPhone ?? profile.contactChannels.phoneInfo.internationalPhone,
            nationalPhone: profileData.contactChannels?.phoneInfo?.nationalPhone ?? profile.contactChannels.phoneInfo.nationalPhone,
            userConfirmed: profileData.contactChannels?.phoneInfo?.userConfirmed ?? profile.contactChannels.phoneInfo.userConfirmed
          },
          // Email
          email: {
            email: profileData.contactChannels?.email?.email ?? profile.contactChannels.email.email,
            userConfirmed: profileData.contactChannels?.email?.userConfirmed ?? profile.contactChannels.email.userConfirmed
          },
          // Social channels
          facebook: {
            username: profileData.contactChannels?.facebook?.username ?? profile.contactChannels.facebook.username,
            url: profileData.contactChannels?.facebook?.url ?? profile.contactChannels.facebook.url,
            userConfirmed: profileData.contactChannels?.facebook?.userConfirmed ?? profile.contactChannels.facebook.userConfirmed
          },
          instagram: {
            username: profileData.contactChannels?.instagram?.username ?? profile.contactChannels.instagram.username,
            url: profileData.contactChannels?.instagram?.url ?? profile.contactChannels.instagram.url,
            userConfirmed: profileData.contactChannels?.instagram?.userConfirmed ?? profile.contactChannels.instagram.userConfirmed
          },
          x: {
            username: profileData.contactChannels?.x?.username ?? profile.contactChannels.x.username,
            url: profileData.contactChannels?.x?.url ?? profile.contactChannels.x.url,
            userConfirmed: profileData.contactChannels?.x?.userConfirmed ?? profile.contactChannels.x.userConfirmed
          },
          whatsapp: {
            username: profileData.contactChannels?.whatsapp?.username ?? profile.contactChannels.whatsapp.username,
            url: profileData.contactChannels?.whatsapp?.url ?? profile.contactChannels.whatsapp.url,
            userConfirmed: profileData.contactChannels?.whatsapp?.userConfirmed ?? profile.contactChannels.whatsapp.userConfirmed
          },
          snapchat: {
            username: profileData.contactChannels?.snapchat?.username ?? profile.contactChannels.snapchat.username,
            url: profileData.contactChannels?.snapchat?.url ?? profile.contactChannels.snapchat.url,
            userConfirmed: profileData.contactChannels?.snapchat?.userConfirmed ?? profile.contactChannels.snapchat.userConfirmed
          },
          telegram: {
            username: profileData.contactChannels?.telegram?.username ?? profile.contactChannels.telegram.username,
            url: profileData.contactChannels?.telegram?.url ?? profile.contactChannels.telegram.url,
            userConfirmed: profileData.contactChannels?.telegram?.userConfirmed ?? profile.contactChannels.telegram.userConfirmed
          },
          wechat: {
            username: profileData.contactChannels?.wechat?.username ?? profile.contactChannels.wechat.username,
            url: profileData.contactChannels?.wechat?.url ?? profile.contactChannels.wechat.url,
            userConfirmed: profileData.contactChannels?.wechat?.userConfirmed ?? profile.contactChannels.wechat.userConfirmed
          },
          linkedin: {
            username: profileData.contactChannels?.linkedin?.username ?? profile.contactChannels.linkedin.username,
            url: profileData.contactChannels?.linkedin?.url ?? profile.contactChannels.linkedin.url,
            userConfirmed: profileData.contactChannels?.linkedin?.userConfirmed ?? profile.contactChannels.linkedin.userConfirmed
          }
        }
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
