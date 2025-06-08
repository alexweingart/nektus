'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import ProfileSetup from '../components/ProfileSetup';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function SetupPageContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  const { profile, getLatestProfile, isLoading } = useProfile();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  
  // Check for new user immediately to prevent loading spinner flash
  const isNewUser = session?.isNewUser;
  const shouldShowSetupImmediately = !!(isNewUser && sessionStatus === 'authenticated' && session);
  
  const [checkingProfile, setCheckingProfile] = useState<boolean>(!shouldShowSetupImmediately);
  const [shouldShowSetup, setShouldShowSetup] = useState<boolean>(shouldShowSetupImmediately);
  
  // Trigger background profile creation for new users after form loads
  useEffect(() => {
    if (shouldShowSetupImmediately && sessionStatus === 'authenticated' && session) {
      console.log('[SetupPage] Triggering background profile creation for new user');
      
      // Trigger ProfileContext to create profile and generate content in background
      // This will happen after the form is already visible
      setTimeout(() => {
        console.log('[SetupPage] Starting background profile operations');
        // The ProfileContext setup effect should now run since we're not skipping it
        window.dispatchEvent(new CustomEvent('triggerProfileCreation'));
      }, 100); // Small delay to ensure form is rendered first
    }
  }, [shouldShowSetupImmediately, sessionStatus, session]);
  
  // Proactive profile check to avoid setup page flash
  useEffect(() => {
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
        console.log('[SetupPage] Session data:', {
          isNewUser: session.isNewUser,
          sessionKeys: Object.keys(session),
          userKeys: Object.keys(session.user || {})
        });
        
        // NEW USER OPTIMIZATION: Check NextAuth flag first
        if (session.isNewUser) {
          console.log('[SetupPage] New user detected via NextAuth flag - showing setup immediately');
          console.log('[SetupPage] ProfileContext will create default profile in background');
          setShouldShowSetup(true);
          setCheckingProfile(false);
          return;
        }
        
        // EXISTING USER: Check Firebase for profile completeness
        console.log('[SetupPage] Existing user - checking Firebase profile');
        
        // For existing users, wait for profile to load
        if (isLoading) {
          console.log('[SetupPage] Still loading profile from Firebase');
          return;
        }
        
        const currentProfile = getLatestProfile() || profile;
        
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
  }, [sessionStatus, isLoading, session, profile, getLatestProfile, router]);
  
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
  const currentProfile = getLatestProfile() || profile;
  
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
