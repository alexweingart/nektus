'use client';

import React, { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '../context/ProfileContext';
import ProfileSetup from '../components/ProfileSetup';
import { isNewUser } from '@/lib/services/newUserService';
import { useViewportLock } from '@/lib/utils/useViewportLock';
import { useBodyBackgroundImage } from '@/lib/utils/useBodyBackgroundImage';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function SetupPageContent() {
  const { data: session, status } = useSession();
  const { getLatestProfile, streamingBackgroundImage } = useProfile();
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  const router = useRouter();

  // Enable pull-to-refresh
  useViewportLock({ enablePullToRefresh: true });
  const currentProfile = getLatestProfile();
  useBodyBackgroundImage(session ? (streamingBackgroundImage || currentProfile?.backgroundImage) : undefined);

  const userIsNew = isNewUser(session);
  const isLoading = status === 'loading';

  // Handle redirects in useEffect to avoid setState during render
  useEffect(() => {
    if (!isLoading && session) {
      if (!userIsNew) {
        router.replace('/');
      }
    } else if (!isLoading && !session) {
      router.replace('/');
    }
  }, [isLoading, session, userIsNew, router]);

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="sm" />
        </div>
      </div>
    );
  }

  if (session && userIsNew) {
    return (
      <div className="page-container">
        <div className="h-[100dvh] overflow-hidden flex flex-col items-center px-4 py-2">
          {error && (
            <div className="fixed top-0 left-0 right-0 p-4 bg-destructive text-white text-center font-bold z-50">
              There was a problem with Google sign-in. Please try again.
            </div>
          )}
          <ProfileSetup />
        </div>
      </div>
    );
  }

  // Show loading state while redirect is happening
  return (
    <div className="page-container">
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="sm" />
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="page-container"><div className="flex items-center justify-center h-full"><LoadingSpinner size="sm" /></div></div>}>
      <SetupPageContent />
    </Suspense>
  );
}
