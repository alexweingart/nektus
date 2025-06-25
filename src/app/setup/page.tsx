'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '../context/ProfileContext';
import ProfileSetupView from '../components/views/ProfileSetupView';
import { isNewUser } from '@/lib/services/newUserService';
import { useViewportLock } from '@/lib/hooks/useViewportLock';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function SetupPageContent() {
  const { data: session, status } = useSession();
  const { profile } = useProfile();
  const router = useRouter();

  // Enable pull-to-refresh
  useViewportLock({ enablePullToRefresh: true });

  const userIsNew = isNewUser(session);
  const hasPhone = session?.profile?.contactChannels?.phoneInfo?.internationalPhone &&
                  session.profile.contactChannels.phoneInfo.internationalPhone.trim() !== '';
                  
  const isLoading = status === 'loading' || (status === 'authenticated' && !profile);

  // Handle redirects in useEffect to avoid setState during render
  useEffect(() => {
    if (!isLoading && session) {
      if (hasPhone) {
        router.replace('/');
      }
    } else if (!isLoading && !session) {
      router.replace('/');
    }
  }, [isLoading, session, hasPhone, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (session && !hasPhone) {
    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col items-center px-4 py-2">
        <ProfileSetupView />
      </div>
    );
  }

  // Show loading state while redirect is happening
  return (
    <div className="flex items-center justify-center h-full min-h-screen">
      <LoadingSpinner size="sm" />
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full min-h-screen"><LoadingSpinner size="sm" /></div>}>
      <SetupPageContent />
    </Suspense>
  );
}
