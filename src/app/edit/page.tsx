'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

// Use dynamic import to ensure component is loaded correctly
const EditProfile = dynamic(() => import('../components/EditProfileNew'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
});

export default function EditPage() {
  const { data: session, status } = useSession();
  
  // Show loading state while session is loading
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    redirect('/');
  }
  
  // Wrap in error boundary for better debugging
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    }>
      <EditProfile />
    </Suspense>
  );
}
