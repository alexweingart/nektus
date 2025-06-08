'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { useProfile } from '../context/ProfileContext';

// Use dynamic import to ensure component is loaded correctly
const EditProfile = dynamic(() => import('../components/EditProfile'), {
  ssr: false,
  loading: () => <div className="min-h-screen" /> // No background color - let parent handle it
});

export default function EditPage() {
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
  
  // Wrap in error boundary for better debugging
  return (
    <div className="min-h-screen" style={backgroundStyle}>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      }>
        <EditProfile />
      </Suspense>
    </div>
  );
}
