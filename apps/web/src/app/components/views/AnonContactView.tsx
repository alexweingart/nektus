/**
 * AnonContactView component - Teaser profile for unauthenticated users who scan QR codes
 * Shows limited profile data with sign-in prompt
 * Uses Sign in with Apple on iOS, Sign in with Google on other platforms
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '../ui/buttons/Button';
import { Text } from '../ui/Typography';
import { StandardModal } from '../ui/modals/StandardModal';
import Avatar from '../ui/elements/Avatar';
import SocialIcon from '../ui/elements/SocialIcon';
import type { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/client/profile/transforms';
import { getOptimalProfileImageUrl } from '@/client/profile/image';
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

interface AnonContactViewProps {
  profile: UserProfile;
  socialIconTypes: string[];
  token: string;
}

// Google icon SVG component (from HomePage)
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12 0-6.627 5.373-12 12-12 3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24c0 11.045 8.955 20 20 20 11.045 0 20-8.955 20-20 0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
    <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
  </svg>
);

// Apple icon SVG component (dark to match white button style)
const AppleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#111827">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

// Map icon type to display name
const getSocialDisplayName = (type: string) => {
  const names: Record<string, string> = {
    instagram: 'Instagram',
    x: 'X',
    twitter: 'X',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    snapchat: 'Snapchat',
    telegram: 'Telegram',
    github: 'GitHub',
    whatsapp: 'WhatsApp',
    phone: 'phone number',
    email: 'email'
  };
  return names[type] || type;
};

export const AnonContactView: React.FC<AnonContactViewProps> = ({
  profile,
  socialIconTypes,
  token
}) => {
  const [showEagerBeaverModal, setShowEagerBeaverModal] = useState(false);
  const [clickedSocial, setClickedSocial] = useState<string>('');
  const [showAppleSignIn, setShowAppleSignIn] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);

  const name = getFieldValue(profile.contactEntries, 'name') || 'User';
  const bio = getFieldValue(profile.contactEntries, 'bio') || 'Welcome to my profile!';

  // Detect iOS on client-side for Sign in with Apple
  useEffect(() => {
    const hostname = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    const forceApple = urlParams.get('forceApple') === 'true';

    const isProduction = hostname === 'nekt.us' || hostname === 'www.nekt.us' || hostname.endsWith('.vercel.app');
    const isLocalAppleDev = hostname === 'local.nekt.us';
    const isIOS = isIOSPlatform();

    // Show Apple sign-in on iOS for production and local.nekt.us, or if forceApple=true
    setShowAppleSignIn(forceApple || (isIOS && (isProduction || isLocalAppleDev)));
  }, []);

  const handleSocialIconClick = (iconType: string) => {
    setClickedSocial(iconType);
    setShowEagerBeaverModal(true);
  };

  const handleSignIn = () => {
    // Preserve token through OAuth via callbackUrl
    signIn('google', {
      callbackUrl: `/x/${token}`
    });
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

      let origin = `${protocol}//${hostname}`;
      if (port && port !== '443' && port !== '80') {
        origin += `:${port}`;
      }
      const redirectURI = `${origin}/api/auth/apple-callback`;

      // Generate random state for CSRF protection
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
      // Redirect back to this contact page after auth
      await signIn('apple', {
        firebaseToken: data.firebaseToken,
        userId: data.userId,
        name: data.user?.name || '',
        email: data.user?.email || '',
        callbackUrl: `/x/${token}`,
        redirect: true,
      });
    } catch (error) {
      console.error('[AnonContactView] Apple sign-in failed:', error);
      setIsAppleSigningIn(false);
    }
  }, [isAppleSigningIn, token]);

  return (
    <div className="flex flex-col items-center px-4 py-2 relative z-[1001] min-h-dvh">

      {/* Fixed Content Area - matches ContactView structure */}
      <div className="w-full max-w-[var(--max-content-width,448px)] flex flex-col items-center justify-center flex-1 overflow-hidden">

        {/* Profile Card - matches ContactInfo structure */}
        <div className="w-full flex flex-col items-center">
          {/* Profile Image */}
          <div className="mb-4">
            <div className="border-4 border-white shadow-lg rounded-full">
              <Avatar
                src={getOptimalProfileImageUrl(profile.profileImage, 256)}
                alt={name}
                size="lg"
              />
            </div>
          </div>

          {/* Content with blur background - matches ContactInfo */}
          <div className="w-full bg-black/60 backdrop-blur-lg px-6 py-4 rounded-2xl" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
            {/* Name */}
            <div className="text-center mb-4">
              <h1 className="text-white text-2xl font-bold">{name}</h1>
            </div>

            {/* Bio */}
            <div className="text-center mb-6">
              <div className="text-white text-sm leading-relaxed">
                <Text variant="small" className="leading-relaxed">
                  {bio}
                </Text>
              </div>
            </div>

            {/* Social Icons - non-clickable, trigger modal */}
            {socialIconTypes.length > 0 && (
              <div className="w-full mb-4">
                <div className="flex flex-wrap justify-center gap-3">
                  {socialIconTypes.map((iconType) => (
                    <SocialIcon
                      key={iconType}
                      platform={iconType}
                      size="md"
                      variant="white"
                      onClick={() => handleSocialIconClick(iconType)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons - matches ContactView spacing */}
        <div className="w-full mt-4 mb-4 space-y-3" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
          {/* Sign in button - Apple on iOS, Google on other platforms */}
          {showAppleSignIn ? (
            <Button
              variant="white"
              size="xl"
              onClick={handleAppleSignIn}
              className="w-full mb-2"
              icon={<AppleIcon />}
              disabled={isAppleSigningIn}
            >
              {isAppleSigningIn ? 'Signing in...' : 'Sign in with Apple'}
            </Button>
          ) : (
            <Button
              variant="white"
              size="xl"
              onClick={handleSignIn}
              className="w-full mb-2"
              icon={<GoogleIcon />}
            >
              Sign in with Google
            </Button>
          )}

          {/* "to get nekt'd" text */}
          <Text variant="small" className="text-center text-sm text-white/70">
            to get nekt&apos;d
          </Text>
        </div>
      </div>

      {/* Eager Beaver Modal */}
      <StandardModal
        isOpen={showEagerBeaverModal}
        onClose={() => setShowEagerBeaverModal(false)}
        title="Eager Beaver, eh?"
        subtitle={`Sign in to view ${name}'s ${getSocialDisplayName(clickedSocial)}`}
        showCloseButton={false}
        primaryButtonText={showAppleSignIn ? 'Sign in with Apple' : 'Sign in with Google'}
        primaryButtonIcon={showAppleSignIn ? <AppleIcon /> : <GoogleIcon />}
        onPrimaryButtonClick={showAppleSignIn ? handleAppleSignIn : handleSignIn}
        secondaryButtonText="Cancel"
      />
    </div>
  );
};
