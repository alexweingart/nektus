"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
  // Remove phone and phoneUserConfirmed as requested
  // phone: string; // Removing per requirements
  // phoneUserConfirmed?: boolean; // Removing per requirements
  internationalPhone: string; // Full international format with country code
  nationalPhone: string; // National format without country code
  internationalPhoneUserConfirmed?: boolean; // Add confirmation flag for international format
  nationalPhoneUserConfirmed?: boolean; // Add confirmation flag for national format
  country?: string;
  countryUserConfirmed?: boolean;
  handle: string;
  socialProfiles: SocialProfile[];
  bio?: string; // AI-generated bio
  backgroundImage?: string; // AI-generated background image
  lastUpdated: any; // Firestore timestamp

  // Individual social media fields
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
export const useProfile = () => useContext(ProfileContext);

// Also keep a localStorage cache for offline access
const STORAGE_KEY = 'nektus_user_profile_cache';

// Helper function to convert new profile format to legacy format
const convertToLegacyProfile = (newProfile: any) => {
  const { contactChannels, ...rest } = newProfile;
  const legacyProfile: any = { ...rest };
  
  // Extract phone info
  if (contactChannels?.phoneInfo) {
    legacyProfile.internationalPhone = contactChannels.phoneInfo.internationalPhone;
    legacyProfile.nationalPhone = contactChannels.phoneInfo.nationalPhone;
    legacyProfile.internationalPhoneUserConfirmed = contactChannels.phoneInfo.userConfirmed;
    legacyProfile.nationalPhoneUserConfirmed = contactChannels.phoneInfo.userConfirmed;
  }
  
  // Extract email
  if (contactChannels?.email) {
    legacyProfile.email = contactChannels.email.email;
    legacyProfile.emailUserConfirmed = contactChannels.email.userConfirmed;
  }
  
  // Extract social profiles
  const socialPlatforms = ['facebook', 'instagram', 'x', 'whatsapp', 'snapchat', 'telegram', 'wechat', 'linkedin'];
  socialPlatforms.forEach(platform => {
    const channel = contactChannels?.[platform];
    if (channel) {
      legacyProfile[`${platform}Username`] = channel.username;
      legacyProfile[`${platform}Url`] = channel.url;
      legacyProfile[`${platform}UserConfirmed`] = channel.userConfirmed;
    }
  });
  
  return legacyProfile;
};

// Provider component that makes profile data available throughout the app
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load profile data from Firestore when session changes
  useEffect(() => {
    if (session?.user?.email) {
      const userId = session.user.email;
      loadProfileFromFirestore(userId);
    } else {
      setProfile(null);
      setIsLoading(false);
    }
  }, [session]);

  // Load profile from Firestore
  const loadProfileFromFirestore = async (userId: string) => {
    setIsLoading(true);
    try {
      // First try to load from localStorage cache for immediate display
      try {
        const cachedProfile = localStorage.getItem(STORAGE_KEY);
        if (cachedProfile) {
          const parsed = JSON.parse(cachedProfile);
          
          // Check if this is the new format with contactChannels
          if (parsed.contactChannels) {
            // Convert the new format to the old format for backward compatibility
            const legacyProfile = convertToLegacyProfile(parsed);
            setProfile(legacyProfile);
          } else if (parsed.userId === userId) {
            // This is the old format, use as is
            setProfile(parsed);
          }
        }
      } catch (err) {
        console.log('Error reading from cache, will load from Firestore');
      }
      
      // Then load from Firestore (might take longer but will be more up-to-date)
      const docRef = doc(db, 'profiles', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const profileData = docSnap.data() as UserProfile;
        setProfile(profileData);
        
        // Update local cache
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profileData));
      } else {
        // If no profile exists yet in Firestore but we have session data
        if (session?.user) {
          // Create a basic profile with available data
          const newProfile = {
            userId,
            name: session.user.name || '',
            email: session.user.email || '',
            picture: session.user.image || '',
            // Replace phone with the new fields
            internationalPhone: '',
            nationalPhone: '',
            internationalPhoneUserConfirmed: false,
            nationalPhoneUserConfirmed: false,
            country: 'US',
            countryUserConfirmed: false,
            handle: '',
            socialProfiles: [],
            lastUpdated: serverTimestamp(),
          };
          
          // Don't await this to avoid blocking the UI
          setDoc(docRef, newProfile);
          setProfile(newProfile);
          
          // Update local cache
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...newProfile,
            lastUpdated: Date.now() // Use JS timestamp for localStorage
          }));
        }
      }
    } catch (error) {
      console.error('Error loading profile from Firestore:', error);
      // Fall back to cache if we failed to load from Firestore
    } finally {
      setIsLoading(false);
    }
  };

  // Function to validate social media URLs
  const validateSocialMediaUrl = async (platform: string, username: string): Promise<boolean> => {
    // For now, we'll use a basic validation approach
    // In a production app, you might want to make API calls to validate these
    if (!username) return false;
    
    switch(platform) {
      case 'facebook':
        return username.length > 2; // Basic validation
      case 'instagram':
        return username.length > 2 && !username.includes(' ');
      case 'twitter':
      case 'x':
        return username.length > 2 && !username.includes(' ');
      case 'linkedin':
        return username.length > 2;
      case 'snapchat':
        return username.length > 2 && !username.includes(' ');
      case 'whatsapp':
        return username.length >= 10 && /^\d+$/.test(username);
      case 'telegram':
        return username.length > 2;
      case 'wechat':
        return username.length > 2;
      default:
        return false;
    }
  };

  // Function to generate social media URLs based on platform and username
  const getSocialMediaUrl = (platform: string, username: string): string => {
    if (!username) return '';
    
    switch(platform) {
      case 'facebook':
        return `https://facebook.com/${username}`;
      case 'instagram':
        return `https://instagram.com/${username}`;
      case 'twitter':
        return `https://twitter.com/${username}`;
      case 'x':
        return `https://x.com/${username}`;
      case 'linkedin':
        return `https://linkedin.com/in/${username}`;
      case 'snapchat':
        return `https://snapchat.com/add/${username}`;
      case 'whatsapp':
        return `https://wa.me/${username}`;
      case 'telegram':
        return `https://t.me/${username}`;
      case 'wechat':
        // WeChat doesn't have a direct profile URL structure
        // Using a placeholder that can be replaced with actual deeplink when available
        return `weixin://contacts/profile/${username}`;
      default:
        return '';
    }
  };

  // Save profile to Firestore with optimized performance for fast UI transitions
  const saveProfile = async (profileData: Partial<UserProfile>): Promise<UserProfile | null> => {
    if (!session?.user?.email) return null;
    
    try {
      const userId = session.user.email;
      const docRef = doc(db, 'profiles', userId);
      
      // Normalize phone number if available
      const phoneNumber = profileData.internationalPhone || '';
      const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
      const nationalPhone = profileData.nationalPhone || '';
      const country = profileData.country || 'US';
      
      // Create contact channels with new structure
      const contactChannels: ProfileContactChannels = {
        phoneInfo: {
          internationalPhone: phoneNumber,
          nationalPhone: nationalPhone,
          userConfirmed: true
        },
        email: {
          email: session.user.email,
          userConfirmed: true
        },
        // Initialize all social channels with empty data
        facebook: { username: '', url: '', userConfirmed: false },
        instagram: { username: '', url: '', userConfirmed: false },
        x: { username: '', url: '', userConfirmed: false },
        whatsapp: { username: '', url: '', userConfirmed: false },
        snapchat: { username: '', url: '', userConfirmed: false },
        telegram: { username: '', url: '', userConfirmed: false },
        wechat: { username: '', url: '', userConfirmed: false },
        linkedin: { username: '', url: '', userConfirmed: false }
      };
      
      // Update contact channels with profile data
      if (profileData.facebookUsername) {
        contactChannels.facebook = {
          username: profileData.facebookUsername,
          url: profileData.facebookUrl || `https://facebook.com/${profileData.facebookUsername}`,
          userConfirmed: profileData.facebookUserConfirmed || false
        };
      }
      
      if (profileData.instagramUsername) {
        contactChannels.instagram = {
          username: profileData.instagramUsername,
          url: profileData.instagramUrl || `https://instagram.com/${profileData.instagramUsername}`,
          userConfirmed: profileData.instagramUserConfirmed || false
        };
      }
      
      if (profileData.xUsername) {
        contactChannels.x = {
          username: profileData.xUsername,
          url: profileData.xUrl || `https://x.com/${profileData.xUsername}`,
          userConfirmed: profileData.xUserConfirmed || false
        };
      }
      
      if (profileData.whatsappUsername) {
        contactChannels.whatsapp = {
          username: profileData.whatsappUsername,
          url: profileData.whatsappUrl || `https://wa.me/${profileData.whatsappUsername}`,
          userConfirmed: profileData.whatsappUserConfirmed || false
        };
      }
      
      if (profileData.snapchatUsername) {
        contactChannels.snapchat = {
          username: profileData.snapchatUsername,
          url: profileData.snapchatUrl || `https://snapchat.com/add/${profileData.snapchatUsername}`,
          userConfirmed: profileData.snapchatUserConfirmed || false
        };
      }
      
      if (profileData.telegramUsername) {
        contactChannels.telegram = {
          username: profileData.telegramUsername,
          url: profileData.telegramUrl || `https://t.me/${profileData.telegramUsername}`,
          userConfirmed: profileData.telegramUserConfirmed || false
        };
      }
      
      if (profileData.wechatUsername) {
        contactChannels.wechat = {
          username: profileData.wechatUsername,
          url: profileData.wechatUrl || `weixin://contacts/profile/${profileData.wechatUsername}`,
          userConfirmed: profileData.wechatUserConfirmed || false
        };
      }
      
      if (profileData.linkedinUsername) {
        contactChannels.linkedin = {
          username: profileData.linkedinUsername,
          url: profileData.linkedinUrl || `https://linkedin.com/in/${profileData.linkedinUsername}`,
          userConfirmed: profileData.linkedinUserConfirmed || false
        };
      }
      
      // Create the cached profile with the new structure
      const currentProfile = profile || {
        userId: session.user.email,
        name: session.user.name || '',
        email: session.user.email,
        picture: session.user.image || '',
        internationalPhone: phoneNumber,
        nationalPhone: nationalPhone,
        handle: '',
        socialProfiles: [],
        lastUpdated: serverTimestamp() as any,
        bio: '',
        backgroundImage: '/gradient-bg.jpg'
      };
      
      const cacheProfile = {
        // Basic profile info
        name: session.user.name || '',
        lastUpdated: Date.now(),
        bio: currentProfile.bio || '',
        
        // Images
        backgroundImage: currentProfile.backgroundImage || '/gradient-bg.jpg',
        profileImage: session.user.image || '',
        
        // Contact channels
        contactChannels
      };
      
      // Also save the userId for backward compatibility
      (cacheProfile as any).userId = session.user.email;
      
      // Create the updated profile with all required fields
      const updatedProfile: UserProfile = {
        ...currentProfile,
        ...profileData,
        userId: session.user.email,
        name: session.user.name || '',
        email: session.user.email,
        picture: session.user.image || '',
        internationalPhone: phoneNumber,
        nationalPhone: nationalPhone,
        country: country,
        handle: currentProfile.handle || '',
        socialProfiles: currentProfile.socialProfiles || [],
        lastUpdated: serverTimestamp() as any,
        pictureUserConfirmed: true,
        nameUserConfirmed: true,
        emailUserConfirmed: true,
        internationalPhoneUserConfirmed: true,
        nationalPhoneUserConfirmed: true,
        countryUserConfirmed: true
      };
      
      // Update local state
      setProfile(updatedProfile);
      
      // Save to local storage in both old and new formats for backward compatibility
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheProfile));
      
      // Create the new profile format
      const newProfileFormat = {
        name: session.user.name || '',
        profileImage: session.user.image || '',
        bio: currentProfile.bio || '',
        backgroundImage: currentProfile.backgroundImage || '/gradient-bg.jpg',
        lastUpdated: Date.now(),
        contactChannels: {
          phoneInfo: {
            internationalPhone: phoneNumber,
            nationalPhone: nationalPhone,
            userConfirmed: true
          },
          email: {
            email: session.user.email,
            userConfirmed: true
          },
          facebook: {
            username: profileData.facebookUsername || '',
            url: profileData.facebookUrl || `https://facebook.com/${profileData.facebookUsername || ''}`,
            userConfirmed: !!profileData.facebookUserConfirmed
          },
          instagram: {
            username: profileData.instagramUsername || '',
            url: profileData.instagramUrl || `https://instagram.com/${profileData.instagramUsername || ''}`,
            userConfirmed: !!profileData.instagramUserConfirmed
          },
          x: {
            username: profileData.xUsername || '',
            url: profileData.xUrl || `https://x.com/${profileData.xUsername || ''}`,
            userConfirmed: !!profileData.xUserConfirmed
          },
          whatsapp: {
            username: profileData.whatsappUsername || '',
            url: profileData.whatsappUrl || `https://wa.me/${profileData.whatsappUsername || ''}`,
            userConfirmed: !!profileData.whatsappUserConfirmed
          },
          snapchat: {
            username: profileData.snapchatUsername || '',
            url: profileData.snapchatUrl || `https://snapchat.com/add/${profileData.snapchatUsername || ''}`,
            userConfirmed: !!profileData.snapchatUserConfirmed
          },
          telegram: {
            username: profileData.telegramUsername || '',
            url: profileData.telegramUrl || `https://t.me/${profileData.telegramUsername || ''}`,
            userConfirmed: !!profileData.telegramUserConfirmed
          },
          wechat: {
            username: profileData.wechatUsername || '',
            url: profileData.wechatUrl || `weixin://contacts/profile/${profileData.wechatUsername || ''}`,
            userConfirmed: !!profileData.wechatUserConfirmed
          },
          linkedin: {
            username: profileData.linkedinUsername || '',
            url: profileData.linkedinUrl || `https://linkedin.com/in/${profileData.linkedinUsername || ''}`,
            userConfirmed: !!profileData.linkedinUserConfirmed
          }
        }
      };
      
      // Save the new format to local storage
      localStorage.setItem('nektus_user_profile', JSON.stringify(newProfileFormat));
      
      // Convert to legacy format for Firestore
      const legacyProfile = convertToLegacyProfile(cacheProfile);
      
      // Save to Firestore in the background
      const firestoreSave = setDoc(docRef, legacyProfile, { merge: true });
      
      // Start the save but don't wait for it to complete
      firestoreSave.catch((err: Error) => {
        console.error('Background Firestore save failed:', err);
      });
      
      return updatedProfile;
    } catch (error) {
      console.error('Error saving profile:', error);
      return null;
    }
  };

  const clearProfile = async (): Promise<void> => {
    if (!session?.user?.email) return;
    
    try {
      const userId = session.user.email;
      const docRef = doc(db, 'profiles', userId);
      
      // Set an empty profile rather than deleting
      // This maintains the user ID but clears all other data
      await updateDoc(docRef, {
        phone: '',
        handle: '',
        socialProfiles: [],
        lastUpdated: serverTimestamp(),
      });
      
      // Clear from local storage
      localStorage.removeItem(STORAGE_KEY);
      
      // Reset profile state
      setProfile(null);
    } catch (error) {
      console.error('Error clearing profile:', error);
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, isLoading, saveProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
