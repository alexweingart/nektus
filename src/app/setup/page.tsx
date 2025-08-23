'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '../context/ProfileContext';
import ProfileSetupView from '../components/views/ProfileSetupView';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PullToRefresh } from '../components/ui/PullToRefresh';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function SetupPageContent() {
  const { data: session, status } = useSession();
  const { profile } = useProfile();
  const router = useRouter();

  const handleRefresh = async () => {
    // Reload the page to refresh all data
    window.location.reload();
  };

  const phoneEntry = session?.profile?.contactChannels?.entries?.find((e: { platform?: string; internationalPhone?: string }) => e.platform === 'phone');
  const hasPhone = phoneEntry?.internationalPhone && phoneEntry.internationalPhone.trim() !== '';
                  
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
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex items-center justify-center h-full min-h-dvh">
          <LoadingSpinner size="sm" />
        </div>
      </PullToRefresh>
    );
  }

  if (session && !hasPhone) {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex flex-col items-center px-4 py-2 min-h-dvh">
          <ProfileSetupView />
        </div>
      </PullToRefresh>
    );
  }

  // Show loading state while redirect is happening
  return (
    <PullToRefresh onRefresh={handleRefresh}>
              <div className="flex items-center justify-center h-full min-h-dvh">
        <LoadingSpinner size="sm" />
      </div>
    </PullToRefresh>
  );
}

export default function SetupPage() {
  return (
            <Suspense fallback={<div className="flex items-center justify-center h-full min-h-dvh"><LoadingSpinner size="sm" /></div>}>
      <SetupPageContent />
    </Suspense>
  );
}
