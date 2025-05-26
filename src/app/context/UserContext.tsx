'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define types for our user data
export interface SocialProfile {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram';
  username: string;
  shareEnabled: boolean;
}

export interface UserData {
  name: string;
  internationalPhone: string; // Updated to match new field structure
  nationalPhone?: string;
  email: string;
  title?: string;
  company?: string;
  location?: string;
  socialProfiles: SocialProfile[];
}

interface UserContextType {
  userData: UserData;
  setUserData: React.Dispatch<React.SetStateAction<UserData>>;
  isProfileComplete: boolean;
  saveUserData: () => void;
  loadUserData: () => void;
}

// Create default empty user data
const defaultUserData: UserData = {
  name: '',
  internationalPhone: '',
  nationalPhone: '',
  email: '',
  title: '',
  company: '',
  location: '',
  socialProfiles: []
};

// Create the context
const UserContext = createContext<UserContextType | undefined>(undefined);

// Create a provider component
export function UserProvider({ children }: { children: ReactNode }) {
  const [userData, setUserData] = useState<UserData>(defaultUserData);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(false);

  // Load user data from localStorage on mount
  useEffect(() => {
    loadUserData();
  }, []);

  // Check if profile is complete whenever userData changes
  useEffect(() => {
    const complete = Boolean(
      userData.name && 
      userData.internationalPhone && 
      userData.email
    );
    setIsProfileComplete(complete);
  }, [userData]);

  // Save user data to localStorage
  const saveUserData = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nektus-user-data', JSON.stringify(userData));
    }
  };

  // Load user data from localStorage
  const loadUserData = () => {
    if (typeof window !== 'undefined') {
      const savedData = localStorage.getItem('nektus-user-data');
      if (savedData) {
        try {
          setUserData(JSON.parse(savedData));
        } catch (e) {
          console.error('Failed to parse saved user data', e);
        }
      }
    }
  };

  return (
    <UserContext.Provider value={{ 
      userData, 
      setUserData, 
      isProfileComplete, 
      saveUserData, 
      loadUserData 
    }}>
      {children}
    </UserContext.Provider>
  );
}

// Create a hook for using the context
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
