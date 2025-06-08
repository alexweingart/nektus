'use client';

import React, { Suspense } from 'react';
import ProfileSetup from '../components/ProfileSetup';
import { useSearchParams } from 'next/navigation';

function SetupPageContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  
  return (
    <>
      {error && (
        <div className="fixed top-0 left-0 right-0 p-4 bg-destructive text-white text-center font-bold z-50">
          There was a problem with Google sign-in. Please try again.
        </div>
      )}
      <ProfileSetup />
    </>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <SetupPageContent />
    </Suspense>
  );
}
