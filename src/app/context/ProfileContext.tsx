"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Define the structure of our profile data
export type SocialProfile = {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'x';
  username: string;
  url?: string;
  shareEnabled: boolean;
  filled?: boolean;
  userConfirmed?: boolean;
};

export type UserProfile = {
  userId: string;
  name: string;
  nameUserConfirmed?: boolean;
  email: string;
  emailUserConfirmed?: boolean;
  picture: string;
  pictureUserConfirmed?: boolean;
  phone: string;
  phoneUserConfirmed?: boolean;
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
          if (parsed.userId === userId) {
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
            phone: '',
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
    // In a real app, this would make API calls to verify accounts
    // For this implementation, we'll do a simple validation based on username length
    // and assume the URL is valid if the username meets minimum requirements
    
    if (!username || username.length < 3) return false;
    
    // Could be expanded to include real API validation
    // Example: Use HEAD requests to check if profile pages return 200 status
    // const url = getSocialMediaUrl(platform, username);
    // try {
    //   const response = await fetch(url, { method: 'HEAD' });
    //   return response.status === 200;
    // } catch (error) {
    //   return false;
    // }
    
    return true;
  };

  // Function to generate social media URLs based on platform and username
  const getSocialMediaUrl = (platform: string, username: string): string => {
    switch (platform) {
      case 'facebook':
        return `https://facebook.com/${username}`;
      case 'instagram':
        return `https://instagram.com/${username}`;
      case 'snapchat':
        return `https://snapchat.com/add/${username}`;
      case 'linkedin':
        return `https://linkedin.com/in/${username}`;
      case 'whatsapp':
        // Remove non-numeric characters for WhatsApp
        const whatsappNumber = username.replace(/[^0-9]/g, '');
        return `https://wa.me/${whatsappNumber}`;
      case 'telegram':
        return `https://t.me/${username}`;
      case 'x':
        return `https://x.com/${username}`;
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
      
      // Extract email username (for auto-populating social profiles)
      const emailUsername = session.user.email.split('@')[0] || '';
      
      // Normalize phone number if available
      const phoneNumber = profileData.phone || profile?.phone || '';
      const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      // Start with confirmed data (profile photo, name, email, phone)
      const baseProfileData = {
        userId,
        name: session.user.name || '',
        nameUserConfirmed: true,
        email: session.user.email,
        emailUserConfirmed: true,
        picture: session.user.image || '',
        pictureUserConfirmed: true,
        phone: phoneNumber,
        phoneUserConfirmed: true,
        lastUpdated: serverTimestamp(),
      };
      
      // Prepare initial updated profile with core fields
      let updatedProfile = {
        ...(profile || {}),
        ...profileData,
        ...baseProfileData,
      } as UserProfile;
      
      // Auto-populate social media profiles
      // These will be validated before final save
      const socialMediaFields = [
        {
          platform: 'facebook',
          username: emailUsername,
          userConfirmed: false,
        },
        {
          platform: 'instagram',
          username: emailUsername,
          userConfirmed: false,
        },
        {
          platform: 'snapchat',
          username: emailUsername,
          userConfirmed: false,
        },
        {
          platform: 'linkedin',
          username: emailUsername,
          userConfirmed: false,
        },
        {
          platform: 'whatsapp',
          username: normalizedPhone,
          userConfirmed: false,
        },
        {
          platform: 'telegram',
          username: normalizedPhone,
          userConfirmed: false,
        },
        {
          platform: 'x',
          username: emailUsername,
          userConfirmed: false,
        },
      ];
      
      // Validate and populate social media profiles
      for (const field of socialMediaFields) {
        const { platform, username, userConfirmed } = field;
        const platformKey = platform as keyof UserProfile;
        const usernameKey = `${platform}Username` as keyof UserProfile;
        const urlKey = `${platform}Url` as keyof UserProfile;
        const confirmedKey = `${platform}UserConfirmed` as keyof UserProfile;
        
        // Skip if no username
        if (!username) continue;
        
        // Validate if the profile exists
        const isValid = await validateSocialMediaUrl(platform, username);
        
        if (isValid) {
          // Generate URL for the platform
          const url = getSocialMediaUrl(platform, username);
          
          // Add to updated profile
          updatedProfile = {
            ...updatedProfile,
            [usernameKey]: username,
            [urlKey]: url,
            [confirmedKey]: userConfirmed,
          } as UserProfile;
        }
      }
      
      // Also maintain compatibility with socialProfiles array
      // for backward compatibility
      const socialProfiles: SocialProfile[] = [
        ...socialMediaFields
          .filter(field => {
            const usernameKey = `${field.platform}Username` as keyof UserProfile;
            return !!updatedProfile[usernameKey]; // Only include validated ones
          })
          .map(field => ({
            platform: field.platform as SocialProfile['platform'],
            username: field.username,
            url: getSocialMediaUrl(field.platform, field.username),
            shareEnabled: true,
            filled: true,
            userConfirmed: field.userConfirmed,
          })),
      ];
      
      updatedProfile.socialProfiles = socialProfiles;
      
      // Update local state SYNCHRONOUSLY for immediate UI response
      setProfile(updatedProfile);
      
      // Update local cache SYNCHRONOUSLY
      const cacheProfile = {
        ...updatedProfile,
        lastUpdated: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheProfile));
      
      // Return the updated profile immediately to allow UI to progress
      // while we start the Firestore save in the background
      const firestoreSave = setDoc(docRef, updatedProfile, { merge: true });
      
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

  // Clear profile from Firestore and local storage
  const clearProfile = async () => {
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
