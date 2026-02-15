'use client';

import { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
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

interface UseAuthSignInOptions {
  callbackUrl?: string;
}

export function useAuthSignIn(options?: UseAuthSignInOptions) {
  const [showAppleSignIn, setShowAppleSignIn] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);

  // Detect platform on client-side for native sign-in experiences
  // iOS → Apple Sign-In popup, all other platforms → Google OAuth redirect
  // Apple requires real domains (no localhost or .ts.net), so we use:
  // - Production: www.nekt.us, nekt.us, *.vercel.app
  // - Local dev: local.nekt.us (add to /etc/hosts -> 127.0.0.1, register with Apple)
  // Tailscale and plain localhost fall back to Google sign-in redirect
  // Debug: add ?forceApple=true to URL to test on any platform
  useEffect(() => {
    const hostname = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    const forceApple = urlParams.get('forceApple') === 'true';

    const isProduction = hostname === 'nekt.us' || hostname === 'www.nekt.us' || hostname.endsWith('.vercel.app');
    const isLocalAppleDev = hostname === 'local.nekt.us';
    const isIOS = isIOSPlatform();

    setShowAppleSignIn(forceApple || (isIOS && (isProduction || isLocalAppleDev)));
  }, []);

  const handleSignIn = useCallback(async () => {
    // Check iOS PWA on every click (more reliable than state)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSDeviceCheck = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isStandalone && isIOSDeviceCheck) {
      // For iOS PWA: Navigate directly to Google OAuth, bypassing NextAuth sign-in page
      const callbackUrl = `${window.location.origin}/api/auth/callback/google`;
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
    signIn('google', options?.callbackUrl ? { callbackUrl: options.callbackUrl } : undefined);
  }, [options?.callbackUrl]);

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

      const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || 'com.nektus.web.signin';

      // Build redirectURI - must match exactly what's registered in Apple Developer Portal
      const hostname = window.location.hostname;
      const port = window.location.port;
      const protocol = window.location.protocol;
      let origin = `${protocol}//${hostname}`;
      if (port && port !== '443' && port !== '80') {
        origin += `:${port}`;
      }
      const redirectURI = `${origin}/api/auth/apple/callback`;

      const state = crypto.randomUUID();

      if (!window.AppleID) {
        throw new Error('Apple JS SDK failed to load');
      }

      window.AppleID.auth.init({
        clientId,
        scope: 'name email',
        redirectURI,
        usePopup: true,
        state,
      });

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

      const callbackUrl = options?.callbackUrl ?? (data.needsSetup ? '/setup' : '/');
      const result = await signIn('apple', {
        firebaseToken: data.firebaseToken,
        userId: data.userId,
        name: data.user?.name || '',
        email: data.user?.email || '',
        redirect: false,
      });

      if (result?.ok) {
        window.location.href = callbackUrl;
      } else {
        throw new Error(result?.error || 'Sign-in failed');
      }
    } catch (error) {
      console.error('[useAuthSignIn] Apple sign-in failed:', error);
      // Don't show alert for user cancellation — user can see they're still on sign-in page
      setIsAppleSigningIn(false);
    }
  }, [isAppleSigningIn, options?.callbackUrl]);

  return {
    showAppleSignIn,
    isAppleSigningIn,
    handleSignIn,
    handleAppleSignIn,
  };
}
