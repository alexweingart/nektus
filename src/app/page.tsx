'use client';

import { useSession } from 'next-auth/react';
import dynamicImport from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import { useProfile } from './context/ProfileContext';
import { useViewportLock } from '@/lib/utils/useViewportLock';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Dynamically import components to prevent hydration issues
const HomePage = dynamicImport(() => import('./components/HomePage'), { 
  ssr: false,
  loading: () => <div className="min-h-screen" />
});

const ProfileView = dynamicImport(() => import('./components/ProfileView'), { 
  ssr: false,
  loading: () => <div className="min-h-screen" />
});

export default function Home() {
  const { data: session, status } = useSession();
  const { profile, getLatestProfile, streamingBackgroundImage } = useProfile();
  const isLoading = status === 'loading';
  
  // Get the latest profile including streaming background image
  const currentProfile = getLatestProfile() || profile;

  // Use viewport lock with pull-to-refresh for authenticated users
  useViewportLock({
    enablePullToRefresh: !!session
  });

  // Get background image URL for safe area background
  const backgroundImageUrl = streamingBackgroundImage || currentProfile?.backgroundImage;

  // Add body class when using safe area background
  useEffect(() => {
    if (session && backgroundImageUrl) {
      document.body.classList.add('has-safe-area-background');
      // Prevent horizontal scrollbar
      document.body.style.overflowX = 'hidden';
    } else {
      document.body.classList.remove('has-safe-area-background');
      document.body.style.overflowX = '';
    }

    return () => {
      document.body.classList.remove('has-safe-area-background');
      document.body.style.overflowX = '';
    };
  }, [session, backgroundImageUrl]);

  // Show loading state while checking auth status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // Show profile view if authenticated, otherwise show welcome screen
  return (
    <>
      {/* Safe area background element */}
      {session && (
        <div 
          className="safe-area-background"
          style={{
            backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : 'none',
            backgroundColor: '#004D40'
          }}
        />
      )}
      
      <div className="min-h-screen">
        <Suspense fallback={<div className="flex h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>}>
          {session ? <ProfileView /> : <HomePage />}
        </Suspense>
      </div>
    </>
  );
}
