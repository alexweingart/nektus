'use client';

import React from 'react';
import ProfileSetup from '../components/ProfileSetup';
import { useSearchParams } from 'next/navigation';

export default function SetupPage() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  
  // Simple error display
  return (
    <>
      {error && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          padding: '16px',
          backgroundColor: 'red',
          color: 'white',
          zIndex: 1000,
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '16px'
        }}>
          There was a problem with Google sign-in. Please try again.
        </div>
      )}
      <ProfileSetup />
    </>
  );
}
