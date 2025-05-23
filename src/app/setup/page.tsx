'use client';

import React, { useEffect } from 'react';
import ProfileSetup from '../components/ProfileSetup';
import { useSearchParams } from 'next/navigation';

export default function SetupPage() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  
  // Log any errors for debugging
  useEffect(() => {
    if (error) {
      console.error('Authentication error:', error);
    }
  }, [error]);
  
  return (
    <>
      {error && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          padding: '10px',
          backgroundColor: 'red',
          color: 'white',
          zIndex: 1000,
          textAlign: 'center'
        }}>
          Error with Google sign-in. Please try again later. Error: {error}
        </div>
      )}
      <ProfileSetup />
    </>
  );
}
