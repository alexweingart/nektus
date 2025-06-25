'use client';

import React, { Suspense, useEffect } from 'react';
import dynamicImport from 'next/dynamic';
import { useProfile } from '../context/ProfileContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Use dynamic import to ensure component is loaded correctly
const EditProfileView = dynamicImport(() => import('../components/views/EditProfileView'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="sm" />
    </div>
  ),
});

export default function EditPage() {
  const { profile, getLatestProfile } = useProfile();
  
  // Enable scrolling on edit page only
  useEffect(() => {
    document.body.classList.add('allow-scroll');
    return () => {
      document.body.classList.remove('allow-scroll');
    };
  }, []);
  
  // Wrap in error boundary for better debugging
  return (
    <div className="min-h-screen">
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center">
          <LoadingSpinner size="sm" />
        </div>
      }>
        <EditProfileView />
      </Suspense>
    </div>
  );
}
