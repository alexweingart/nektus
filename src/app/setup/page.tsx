'use client';

import React, { Suspense } from 'react';
import dynamicImport from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useProfile } from '../context/ProfileContext';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Dynamic import with loading state
const ProfileSetup = dynamicImport(() => import('../components/ProfileSetup'), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
    </div>
  ),
});

function SetupPageContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  const { profile, getLatestProfile } = useProfile();
  
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
