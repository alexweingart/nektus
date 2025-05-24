"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Define the structure of our profile data
export type SocialProfile = {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram';
  username: string;
  shareEnabled: boolean;
  filled?: boolean;
};

export type UserProfile = {
  userId: string;
  name: string;
  email: string;
  picture: string;
  phone: string;
  handle: string;
  socialProfiles: SocialProfile[];
  lastUpdated: any; // Firestore timestamp
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

  // Save profile to Firestore with optimized performance
  const saveProfile = async (profileData: Partial<UserProfile>): Promise<UserProfile | null> => {
    if (!session?.user?.email) return null;
    
    try {
      const userId = session.user.email;
      const docRef = doc(db, 'profiles', userId);
      
      // Prepare updated profile data
      const updatedProfile = {
        ...(profile || {}),
        ...profileData,
        userId,
        name: session.user.name || '',
        email: session.user.email,
        picture: session.user.image || '',
        lastUpdated: serverTimestamp(),
      } as UserProfile;
      
      // Update local state immediately for responsiveness
      setProfile(updatedProfile);
      
      // Update local cache immediately
      const cacheProfile = {
        ...updatedProfile,
        lastUpdated: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheProfile));
      
      // Save to Firestore in the background
      setDoc(docRef, updatedProfile, { merge: true }).catch((err: Error) => {
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
