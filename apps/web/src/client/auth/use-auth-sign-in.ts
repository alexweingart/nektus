'use client';

import { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { isIOSPlatform, isAndroidPlatform } from '@/client/platform-detection';

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
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string; select_by: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            isDismissedMoment: () => boolean;
            getNotDisplayedReason: () => string;
            getSkippedReason: () => string;
            getDismissedReason: () => string;
          }) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface UseAuthSignInOptions {
  callbackUrl?: string;
}

export function useAuthSignIn(options?: UseAuthSignInOptions) {
  const [showAppleSignIn, setShowAppleSignIn] = useState(false);
  const [showGoogleOneTap, setShowGoogleOneTap] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);
  const [isGoogleOneTapSigningIn, setIsGoogleOneTapSigningIn] = useState(false);

  // Detect platform on client-side for native sign-in experiences
  // iOS → Apple Sign-In popup, Android → Google One Tap bottom sheet
  // Apple requires real domains (no localhost or .ts.net), so we use:
  // - Production: www.nekt.us, nekt.us, *.vercel.app
  // - Local dev: local.nekt.us (add to /etc/hosts -> 127.0.0.1, register with Apple)
  // Tailscale and plain localhost fall back to Google sign-in redirect
  // Debug: add ?forceApple=true or ?forceOneTap=true to URL to test on any platform
  useEffect(() => {
    const hostname = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    const forceApple = urlParams.get('forceApple') === 'true';
    const forceOneTap = urlParams.get('forceOneTap') === 'true';

    const isProduction = hostname === 'nekt.us' || hostname === 'www.nekt.us' || hostname.endsWith('.vercel.app');
    const isLocalAppleDev = hostname === 'local.nekt.us';
    const isTailscaleDev = hostname.endsWith('.ts.net');
    const isIOS = isIOSPlatform();
    const isAndroid = isAndroidPlatform();

    setShowAppleSignIn(forceApple || (isIOS && (isProduction || isLocalAppleDev)));
    setShowGoogleOneTap(forceOneTap || (isAndroid && (isProduction || isLocalAppleDev || isTailscaleDev)));
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

      console.log('[Apple Sign-In] Initializing with:', { clientId, redirectURI, hostname, protocol });
      alert(`[DEBUG] clientId: ${clientId}\nredirectURI: ${redirectURI}`);

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
      await signIn('apple', {
        firebaseToken: data.firebaseToken,
        userId: data.userId,
        name: data.user?.name || '',
        email: data.user?.email || '',
        callbackUrl,
        redirect: true,
      });
    } catch (error) {
      console.error('[useAuthSignIn] Apple sign-in failed:', error);
      try { alert(`[DEBUG] Apple error: ${JSON.stringify(error)}`); } catch { alert(`[DEBUG] Apple error keys: ${Object.keys(error as Record<string, unknown>).join(', ')} | message: ${(error as Record<string, unknown>).message || (error as Record<string, unknown>).error}`); }
      setIsAppleSigningIn(false);
    }
  }, [isAppleSigningIn, options?.callbackUrl]);

  // Handle Google One Tap for Android
  // Races the One Tap flow against a 5s timeout, falls back to redirect on any failure
  const handleGoogleOneTap = useCallback(async () => {
    if (isGoogleOneTapSigningIn) return;

    setIsGoogleOneTapSigningIn(true);

    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('One Tap timed out')), 5000);
    });

    try {
      // Clear Google One Tap cooldown cookie
      document.cookie = 'g_state=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';

      const credential = await Promise.race([
        (async () => {
          if (!window.google?.accounts?.id) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://accounts.google.com/gsi/client';
              script.onload = () => resolve();
              script.onerror = () => reject(new Error('Failed to load GIS SDK'));
              document.head.appendChild(script);
            });
          }

          if (!window.google?.accounts?.id) {
            throw new Error('Google Identity Services SDK failed to load');
          }

          const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
          if (!clientId) {
            throw new Error('Google Client ID not configured');
          }

          return new Promise<string>((resolve, reject) => {
            try {
              window.google!.accounts.id.initialize({
                client_id: clientId,
                callback: (response) => {
                  if (response.credential) {
                    resolve(response.credential);
                  } else {
                    reject(new Error('No credential in Google One Tap response'));
                  }
                },
                auto_select: true,
                cancel_on_tap_outside: false,
                use_fedcm_for_prompt: false,
              });
            } catch (e) {
              reject(e);
              return;
            }

            window.google!.accounts.id.prompt((notification) => {
              if (notification.isNotDisplayed()) {
                clearTimeout(timeoutId);
                reject(new Error(`One Tap not displayed: ${notification.getNotDisplayedReason()}`));
              } else if (notification.isSkippedMoment()) {
                clearTimeout(timeoutId);
                reject(new Error(`One Tap skipped: ${notification.getSkippedReason()}`));
              } else if (notification.isDismissedMoment()) {
                clearTimeout(timeoutId);
                reject(new Error(`One Tap dismissed: ${notification.getDismissedReason()}`));
              } else {
                // Display moment — prompt is visible, cancel the timeout
                clearTimeout(timeoutId);
              }
            });
          });
        })(),
        timeoutPromise,
      ]);

      const backendResponse = await fetch('/api/auth/mobile-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleIdToken: credential }),
      });

      if (!backendResponse.ok) {
        const error = await backendResponse.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${backendResponse.status}`);
      }

      const data = await backendResponse.json();

      const callbackUrl = options?.callbackUrl ?? (data.needsSetup ? '/setup' : '/');
      await signIn('google-onetap', {
        firebaseToken: data.firebaseToken,
        userId: data.userId,
        name: data.user?.name || '',
        email: data.user?.email || '',
        image: data.user?.image || '',
        callbackUrl,
        redirect: true,
      });
    } catch (error) {
      console.error('[useAuthSignIn] Google One Tap failed:', error);
      setIsGoogleOneTapSigningIn(false);
      console.log('[useAuthSignIn] Falling back to Google redirect sign-in');
      handleSignIn();
    }
  }, [isGoogleOneTapSigningIn, handleSignIn, options?.callbackUrl]);

  return {
    showAppleSignIn,
    showGoogleOneTap,
    isAppleSigningIn,
    isGoogleOneTapSigningIn,
    handleSignIn,
    handleAppleSignIn,
    handleGoogleOneTap,
  };
}
