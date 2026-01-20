'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Avatar from '../elements/Avatar';
import SocialIconsList from '../elements/SocialIconsList';
import { ProfileViewSelector, type ProfileViewMode } from '../controls/ProfileViewSelector';
import { filterProfileByCategory, type SharingCategory } from '@/client/profile/filtering';
import ReactMarkdown from 'react-markdown';
import { Heading, Text } from '../Typography';
import type { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/client/profile/transforms';
import QRCode from 'react-qr-code';

interface ProfileInfoProps {
  profile: UserProfile;
  profileImageSrc?: string;
  bioContent: string;
  className?: string;
  isLoadingProfile?: boolean;
  isGoogleInitials?: boolean; // Whether Google profile has auto-generated initials
  showQRCode?: boolean; // Whether to show QR code instead of profile details
  matchToken?: string; // Token for QR code URL
}

export const ProfileInfo: React.FC<ProfileInfoProps> = ({
  profile,
  profileImageSrc,
  bioContent,
  className,
  isLoadingProfile = false,
  isGoogleInitials = false,
  showQRCode = false,
  matchToken
}) => {
  const [selectedMode, setSelectedMode] = useState<ProfileViewMode>('Personal');
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
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

  // Load selected mode from localStorage on mount
  useEffect(() => {
    try {
      const savedCategory = localStorage.getItem('nekt-sharing-category') as SharingCategory;
      if (savedCategory && ['Personal', 'Work'].includes(savedCategory)) {
        setSelectedMode(savedCategory);
      }
      setHasLoadedFromStorage(true);
    } catch (error) {
      console.warn('Failed to load sharing category from localStorage:', error);
      setHasLoadedFromStorage(true);
    }
  }, []);

  // Save selected mode to localStorage when it changes
  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    
    try {
      localStorage.setItem('nekt-sharing-category', selectedMode);
      // Trigger storage event for other components
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'nekt-sharing-category',
        newValue: selectedMode,
        oldValue: null
      }));
    } catch (error) {
      console.warn('Failed to save sharing category to localStorage:', error);
    }
  }, [selectedMode, hasLoadedFromStorage]);

  // Filter contact entries based on selected mode
  const filteredContactEntries = useMemo(() => {
    if (profile?.contactEntries && hasLoadedFromStorage) {
      const filteredProfile = filterProfileByCategory(profile, selectedMode);
      return filteredProfile.contactEntries;
    }
    return profile?.contactEntries || [];
  }, [profile, selectedMode, hasLoadedFromStorage]);

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
    const qrValue = `${baseUrl}/connect?token=${token}`;

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
      {/* Profile Image */}
      <div className="mb-4">
        <div className="relative z-10 border-4 border-white shadow-lg rounded-full">
          <Avatar
            src={profileImageSrc}
            alt={getFieldValue(profile?.contactEntries, 'name') || 'Profile'}
            size="lg"
            isLoading={isLoadingProfile}
            showInitials={showInitialsValue}
          />
        </div>
      </div>

      {/* Carousel Container - Full width background */}
      <div
        ref={containerRef}
        className={`w-full bg-black/60 backdrop-blur-lg rounded-2xl overflow-hidden ${showQRCode ? 'py-6' : 'py-4'}`}
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
            <div className="mb-3 text-center">
              <Heading as="h1">{getFieldValue(profile?.contactEntries, 'name')}</Heading>
            </div>

            {/* Location Display */}
            {(() => {
              const personalLocation = profile?.locations?.find(loc => loc.section === 'personal');
              if (personalLocation) {
                return (
                  <div className="flex items-center justify-center gap-1 mb-2">
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
              <div className="bio-content text-white">
                <ReactMarkdown 
                  components={{
                    p: ({node: _node, ...props}) => <Text variant="small" className="leading-relaxed mb-2 last:mb-0" {...props} />,
                    a: ({ node: _node, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" />
                    )
                  }}
                >
                  {bioContent}
                </ReactMarkdown>
              </div>
            </div>
            
            {/* Contact Icons */}
            <div className="w-full text-center">
              {filteredContactEntries && (
                <SocialIconsList
                  contactEntries={filteredContactEntries}
                  size="md"
                  variant="white"
                />
              )}
            </div>
          </div>
          
          {/* Work View - Full container width with internal padding */}
          <div className="w-full flex-shrink-0 px-6">
            {/* Profile Name */}
            <div className="mb-3 text-center">
              <Heading as="h1">{getFieldValue(profile?.contactEntries, 'name')}</Heading>
            </div>

            {/* Location Display */}
            {(() => {
              const workLocation = profile?.locations?.find(loc => loc.section === 'work');
              if (workLocation) {
                return (
                  <div className="flex items-center justify-center gap-1 mb-2">
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
              <div className="bio-content text-white">
                <ReactMarkdown 
                  components={{
                    p: ({node: _node, ...props}) => <Text variant="small" className="leading-relaxed mb-2 last:mb-0" {...props} />,
                    a: ({ node: _node, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" />
                    )
                  }}
                >
                  {bioContent}
                </ReactMarkdown>
              </div>
            </div>
            
            {/* Contact Icons */}
            <div className="w-full text-center">
              {filteredContactEntries && (
                <SocialIconsList
                  contactEntries={filteredContactEntries}
                  size="md"
                  variant="white"
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