'use client';

import { useSession } from 'next-auth/react';
import dynamicImport from 'next/dynamic';
import { Suspense } from 'react';
import { useProfile } from './context/ProfileContext';
import { useViewportLock } from '@/lib/utils/useViewportLock';
import { useHtmlBackground } from '@/lib/utils/useHtmlBackground';

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

  // Use viewport lock with pull-to-refresh for authenticated users
  useViewportLock({
    enablePullToRefresh: !!session
  });

  // Set background image on HTML element for safe area coverage
  const backgroundImageUrl = streamingBackgroundImage || currentProfile?.backgroundImage;
  useHtmlBackground({
    backgroundImage: session ? backgroundImageUrl : null,
    fallbackColor: '#004D40'
  });
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
    <div className="min-h-screen">
      <Suspense fallback={<div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>}>
        {session ? <ProfileView /> : <HomePage />}
      </Suspense>
    </div>
  );
}
