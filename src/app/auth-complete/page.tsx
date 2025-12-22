'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Heading } from '../components/ui/Typography';
import { Button } from '../components/ui/buttons/Button';

export default function AuthCompletePage() {
  const { data: session, status } = useSession();

  // Auto-redirect if user opened this in the PWA somehow
  useEffect(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    if (isPWA && session) {
      window.location.href = '/';
    }
  }, [session]);

  const handleReturnToApp = () => {
    // Close this tab if possible
    window.close();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'loading' ? (
          <>
            <Heading as="h1" className="text-white">
              Completing Sign-In...
            </Heading>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          </>
        ) : session ? (
          <>
            <div className="text-6xl mb-4">✓</div>
            <Heading as="h1" className="text-white mb-4">
              Sign-In Complete!
            </Heading>
            <p className="text-white text-lg mb-6">
              You&apos;ve successfully signed in to Nekt.
            </p>
            <div className="space-y-4">
              <p className="text-white/80">
                Please return to the Nekt app to continue.
              </p>
              <p className="text-sm text-white/60">
                (You can close this browser tab)
              </p>
              <Button
                variant="white"
                size="lg"
                onClick={handleReturnToApp}
                className="w-full"
              >
                Close This Tab
              </Button>
            </div>
          </>
        ) : (
          <>
            <Heading as="h1" className="text-white mb-4">
              Authentication Required
            </Heading>
            <p className="text-white text-lg">
              Please sign in to continue.
            </p>
            <Button
              variant="white"
              size="lg"
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Go to Sign In
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
