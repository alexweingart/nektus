import React, { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useAdminModeActivator } from '../ui/banners/AdminBanner';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../ui/buttons/Button';
import { Heading, Text } from '../ui/Typography';
import { isIOSPlatform } from '@/client/platform-detection';

// Apple JS SDK type declarations
declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope?: string;
          redirectURI: string;
          usePopup?: boolean;
          state?: string;
        }) => void;
        signIn: () => Promise<{
          authorization: {
            id_token: string;
            code: string;
          };
          user?: {
            name?: {
              firstName?: string;
              lastName?: string;
            };
            email?: string;
          };
        }>;
      };
    };
  }
}

/**
 * Open the App Clip for iOS users
 * Uses the Smart App Banner meta tag approach or direct URL
 */
function openAppClip() {
  // Navigate to /onboarding to trigger the App Clip card
  // iOS shows the App Clip card when navigating to a new URL
  // The /onboarding page shows identical content, so the transition is seamless
  window.location.href = '/onboarding';
}

// Footer component exported separately so it can be rendered as a sibling to HomePage
export const HomeFooter: React.FC = () => {

  return (
    <div
      className="fixed left-0 right-0 text-center text-sm text-white"
      style={{
        bottom: 0,
        paddingBottom: '32px',
        backgroundColor: 'transparent'
      }}
    >
    <div className="mb-2">
      <Link href="/about" className="font-bold hover:text-gray-300 transition-colors">
        About
      </Link>
      <span className="mx-2">|</span>
      <Link href="/privacy" className="font-bold hover:text-gray-300 transition-colors">
        Privacy
      </Link>
      <span className="mx-2">|</span>
      <Link href="/terms" className="font-bold hover:text-gray-300 transition-colors">
        Terms
      </Link>
    </div>
    <div className="text-xs text-gray-300">
      © 2025 Nekt, Inc. All rights reserved.
    </div>
  </div>
  );
};

// Google icon SVG component
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12 0-6.627 5.373-12 12-12 3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24c0 11.045 8.955 20 20 20 11.045 0 20-8.955 20-20 0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
    <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
  </svg>
);

// Apple icon SVG component (dark to match white button style)
// Larger than Google (24 vs 18) to account for stem whitespace
const AppleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#111827">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

// Component handles just the welcome screen
const HomePage: React.FC = () => {
  const adminModeProps = useAdminModeActivator();
  const [showAppClip, setShowAppClip] = useState(false);
  const [showAppleSignIn, setShowAppleSignIn] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);

  // Detect iOS on client-side for Sign in with Apple
  // Apple requires real domains (no localhost or .ts.net), so we use:
  // - Production: www.nekt.us, nekt.us, *.vercel.app
  // - Local dev: local.nekt.us (add to /etc/hosts -> 127.0.0.1, register with Apple)
  // Tailscale and plain localhost fall back to Google sign-in
  // Debug: add ?forceApple=true to URL to test Apple button on any platform
  useEffect(() => {
    const hostname = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    const forceApple = urlParams.get('forceApple') === 'true';

    const isProduction = hostname === 'nekt.us' || hostname === 'www.nekt.us' || hostname.endsWith('.vercel.app');
    const isLocalAppleDev = hostname === 'local.nekt.us'; // For testing Apple sign-in locally
    const isIOS = isIOSPlatform();

    // Show Apple sign-in on iOS for production and local.nekt.us, or if forceApple=true
    setShowAppleSignIn(forceApple || (isIOS && (isProduction || isLocalAppleDev)));
    // App Clip flow disabled for now (was for iOS 17+ localhost testing)
    setShowAppClip(false);
  }, []);

  const handleSignIn = async () => {
    // Check iOS PWA on every click (more reliable than state)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSDeviceCheck = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isStandalone && isIOSDeviceCheck) {
      // For iOS PWA: Navigate directly to Google OAuth, bypassing NextAuth sign-in page
      // This avoids the external redirect issue in PWA context
      const callbackUrl = `${window.location.origin}/api/auth/callback/google`;

      // Build Google OAuth URL directly
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '')}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent('openid email profile')}` +
        `&access_type=offline` +
        `&prompt=select_account`;

      window.location.href = googleAuthUrl;
      return;
    }

    // Standard sign-in for non-PWA
    signIn('google');
  };

  const handleGetStarted = () => {
    // Trigger App Clip for iOS users
    openAppClip();
  };

  // Handle Sign in with Apple for iOS Safari
  const handleAppleSignIn = useCallback(async () => {
    if (isAppleSigningIn) return;

    setIsAppleSigningIn(true);
    try {
      // Load Apple JS SDK dynamically
      if (!window.AppleID) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Apple JS SDK'));
          document.head.appendChild(script);
        });
      }

      // Initialize Apple JS SDK
      const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || 'com.nektus.web.signin';

      // Build redirectURI - must match exactly what's registered in Apple Developer Portal
      const hostname = window.location.hostname;
      const port = window.location.port;
      const protocol = window.location.protocol;

      // Construct origin explicitly to handle port correctly
      let origin = `${protocol}//${hostname}`;
      if (port && port !== '443' && port !== '80') {
        origin += `:${port}`;
      }
      const redirectURI = `${origin}/api/auth/apple/callback`;

      console.log('[Apple Sign-In] Initializing with:', { clientId, redirectURI });

      // Generate random state for CSRF protection
      const state = crypto.randomUUID();

      // Verify SDK loaded successfully
      if (!window.AppleID) {
        throw new Error('Apple JS SDK failed to load');
      }

      window.AppleID.auth.init({
        clientId,
        scope: 'name email',
        redirectURI,
        usePopup: true, // Native-feeling auth sheet on iOS Safari
        state,
      });

      // Trigger Apple sign-in
      const response = await window.AppleID.auth.signIn();

      // Exchange the authorization with our backend
      const backendResponse = await fetch('/api/auth/mobile-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appleIdentityToken: response.authorization.id_token,
          appleFullName: response.user ? {
            givenName: response.user.name?.firstName || null,
            familyName: response.user.name?.lastName || null,
          } : undefined,
          appleEmail: response.user?.email || null,
        }),
      });

      if (!backendResponse.ok) {
        const error = await backendResponse.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${backendResponse.status}`);
      }

      const data = await backendResponse.json();

      // Use NextAuth credentials provider to create session
      // The redirect will be handled by NextAuth based on profile setup status
      const redirectPath = data.needsSetup ? '/setup' : '/';
      await signIn('apple', {
        firebaseToken: data.firebaseToken,
        userId: data.userId,
        name: data.user?.name || '',
        email: data.user?.email || '',
        callbackUrl: redirectPath,
        redirect: true,
      });
      // Note: Don't reset isAppleSigningIn on success - the redirect will unmount the component
    } catch (error) {
      console.error('[HomePage] Apple sign-in failed:', error);
      // Only reset loading state on error/cancellation
      setIsAppleSigningIn(false);
      // Don't show alert for user cancellation or Apple-side errors
      // User can see they're still on the sign-in page and try again
      // Only log to console for debugging
    }
  }, [isAppleSigningIn]);

  return (
    <div className="relative">
      {/* Main content */}
      <div className="flex items-start justify-center pt-[10vh]">
        <div
          style={{
            width: '100%',
            maxWidth: 'var(--max-content-width, 448px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            animation: 'fadeIn 0.3s ease-out forwards',
            padding: '0 1rem'
          }}
        >
        <div 
          style={{ 
            marginBottom: '10px',
            textAlign: 'center',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          {...adminModeProps} // Apply the double-click handler
        >
          <div style={{ maxWidth: '448px', width: '100%' }}>
            <Image 
              src="/nektus-logo.svg" 
              alt="Nekt Logo" 
              width={448}
              height={154} // 448 * (original height/width ratio 110/320 = 0.34375)
              style={{ 
                width: '100%',
                height: 'auto',
                maxWidth: '100%'
              }} 
              priority
            />
          </div>
        </div>
        <Heading as="h1" className="text-center w-full mb-3">
          Conversations → Friendships
        </Heading>
        <Text variant="base" className="text-center text-lg opacity-90 mb-10 px-4">
          Exchange contacts & socials and schedule meetings in seconds
        </Text>

        {showAppClip ? (
          // iOS 17+ on dev: Show "Get Started" button that triggers App Clip
          <Button
            variant="white"
            size="xl"
            className="w-full mb-2"
            onClick={handleGetStarted}
          >
            Get Started
          </Button>
        ) : showAppleSignIn ? (
          // Production iOS: Show Apple Sign-in button (white style to match other buttons)
          <Button
            variant="white"
            size="xl"
            className="w-full mb-2"
            onClick={handleAppleSignIn}
            icon={<AppleIcon />}
            disabled={isAppleSigningIn}
          >
            {isAppleSigningIn ? 'Signing in...' : 'Sign in with Apple'}
          </Button>
        ) : (
          // Non-iOS: Show Google Sign-in button
          <Button
            variant="white"
            size="xl"
            className="w-full mb-2"
            onClick={handleSignIn}
            icon={<GoogleIcon />}
          >
            Sign in with Google
          </Button>
        )}

        <p className="text-center text-sm text-muted-foreground mt-1 mb-5">
          {showAppClip ? 'to get the app' : 'to start nekt\'ing'}
        </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 