'use client';

import React, { useEffect } from 'react';
import ProfileSetup from '../components/ProfileSetup';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function SetupPage() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  const callbackUrl = searchParams?.get('callbackUrl');
  const { status } = useSession();
  
  // Enhanced error logging for OAuth issues
  useEffect(() => {
    if (error) {
      console.error('Authentication error:', error);
      console.error('Callback URL:', callbackUrl);
      console.error('Auth Status:', status);
      
      // Log additional browser info for debugging
      console.log('User Agent:', navigator.userAgent);
      console.log('Current URL:', window.location.href);
    }
  }, [error, callbackUrl, status]);
  
  // Display more user-friendly error message based on error type
  const getErrorMessage = () => {
    if (error === 'OAuthCallback') {
      return 'There was a problem with Google sign-in. Please try again or use a different method.';
    }
    if (error === 'AccessDenied') {
      return 'You denied access to your Google account. Please try again and allow the requested permissions.';
    }
    return `Error with Google sign-in. Please try again later. (${error})`;
  };
  
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
          {getErrorMessage()}
        </div>
      )}
      <ProfileSetup />
    </>
  );
}
