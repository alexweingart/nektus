import React, { useState } from 'react';
import { useAdminModeActivator } from '../ui/banners/AdminBanner';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../ui/buttons/Button';
import { Text } from '../ui/Typography';
import { useAuthSignIn } from '@/client/auth/use-auth-sign-in';

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
      © 2026 Nekt, Inc.
    </div>
  </div>
  );
};

// Component handles just the welcome screen
const HomePage: React.FC = () => {
  const adminModeProps = useAdminModeActivator();
  const [showAppClip] = useState(false);

  const {
    showAppleSignIn,
    isAppleSigningIn,
    handleSignIn,
    handleAppleSignIn,
  } = useAuthSignIn();

  const handleGetStarted = () => {
    openAppClip();
  };

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
        <Text variant="base" className="text-center w-full mb-3 text-2xl">
          Conversations → Friendships
        </Text>
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
            icon={<Image src="/icons/auth/apple.svg" alt="" width={24} height={24} />}
            disabled={isAppleSigningIn}
          >
            {isAppleSigningIn ? 'Signing in...' : 'Sign in with Apple'}
          </Button>
        ) : (
          // Desktop/fallback: Google Sign-in via redirect
          <Button
            variant="white"
            size="xl"
            className="w-full mb-2"
            onClick={handleSignIn}
            icon={<Image src="/icons/auth/google.svg" alt="" width={18} height={18} />}
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
