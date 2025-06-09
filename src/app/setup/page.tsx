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
        console.log('[SetupPage] Still loading session');
        return;
      }
      
      if (sessionStatus === 'unauthenticated') {
        console.log('[SetupPage] Unauthenticated - should not be on setup page');
        setCheckingProfile(false);
        return;
      }
      
      if (sessionStatus === 'authenticated' && session?.user) {
        // EXISTING USER: Check Firebase for profile completeness
        console.log('[SetupPage] Existing user - checking Firebase profile');
        
        // For existing users, wait for profile to load
        if (isLoading) {
          console.log('[SetupPage] Still loading profile from Firebase');
          return;
        }
        
        const currentProfile = getLatestProfile();
        
        if (currentProfile) {
          // Check if profile is complete
          const hasPhone = currentProfile.contactChannels?.phoneInfo?.internationalPhone && 
                          currentProfile.contactChannels.phoneInfo.internationalPhone.trim() !== '';
          
          if (hasPhone) {
            console.log('[SetupPage] Existing user has complete profile, redirecting to home');
            router.replace('/');
            return; // Don't show setup component
          } else {
            console.log('[SetupPage] Existing user has incomplete profile, showing setup');
            setShouldShowSetup(true);
          }
        } else {
          console.log('[SetupPage] Existing user but no profile found, showing setup');
          setShouldShowSetup(true);
        }
      }
      
      setCheckingProfile(false);
    };
    
    checkProfileStatus();
  }, [sessionStatus, isLoading, session, getLatestProfile, router, userIsNew]);
  
  // For new users, skip all the complex profile checking
  if (userIsNew && sessionStatus === 'authenticated') {
    console.log('[SetupPage] New user detected - showing setup immediately');
    console.log('[SetupPage] ProfileContext will handle profile creation and AI generation');
    
    console.log('[SetupPage] Rendering ProfileSetup component', { 
      checkingProfile: false, 
      shouldShowSetup: true,
      userIsNew: true 
    });
    
    const currentProfile = getLatestProfile();
    
    console.log('[SetupPage] Background image state:', {
      hasStreamingImage: !!streamingBackgroundImage,
      hasProfileImage: !!currentProfile?.backgroundImage,
      finalImageUrl: currentProfile?.backgroundImage ? currentProfile.backgroundImage.substring(0, 50) + '...' : 'None'
    });
    
    // Dynamic background - streaming images when available
    const backgroundStyle = currentProfile?.backgroundImage ? {
      backgroundImage: `url(${currentProfile.backgroundImage})`,
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
    console.log('[SetupPage] Still checking profile status, showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#004D40' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }
  
  // Don't render setup if we're redirecting
  if (!shouldShowSetup) {
    console.log('[SetupPage] shouldShowSetup is false, showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#004D40' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }
  
  console.log('[SetupPage] Rendering ProfileSetup component', { checkingProfile, shouldShowSetup });
  
  // Get the latest profile including streaming background image
  const currentProfile = getLatestProfile();
  
  // Debug streaming background image
  console.log('[SetupPage] Background image state:', {
    hasStreamingImage: false,
    hasProfileImage: !!currentProfile?.backgroundImage,
    finalImageUrl: currentProfile?.backgroundImage ? currentProfile.backgroundImage.substring(0, 50) + '...' : 'None'
  });
  
  // Apply consistent background style
  const backgroundStyle = currentProfile?.backgroundImage ? {
    backgroundImage: `url(${currentProfile.backgroundImage})`,
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
