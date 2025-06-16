'use client';

import { useSession } from 'next-auth/react';
import dynamicImport from 'next/dynamic';
import { Suspense } from 'react';
import { useProfile } from './context/ProfileContext';
import { useViewportLock } from '@/lib/utils/useViewportLock';
import { useBodyBackgroundImage } from '@/lib/utils/useBodyBackgroundImage';

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

  // Get background image URL and set it on body::before
  const backgroundImageUrl = streamingBackgroundImage || currentProfile?.backgroundImage;
  useBodyBackgroundImage(session ? backgroundImageUrl : undefined);

  // Show loading state while checking auth status
  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  // Show profile view if authenticated (within scroll container), otherwise show welcome screen without internal scroll
  if (session) {
    return (
      <div className="page-container">
        <Suspense fallback={<div className="flex h-full items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>}>
          <ProfileView />
        </Suspense>
      </div>
    );
  }
  // Unauthenticated home page - render at body level so pull-to-refresh works
  return <HomePage />;
}
