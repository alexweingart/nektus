/**
 * AnonContactView component - Teaser profile for unauthenticated users who scan QR codes
 * Shows limited profile data with sign-in prompt
 * Uses Sign in with Apple on iOS, Sign in with Google on other platforms
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '../ui/buttons/Button';
import { Text } from '../ui/Typography';
import { StandardModal } from '../ui/modals/StandardModal';
import Avatar from '../ui/elements/Avatar';
import SocialIcon from '../ui/elements/SocialIcon';
import type { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/client/profile/transforms';
import ReactMarkdown from 'react-markdown';
import { getOptimalProfileImageUrl } from '@/client/profile/image';
import { useAuthSignIn } from '@/client/auth/use-auth-sign-in';
import { useProfileAvatarSize } from '@/client/hooks/use-profile-avatar-size';

interface AnonContactViewProps {
  profile: UserProfile;
  socialIconTypes: string[];
  token: string;
  hideActions?: boolean;
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
  token,
  hideActions = false
}) => {
  const avatarSize = useProfileAvatarSize();
  const [showEagerBeaverModal, setShowEagerBeaverModal] = useState(false);
  const [clickedSocial, setClickedSocial] = useState<string>('');

  const {
    showAppleSignIn,
    isAppleSigningIn,
    handleSignIn,
    handleAppleSignIn,
  } = useAuthSignIn({ callbackUrl: `/x/${token}` });

  const name = getFieldValue(profile.contactEntries, 'name') || 'They-who-must-not-be-named';
  const bio = getFieldValue(profile.contactEntries, 'bio') || 'Too cool for a bio. Google me.';

  const handleSocialIconClick = (iconType: string) => {
    setClickedSocial(iconType);
    setShowEagerBeaverModal(true);
  };

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
                sizeNumeric={avatarSize}
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
                <ReactMarkdown components={{
                  p: (props: React.ComponentProps<'p'>) => <Text variant="small" className="leading-relaxed mb-2" {...props} />,
                  a: (props: React.ComponentProps<'a'>) => <a className="text-blue-400 hover:text-blue-300 underline" {...props} />,
                }}>
                  {bio}
                </ReactMarkdown>
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
        <div className={`w-full mt-4 mb-4 space-y-3${hideActions ? ' invisible' : ''}`} style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
          {/* Sign in button - Apple on iOS, Google One Tap on Android, redirect on desktop */}
          {showAppleSignIn ? (
            <Button
              variant="white"
              size="xl"
              onClick={handleAppleSignIn}
              className="w-full mb-2"
              icon={<Image src="/icons/auth/apple.svg" alt="" width={24} height={24} />}
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
              icon={<Image src="/icons/auth/google.svg" alt="" width={18} height={18} />}
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
        primaryButtonIcon={showAppleSignIn ? <Image src="/icons/auth/apple.svg" alt="" width={24} height={24} /> : <Image src="/icons/auth/google.svg" alt="" width={18} height={18} />}
        onPrimaryButtonClick={showAppleSignIn ? handleAppleSignIn : handleSignIn}
        secondaryButtonText="Cancel"
      />
    </div>
  );
};
