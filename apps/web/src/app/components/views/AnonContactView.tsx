/**
 * AnonContactView component - Teaser profile for unauthenticated users who scan QR codes
 * Shows limited profile data with sign-in prompt
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { Text } from '../ui/Typography';
import { StandardModal } from '../ui/modals/StandardModal';
import { ParticleNetwork } from '../ui/layout/ParticleNetwork';
import Avatar from '../ui/elements/Avatar';
import SocialIcon from '../ui/elements/SocialIcon';
import type { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/client/profile/transforms';

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

/**
 * Convert hex color to rgba with alpha
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Convert background colors to ParticleNetwork colors
 */
function convertToParticleColors(backgroundColors: string[]) {
  const [dominant, accent1, accent2] = backgroundColors;

  return {
    gradientStart: hexToRgba(accent1, 0.4),
    gradientEnd: dominant,
    particle: hexToRgba(accent2, 0.8),
    connection: hexToRgba(accent2, 0.4)
  };
}

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

  const name = getFieldValue(profile.contactEntries, 'name') || 'User';
  const bio = getFieldValue(profile.contactEntries, 'bio') || 'Welcome to my profile!';

  // Convert profile background colors to particle colors
  const particleColors = useMemo(() => {
    console.log('🎨 AnonContactView backgroundColors:', profile.backgroundColors);

    if (profile.backgroundColors && profile.backgroundColors.length >= 3) {
      const colors = convertToParticleColors(profile.backgroundColors);
      console.log('🎨 Using profile colors:', colors);
      return colors;
    }

    // Fallback colors if none provided
    console.log('🎨 Using fallback green colors');
    return {
      gradientStart: 'rgba(34, 197, 94, 0.4)',
      gradientEnd: 'rgb(29, 150, 67)',
      particle: 'rgba(200, 255, 200, 0.8)',
      connection: 'rgba(34, 197, 94, 0.4)'
    };
  }, [profile.backgroundColors]);

  const handleSocialIconClick = (iconType: string) => {
    setClickedSocial(iconType);
    setShowEagerBeaverModal(true);
  };

  const handleSignIn = () => {
    // Preserve token through OAuth via callbackUrl
    signIn('google', {
      callbackUrl: `/connect?token=${token}`
    });
  };

  // Update safe area colors to match gradient
  useEffect(() => {
    let safeAreaColor = 'rgb(29, 150, 67)'; // Fallback dark green

    if (profile.backgroundColors && profile.backgroundColors.length >= 3) {
      const [dominant] = profile.backgroundColors;
      safeAreaColor = dominant;
    }

    // Set safe area background (used by globals.css)
    document.documentElement.style.setProperty('--safe-area-bg', safeAreaColor);
    document.documentElement.style.backgroundColor = safeAreaColor;

    // Update theme-color meta tag for iOS Safari safe areas
    let metaTag = document.querySelector('meta[name="theme-color"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', safeAreaColor);

    console.log('🎨 AnonContactView set safe area color:', safeAreaColor);

    // Cleanup: restore default black on unmount
    return () => {
      document.documentElement.style.setProperty('--safe-area-bg', '#000000');
      document.documentElement.style.backgroundColor = '#000000';
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', '#000000');
      }
    };
  }, [profile.backgroundColors]);

  return (
    <div className="flex flex-col items-center px-4 py-2 relative z-[1001]">
      {/* Particle background with contact's colors */}
      <div className="fixed inset-0 -z-10">
        <ParticleNetwork colors={particleColors} context="contact" />
      </div>

      {/* Fixed Content Area - matches ContactView structure */}
      <div className="w-full max-w-[var(--max-content-width,448px)] flex flex-col items-center justify-center flex-1 overflow-hidden">

        {/* Profile Card - matches ContactInfo structure */}
        <div className="w-full flex flex-col items-center">
          {/* Profile Image */}
          <div className="mb-4">
            <div className="border-4 border-white shadow-lg rounded-full">
              <Avatar
                src={profile.profileImage}
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
          {/* Sign in button - matches HomePage */}
          <Button
            variant="white"
            size="xl"
            onClick={handleSignIn}
            className="w-full mb-2"
            icon={<GoogleIcon />}
          >
            Sign in with Google
          </Button>

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
        primaryButtonText="Sign in with Google"
        primaryButtonIcon={<GoogleIcon />}
        onPrimaryButtonClick={handleSignIn}
        secondaryButtonText="Cancel"
      />
    </div>
  );
};
