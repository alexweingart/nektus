'use client';

import React from 'react';
import ProfileSetup from '../components/ProfileSetup';
import { useSearchParams } from 'next/navigation';

export default function SetupPage() {
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
