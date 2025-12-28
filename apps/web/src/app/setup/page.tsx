'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '../context/ProfileContext';
import ProfileSetupView from '../components/views/ProfileSetupView';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function SetupPageContent() {
  const { data: session, status } = useSession();
  const { isNavigatingFromSetup } = useProfile();
  const router = useRouter();

  const isLoading = status === 'loading';

  // Handle redirects in useEffect to avoid setState during render
  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/');
    }
  }, [isLoading, session, router]);

  if (isLoading) {
    return null;
  }

  if (session) {
    // Don't render ProfileSetupView if we're navigating away - prevents unnecessary renders
    if (isNavigatingFromSetup) {
      return null;
    }

    return (
      <div className="flex flex-col items-center px-4 py-2">
        <ProfileSetupView />
      </div>
    );
  }

  // Show loading state while redirect is happening
  return null;
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <SetupPageContent />
    </Suspense>
  );
}
