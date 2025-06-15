'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import ProfileSetup from '../components/ProfileSetup';
import { isNewUser } from '@/lib/services/newUserService';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function SetupPageContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  
  // Use the service to check for new user
  const userIsNew = isNewUser(session);
  
  // ALL HOOKS MUST BE AT TOP LEVEL - No conditional hooks
  const { isLoading, getLatestProfile, streamingBackgroundImage } = useProfile();
  const [checkingProfile, setCheckingProfile] = useState<boolean>(!userIsNew || sessionStatus !== 'authenticated');
  const [shouldShowSetup, setShouldShowSetup] = useState<boolean>(userIsNew && sessionStatus === 'authenticated');
  
  useEffect(() => {
    // Only run complex logic for existing users
    if (userIsNew && sessionStatus === 'authenticated') {
      return; // Early exit for new users
    }
    
    const checkProfileStatus = async () => {
      // Wait for session to load
      if (sessionStatus === 'loading') {
        return;
      }
      
      if (sessionStatus === 'unauthenticated') {
        setCheckingProfile(false);
        return;
      }
      
      if (sessionStatus === 'authenticated' && session?.user) {
        // EXISTING USER: Check Firebase for profile completeness
        
        // For existing users, wait for profile to load
        if (isLoading) {
          return;
        }
        
        const currentProfile = getLatestProfile();
        
        if (currentProfile) {
          // Check if profile is complete
          const hasPhone = currentProfile.contactChannels?.phoneInfo?.internationalPhone && 
                          currentProfile.contactChannels.phoneInfo.internationalPhone.trim() !== '';
          
          if (hasPhone) {
            router.replace('/');
            return; // Don't show setup component
          } else {
            setShouldShowSetup(true);
          }
        } else {
          setShouldShowSetup(true);
        }
      }
      
      setCheckingProfile(false);
    };
    
    checkProfileStatus();
  }, [sessionStatus, isLoading, session, getLatestProfile, router, userIsNew]);
  
  // For new users, skip all the complex profile checking
  if (userIsNew && sessionStatus === 'authenticated') {
    const currentProfile = getLatestProfile();
    
    const backgroundImageUrl = streamingBackgroundImage || currentProfile?.backgroundImage;
    const backgroundStyle = backgroundImageUrl ? {
      backgroundImage: `url(${backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: '#004D40' // Theme background color that shows while image loads
    } : {
      backgroundColor: '#004D40' // Theme background for new users
    };
    
    return (
      <div className="min-h-screen" style={backgroundStyle}>
        {error && (
          <div className="fixed top-0 left-0 right-0 p-4 bg-destructive text-white text-center font-bold z-50">
            There was a problem with Google sign-in. Please try again.
          </div>
        )}
        <ProfileSetup />
      </div>
    );
  }
  
  // Show loading while checking profile status
  if (checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#004D40' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }
  
  // Don't render setup if we're redirecting
  if (!shouldShowSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#004D40' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }
  
  // Get the latest profile including streaming background image
  const currentProfile = getLatestProfile();
  
  const backgroundImageUrl = streamingBackgroundImage || currentProfile?.backgroundImage;
  const backgroundStyle = backgroundImageUrl ? {
    backgroundImage: `url(${backgroundImageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#004D40' // Theme background color that shows while image loads
  } : {
    backgroundColor: '#004D40' // Theme background for welcome screen
  };
  
  return (
    <div className="min-h-screen" style={backgroundStyle}>
      {error && (
        <div className="fixed top-0 left-0 right-0 p-4 bg-destructive text-white text-center font-bold z-50">
          There was a problem with Google sign-in. Please try again.
        </div>
      )}
      <ProfileSetup />
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: '#004D40' }} />}>
      <SetupPageContent />
    </Suspense>
  );
}
