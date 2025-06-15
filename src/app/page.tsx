'use client';

import { useSession } from 'next-auth/react';
import dynamicImport from 'next/dynamic';
import { useEffect, Suspense } from 'react';
import { useProfile } from './context/ProfileContext';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Dynamically import components to prevent hydration issues
const HomePage = dynamicImport(() => import('./components/HomePage'), { 
  ssr: false,
  loading: () => <div className="min-h-screen" /> // No background color - let parent handle it
});

const ProfileView = dynamicImport(() => import('./components/ProfileView'), { 
  ssr: false,
  loading: () => <div className="min-h-screen" /> // No background color - let parent handle it
});

export default function Home() {
  const { data: session, status } = useSession();
  const { profile, getLatestProfile, streamingBackgroundImage } = useProfile();
  const isLoading = status === 'loading';
  
  // Get the latest profile including streaming background image
  const currentProfile = getLatestProfile() || profile;

  // Handle scroll behavior based on authentication state
  useEffect(() => {
    if (isLoading) return;
    
    if (!session) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [session, isLoading]);

  // Determine background style - use streaming image first, then profile background
  const backgroundImageUrl = streamingBackgroundImage || currentProfile?.backgroundImage;
  
  const backgroundStyle = session && backgroundImageUrl ? {
    backgroundImage: `url(${backgroundImageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#004D40' // Theme background color that shows while image loads
  } : {
    backgroundColor: '#004D40' // Theme background for welcome screen
  };

  // Show loading state while checking auth status with consistent background
  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen"
        style={backgroundStyle}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // Show profile view if authenticated, otherwise show welcome screen
  // Apply background style to the container to ensure it persists during dynamic loading
  return (
    <div 
      className="min-h-screen"
      style={backgroundStyle}
    >
      <Suspense fallback={<div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>}>
        {session ? <ProfileView /> : <HomePage />}
      </Suspense>
    </div>
  );
}
