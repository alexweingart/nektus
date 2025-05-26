'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

// Use dynamic import to ensure component is loaded correctly
const EditProfile = dynamic(() => import('../components/EditProfile'), {
  ssr: false,
  loading: () => <div className="flex h-screen items-center justify-center">Loading profile editor...</div>
});

export default function EditPage() {
  const { data: session, status } = useSession();
  
  // Show loading state while session is loading
  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  
  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    redirect('/');
  }
  
  // Wrap in error boundary for better debugging
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading profile editor...</div>}>
      <EditProfile />
    </Suspense>
  );
}
