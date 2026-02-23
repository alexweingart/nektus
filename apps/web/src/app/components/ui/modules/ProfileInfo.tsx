'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProfileAvatarSize } from '@/client/hooks/use-profile-avatar-size';
import Avatar from '../elements/Avatar';
import SocialIconsList from '../elements/SocialIconsList';
import { ProfileViewSelector, type ProfileViewMode } from '../controls/ProfileViewSelector';
import { filterProfileByCategory } from '@/client/profile/filtering';
import ReactMarkdown from 'react-markdown';
import { Heading, Text } from '../Typography';
import type { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/client/profile/transforms';
import QRCode from 'react-qr-code';
import { useProfile } from '@/app/context/ProfileContext';
import { SecondaryButton } from '../buttons/SecondaryButton';
import { ensureReadableColor, DEFAULT_ACCENT_GREEN } from '@/shared/colors';

interface ProfileInfoProps {
  profile: UserProfile;
  profileImageSrc?: string;
  bioContent: string;
  className?: string;
  isLoadingProfile?: boolean;
  isGoogleInitials?: boolean; // Whether Google profile has auto-generated initials
  showQRCode?: boolean; // Whether to show QR code instead of profile details
  matchToken?: string; // Token for QR code URL
  showCameraOverlay?: boolean;
  onCameraPress?: () => void;
  onAddBioPress?: () => void;
  isBioLoading?: boolean;
  onAddLinkPress?: () => void;
}

export const ProfileInfo: React.FC<ProfileInfoProps> = ({
  profile,
  profileImageSrc,
  bioContent,
  className,
  isLoadingProfile = false,
  isGoogleInitials = false,
  showQRCode = false,
  matchToken,
  showCameraOverlay = false,
  onCameraPress,
  onAddBioPress,
  isBioLoading = false,
  onAddLinkPress
}) => {
  const avatarSize = useProfileAvatarSize();
  const { sharingCategory, setSharingCategory } = useProfile();
  const selectedMode = sharingCategory as ProfileViewMode;
  const setSelectedMode = setSharingCategory;
  const carouselRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [contentHeight, setContentHeight] = useState<number>(0);

  // Measure container width and content height (carousel + selector)
  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
    if (contentRef.current && !showQRCode) {
      setContentHeight(contentRef.current.offsetHeight);
    }
  }, [profile, showQRCode, selectedMode]);

  // Keep showInitials true when we have Google initials, even when profileImageSrc arrives
  // This enables the Avatar component to crossfade from initials to the generated image
  const showInitialsValue = isGoogleInitials;

  // Filter contact entries based on selected mode
  const filteredContactEntries = useMemo(() => {
    if (profile?.contactEntries) {
      const filteredProfile = filterProfileByCategory(profile, selectedMode);
      return filteredProfile.contactEntries;
    }
    return profile?.contactEntries || [];
  }, [profile, selectedMode]);

  // Count visible non-empty social links (exclude name/bio)
  const visibleLinkCount = useMemo(() => {
    return (filteredContactEntries || []).filter(e =>
      e.fieldType !== 'name' && e.fieldType !== 'bio' &&
      e.isVisible !== false && !!e.value?.trim()
    ).length;
  }, [filteredContactEntries]);

  const defaultBioPlaceholder = 'My bio is going to be awesome once I create it.';
  const isBioPlaceholder = bioContent === defaultBioPlaceholder;

  // Handle mode change from selector
  const handleModeChange = (mode: ProfileViewMode) => {
    if (mode === selectedMode) return;
    
    setSelectedMode(mode);
    
    // Animate carousel
    if (carouselRef.current) {
      const direction = mode === 'Work' ? -100 : 0;
      carouselRef.current.style.transform = `translateX(${direction}%)`;
    }
  };

  // Handle touch events for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startXRef.current) return;
    
    const currentX = e.touches[0].clientX;
    const diffX = startXRef.current - currentX;
    
    // Only start dragging if we've moved more than 10px
    if (Math.abs(diffX) > 10) {
      isDraggingRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!startXRef.current || !isDraggingRef.current) return;
    
    const endX = e.changedTouches[0].clientX;
    const diffX = startXRef.current - endX;
    
    // Swipe threshold
    if (Math.abs(diffX) > 50) {
      if (diffX > 0 && selectedMode === 'Personal') {
        // Swipe left from Personal to Work
        handleModeChange('Work');
      } else if (diffX < 0 && selectedMode === 'Work') {
        // Swipe right from Work to Personal
        handleModeChange('Personal');
      }
    }
    
    startXRef.current = 0;
    isDraggingRef.current = false;
  };

  // Update carousel position when mode changes
  useEffect(() => {
    if (carouselRef.current) {
      // Simply translate by 100% to show the second item
      const translatePercent = selectedMode === 'Work' ? -100 : 0;
      carouselRef.current.style.transform = `translateX(${translatePercent}%)`;
    }
  }, [selectedMode]);

  // QR Code Display Component - expands to fill available width
  const QRCodeDisplay = ({ token }: { token: string }) => {
    // Use NEXT_PUBLIC_BASE_URL for cross-device QR scanning (tailscale, production, etc.)
    // Falls back to window.location.origin for same-device testing
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

    // Calculate QR size: use the smaller of width or content height
    // Subtract 16px to account for py-6 vs py-4 padding difference (8px each side)
    const maxWidth = containerWidth > 100 ? containerWidth - 48 : 260;
    const adjustedHeight = contentHeight > 0 ? contentHeight - 16 : 0;
    const maxHeight = adjustedHeight > 0 ? adjustedHeight : maxWidth;
    const qrSize = Math.min(maxWidth, maxHeight);
    const finalSize = Math.max(qrSize, 180);
    const qrValue = `${baseUrl}/x/${token}`;

    return (
      <div
        className="w-full flex items-center justify-center px-6"
        style={adjustedHeight > 0 ? { height: adjustedHeight } : undefined}
      >
        <QRCode
          value={qrValue}
          size={finalSize}
          level="M"
          fgColor="#FFFFFF"
          bgColor="transparent"
        />
      </div>
    );
  };

  return (
    <div className={className}>
      {/* Profile Image - tap/click entire image to change photo when camera overlay shown */}
      <div className="mb-4 relative">
        <div
          className={`relative z-10 border-4 border-white shadow-lg rounded-full ${showCameraOverlay && onCameraPress ? 'cursor-pointer' : ''}`}
          onClick={showCameraOverlay && onCameraPress ? onCameraPress : undefined}
        >
          <Avatar
            src={profileImageSrc}
            alt={getFieldValue(profile?.contactEntries, 'name') || 'They-who-must-not-be-named'}
            sizeNumeric={avatarSize}
            isLoading={isLoadingProfile}
            showInitials={showInitialsValue}
            profileColors={profile?.backgroundColors}
          />
        </div>
        {showCameraOverlay && onCameraPress && (() => {
          // Position camera button on the circle edge at ~45° (bottom-right)
          // The avatar container is avatarSize + 8px (border-4 each side)
          const containerRadius = (avatarSize + 8) / 2;
          const edgeToCorner = containerRadius * (1 - Math.cos(Math.PI / 4));
          const cameraButtonRadius = 28; // half of 56px
          const offset = edgeToCorner - cameraButtonRadius - 4; // -4 so it slightly overlaps the edge
          return (
          <button
            onClick={onCameraPress}
            className="absolute z-20 w-14 h-14 rounded-full bg-black/30 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-black/40 transition-colors"
            style={{ bottom: offset, right: offset }}
            aria-label="Upload photo"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          );
        })()}
      </div>

      {/* Carousel Container - Full width background */}
      <div
        ref={containerRef}
        className={`w-full bg-black/30 backdrop-blur-xl rounded-2xl overflow-hidden ${showQRCode ? 'py-6' : 'py-4'}`}
      >
        {showQRCode && matchToken ? (
          <QRCodeDisplay token={matchToken} />
        ) : (
          <div ref={contentRef}>
            <div
              ref={carouselRef}
              className="grid grid-flow-col auto-cols-[100%] transition-transform duration-300 ease-out"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
          {/* Personal View - Full container width with internal padding */}
          <div className="w-full flex-shrink-0 px-6">
            {/* Profile Name */}
            <div className={`${profile?.locations?.find(loc => loc.section === 'personal') ? 'mb-1' : 'mb-3'} text-center`}>
              <Heading as="h1">{getFieldValue(profile?.contactEntries, 'name') || 'They-who-must-not-be-named'}</Heading>
            </div>

            {/* Location Display */}
            {(() => {
              const personalLocation = profile?.locations?.find(loc => loc.section === 'personal');
              if (personalLocation) {
                return (
                  <div className="flex items-center justify-center gap-1 mb-4">
                    <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <Text variant="small" className="text-white/90">
                      {personalLocation.city}, {personalLocation.region}
                    </Text>
                  </div>
                );
              }
              return null;
            })()}

            {/* Bio with markdown support */}
            <div className="mb-4 text-center">
              <style>{`
                .bio-content a {
                  color: white;
                  text-decoration: underline;
                }
                .bio-content a:hover {
                  color: rgba(255, 255, 255, 0.8);
                }
              `}</style>
              {isBioLoading ? (
                <div className="space-y-2">
                  <div className="h-3 bg-white/20 rounded-full w-3/4 mx-auto animate-pulse" />
                  <div className="h-3 bg-white/20 rounded-full w-1/2 mx-auto animate-pulse" />
                </div>
              ) : isBioPlaceholder && onAddBioPress ? (
                <SecondaryButton variant="ghost" onClick={onAddBioPress}>+ Add Bio</SecondaryButton>
              ) : (
                <div className="bio-content text-white">
                  <ReactMarkdown
                    components={{
                      p: ({node: _node, ...props}) => <Text variant="small" className="leading-relaxed mb-2 last:mb-0" {...props} />,
                      a: ({ node: _node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: profile.backgroundColors?.[0] ? ensureReadableColor(profile.backgroundColors[0]) : DEFAULT_ACCENT_GREEN }} />
                      )
                    }}
                  >
                    {bioContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Contact Icons */}
            <div className="w-full text-center">
              {filteredContactEntries && (
                <SocialIconsList
                  contactEntries={filteredContactEntries}
                  size="md"
                  variant="white"
                  showAddButton={visibleLinkCount <= 4 && !!onAddLinkPress}
                  onAddPress={onAddLinkPress}
                />
              )}
            </div>
          </div>

          {/* Work View - Full container width with internal padding */}
          <div className="w-full flex-shrink-0 px-6">
            {/* Profile Name */}
            <div className={`${profile?.locations?.find(loc => loc.section === 'work') ? 'mb-1' : 'mb-3'} text-center`}>
              <Heading as="h1">{getFieldValue(profile?.contactEntries, 'name') || 'They-who-must-not-be-named'}</Heading>
            </div>

            {/* Location Display */}
            {(() => {
              const workLocation = profile?.locations?.find(loc => loc.section === 'work');
              if (workLocation) {
                return (
                  <div className="flex items-center justify-center gap-1 mb-4">
                    <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <Text variant="small" className="text-white/90">
                      {workLocation.city}, {workLocation.region}
                    </Text>
                  </div>
                );
              }
              return null;
            })()}

            {/* Bio with markdown support */}
            <div className="mb-4 text-center">
              {isBioLoading ? (
                <div className="space-y-2">
                  <div className="h-3 bg-white/20 rounded-full w-3/4 mx-auto animate-pulse" />
                  <div className="h-3 bg-white/20 rounded-full w-1/2 mx-auto animate-pulse" />
                </div>
              ) : isBioPlaceholder && onAddBioPress ? (
                <SecondaryButton variant="ghost" onClick={onAddBioPress}>+ Add Bio</SecondaryButton>
              ) : (
                <div className="bio-content text-white">
                  <ReactMarkdown
                    components={{
                      p: ({node: _node, ...props}) => <Text variant="small" className="leading-relaxed mb-2 last:mb-0" {...props} />,
                      a: ({ node: _node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: profile.backgroundColors?.[0] ? ensureReadableColor(profile.backgroundColors[0]) : DEFAULT_ACCENT_GREEN }} />
                      )
                    }}
                  >
                    {bioContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Contact Icons */}
            <div className="w-full text-center">
              {filteredContactEntries && (
                <SocialIconsList
                  contactEntries={filteredContactEntries}
                  size="md"
                  variant="white"
                  showAddButton={visibleLinkCount <= 4 && !!onAddLinkPress}
                  onAddPress={onAddLinkPress}
                />
              )}
            </div>
          </div>
          </div>
            {/* Profile View Selector */}
            <div className="mt-4 flex justify-center">
              <ProfileViewSelector
                selectedMode={selectedMode}
                onModeChange={handleModeChange}
                className="w-48"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};