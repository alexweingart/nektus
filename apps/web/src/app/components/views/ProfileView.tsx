'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useProfile } from '../../context/ProfileContext';
import { useSession } from 'next-auth/react';
import { LoadingSpinner } from '../ui/elements/LoadingSpinner';
import Link from 'next/link';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { useAdminModeActivator } from '../ui/banners/AdminBanner';
import { ExchangeButton } from '../ui/buttons/ExchangeButton';
import { StandardModal } from '../ui/modals/StandardModal';
import { ProfileInfo } from '../ui/modules/ProfileInfo';
import { BioModal } from '../ui/modals/BioModal';
import { useExchangeQRDisplay } from '@/client/hooks/use-exchange-qr-display';
import { useImageUpload } from '@/client/hooks/use-edit-profile-fields';

import { useRouter } from 'next/navigation';
import { usePWAInstall } from '@/client/hooks/use-pwa-install';
import { getFieldValue } from '@/client/profile/transforms';
import { getOptimalProfileImageUrl } from '@/client/profile/image';

type AnimationPhase = 'idle' | 'floating' | 'wind-up' | 'exiting' | 'entering';

const ProfileView: React.FC = () => {
  const { status: sessionStatus } = useSession();
  
  const {
    profile,
    isLoading: isProfileLoading,
    isNavigatingFromSetup,
    streamingProfileImage,
    isGoogleInitials,
    isCheckingGoogleImage,
    saveProfile,
    sharingCategory,
    isBioLoading,
    setIsBioLoading
  } = useProfile();

  // Debug flash issue - track state changes
  useEffect(() => {
    console.log('[ProfileView] State changed:', {
      isProfileLoading,
      isNavigatingFromSetup,
      hasProfile: !!profile,
      sessionStatus
    });
  }, [isProfileLoading, isNavigatingFromSetup, profile, sessionStatus]);

  // Get the latest profile
  const currentProfile = profile;

  // Admin mode activation props
  const adminModeProps = useAdminModeActivator();

  // PWA install hook
  const { isInstallable, installPWA, showIOSModal, closeIOSModal, showAndroidModal, closeAndroidModal } = usePWAInstall();

  // QR code display hook
  const { showQRCode, matchToken } = useExchangeQRDisplay();

  const router = useRouter();

  // Bio modal state (loading state lives in ProfileContext to persist across navigation)
  const [showBioModal, setShowBioModal] = useState(false);

  // Hidden file input for camera overlay upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraPreview, setCameraPreview] = useState<string | null>(null);
  const { createUploadHandler } = useImageUpload((colors) => {
    saveProfile({ backgroundColors: colors }, { skipUIUpdate: false });
  });
  const handleCameraUpload = createUploadHandler('profile', (imageData) => {
    if (imageData.startsWith('data:')) {
      // Base64 preview — show instantly, don't persist yet
      setCameraPreview(imageData);
    } else if (imageData) {
      // Permanent URL from server — persist to Firestore
      setCameraPreview(null);
      saveProfile({ profileImage: imageData }, { skipUIUpdate: false });
    } else {
      // Error/revert
      setCameraPreview(null);
    }
  });

  // Animation state
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [isExchanging, setIsExchanging] = useState(false);
  const profileInfoRef = useRef<HTMLDivElement>(null);
  const topButtonsRef = useRef<HTMLDivElement>(null);
  const nektButtonRef = useRef<HTMLDivElement>(null);
  const pwaButtonRef = useRef<HTMLDivElement>(null);

  // Floating animation is now triggered by ExchangeButton's waiting-for-bump state
  // No auto-floating on mount
  const [shouldStopFloating, setShouldStopFloating] = useState(false);

  // Listen for bump animation events
  useEffect(() => {
    const handleStartFloating = () => {
      setShouldStopFloating(false);
      setAnimationPhase('floating');
      setIsExchanging(true);
      // Store float animation start time for syncing button pulse
      (window as Window & { floatAnimationStart?: number }).floatAnimationStart = Date.now();
    };

    const handleStopFloating = () => {
      setShouldStopFloating(true);
      setIsExchanging(false);
      // Don't change animation phase yet - let animation iteration event handle it
    };

    const handleBumpDetected = () => {
      setAnimationPhase('wind-up');
    };

    const handleMatchFound = (_event: CustomEvent) => {
      // Background crossfade now handled by LayoutBackground component
      setAnimationPhase('exiting');
    };

    window.addEventListener('start-floating', handleStartFloating);
    window.addEventListener('stop-floating', handleStopFloating);
    window.addEventListener('bump-detected', handleBumpDetected as EventListener);
    window.addEventListener('match-found', handleMatchFound as EventListener);

    return () => {
      window.removeEventListener('start-floating', handleStartFloating);
      window.removeEventListener('stop-floating', handleStopFloating);
      window.removeEventListener('bump-detected', handleBumpDetected as EventListener);
      window.removeEventListener('match-found', handleMatchFound as EventListener);
    };
  }, []);

  // Handle animation iteration to smoothly stop floating
  useEffect(() => {
    const profileCard = profileInfoRef.current;
    if (!profileCard) return;

    const handleAnimationIteration = () => {
      if (shouldStopFloating && animationPhase === 'floating') {
        setAnimationPhase('idle');
        setShouldStopFloating(false);
      }
    };

    profileCard.addEventListener('animationiteration', handleAnimationIteration);
    return () => {
      profileCard.removeEventListener('animationiteration', handleAnimationIteration);
    };
  }, [shouldStopFloating, animationPhase]);

  // Handle return from ContactView
  useEffect(() => {
    const isReturning = sessionStorage.getItem('returning-to-profile');

    if (isReturning === 'true') {
      // Clear the flags
      sessionStorage.removeItem('returning-to-profile');

      // Trigger entrance animation
      setAnimationPhase('entering');

      // Return to idle state after animation
      setTimeout(() => {
        setAnimationPhase('idle');
      }, 300);
    }
  }, [profile?.backgroundImage]);

  // Memoized values that need to be declared before conditional returns
  const bioContent = useMemo(() => {
    const profileBio = getFieldValue(currentProfile?.contactEntries, 'bio');
    return profileBio || 'My bio is going to be awesome once I create it.';
  }, [currentProfile?.contactEntries]);

  // Clear bio loading when bio content changes (real-time update from Firestore)
  useEffect(() => {
    if (isBioLoading && bioContent !== 'My bio is going to be awesome once I create it.') {
      setIsBioLoading(false);
    }
  }, [bioContent, isBioLoading, setIsBioLoading]);

  // Profile image - use streaming value for immediate updates after generation
  // Filter out Google initials images to show our gradient instead
  // While checking Google image, hide it (src=undefined) to prevent flash
  const profileImageSrc = useMemo(() => {
    // Camera preview takes priority — instant local display
    if (cameraPreview) return cameraPreview;

    const baseImageUrl = streamingProfileImage || currentProfile?.profileImage;
    const isGoogleUrl = baseImageUrl?.includes('googleusercontent.com');

    // Prioritize streaming image for crossfade
    if (streamingProfileImage) {
      return getOptimalProfileImageUrl(streamingProfileImage, 400);
    }

    // Hide Google image while checking or if confirmed initials
    if (isGoogleInitials || (isCheckingGoogleImage && isGoogleUrl)) {
      return undefined;
    }

    return getOptimalProfileImageUrl(baseImageUrl, 400);
  }, [cameraPreview, streamingProfileImage, currentProfile?.profileImage, isGoogleInitials, isCheckingGoogleImage]);

  // Calculate if we should show initials - true for confirmed Google initials or while checking
  const shouldShowInitials = useMemo(() => {
    const baseImageUrl = streamingProfileImage || currentProfile?.profileImage;
    const isGoogleUrl = baseImageUrl?.includes('googleusercontent.com');
    return isGoogleInitials || (isCheckingGoogleImage && isGoogleUrl);
  }, [streamingProfileImage, currentProfile?.profileImage, isGoogleInitials, isCheckingGoogleImage]);


  // Show loading state while checking auth status or loading profile, but not when navigating from setup
  if ((isProfileLoading || sessionStatus === 'loading') && !isNavigatingFromSetup) {
    // Return empty div - green background pattern from body will show through for smooth transition
    return <div className="w-full" />;
  }

  // Show loading state during account deletion to prevent "Unable to load profile" flash
  if (isProfileLoading && !isNavigatingFromSetup) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center">
          <LoadingSpinner size="sm" className="mx-auto mb-4" />
          <p className="text-white">Deleting account...</p>
        </div>
      </div>
    );
  }

  if (!profile && !isNavigatingFromSetup) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center">
          <p className="text-white mb-4">Unable to load profile</p>
          <Button onClick={() => router.push('/setup')}>
            Go to Setup
          </Button>
        </div>
      </div>
    );
  }

  // If navigating from setup and no profile yet, show a minimal loading state
  if (isNavigatingFromSetup && !profile) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-2">
        <div className="flex flex-col items-center">
          <LoadingSpinner size="sm" className="mb-4" />
          <p className="text-white">Saving your profile...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center px-4 py-2">
      {/* Top Navigation Buttons - Fixed */}
      <div
        ref={topButtonsRef}
        className={`w-full max-w-[var(--max-content-width,448px)] flex justify-between items-center py-4 flex-shrink-0 transition-opacity duration-300 z-10 ${
          animationPhase === 'wind-up' ? 'animate-[subtlePulse_300ms]' : ''
        } ${
          animationPhase === 'exiting' ? 'animate-fade-blur-out' : ''
        } ${
          animationPhase === 'entering' ? 'animate-slide-enter-left' : ''
        }`}
      >
        <Button
          variant="circle"
          size="icon"
          className="w-14 h-14"
          onClick={() => router.push('/history')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        </Button>

        <Link href="/edit">
          <Button
            variant="circle"
            size="icon"
            className="w-14 h-14 relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </Button>
        </Link>
      </div>
      
      {/* Fixed Content Area - No scroll */}
      <div className="w-full max-w-[var(--max-content-width,448px)] flex flex-col items-center flex-1 overflow-visible">
        {/* Profile Info with Carousel */}
        <div
          ref={profileInfoRef}
          className={`w-full flex flex-col items-center transition-transform duration-300 ${
            animationPhase === 'floating' ? 'animate-float z-20' : ''
          } ${
            animationPhase === 'wind-up' ? 'animate-wind-up z-20' : ''
          } ${
            animationPhase === 'exiting' ? 'animate-profile-exit z-[100]' : ''
          } ${
            animationPhase === 'entering' ? 'animate-crossfade-enter' : ''
          }`}
          {...adminModeProps}
        >
          {currentProfile && (
            <ProfileInfo
              profile={currentProfile}
              profileImageSrc={profileImageSrc}
              bioContent={bioContent}
              className="w-full flex flex-col items-center"
              isLoadingProfile={isProfileLoading}
              isGoogleInitials={shouldShowInitials}
              showQRCode={showQRCode}
              matchToken={matchToken || undefined}
              showCameraOverlay
              onCameraPress={() => fileInputRef.current?.click()}
              onAddBioPress={() => setShowBioModal(true)}
              isBioLoading={isBioLoading}
              onAddLinkPress={() => {
                router.push(`/edit?openInlineAddLink=${sharingCategory === 'Work' ? 'work' : 'personal'}`);
              }}
            />
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="w-full mt-4 mb-4 space-y-3" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
          <div
            ref={nektButtonRef}
            className={`${
              animationPhase === 'exiting' ? 'animate-[buttonFadeOut_300ms_ease-out_forwards]' : ''
            } ${
              animationPhase === 'entering' ? 'animate-fade-in-up' : ''
            }`}
            style={{
              opacity: animationPhase === 'entering' ? 0 : 1
            }}
          >
            <ExchangeButton />
          </div>

          {/* PWA Install Button / Cancel Button */}
          {(isInstallable || isExchanging) && (
            <div
              ref={pwaButtonRef}
              className={`flex justify-center ${
                animationPhase === 'exiting' ? 'animate-[buttonFadeOut_300ms_ease-out_forwards]' : ''
              } ${
                animationPhase === 'entering' ? 'animate-fade-in-up' : ''
              }`}
              style={{
                opacity: animationPhase === 'entering' ? 0 : 1,
                animationDelay: animationPhase === 'entering' ? '100ms' : '0ms'
              }}
            >
              <SecondaryButton
                onClick={() => {
                  if (isExchanging) {
                    // Emit cancel event for ExchangeButton to handle
                    window.dispatchEvent(new CustomEvent('cancel-exchange'));
                  } else {
                    installPWA();
                  }
                }}
              >
                {isExchanging ? 'Cancel' : 'Add to home screen'}
              </SecondaryButton>
            </div>
          )}
        </div>
      </div>

      {/* PWA Install Modal - shows for iOS users */}
      <StandardModal
        isOpen={showIOSModal}
        onClose={closeIOSModal}
        title="Nekt in a tap"
        subtitle="Tap the share icon, then select &quot;Add to Home Screen&quot;"
        primaryButtonText="I&apos;ll do that right now!"
        onPrimaryButtonClick={closeIOSModal}
        showSecondaryButton={false}
        showCloseButton={false}
      />

      {/* PWA Install Modal - shows for Android users when prompt unavailable */}
      <StandardModal
        isOpen={showAndroidModal}
        onClose={closeAndroidModal}
        title="Nekt in a tap"
        subtitle="Tap the menu (three dots), then select &quot;Add to Home Screen&quot; or &quot;Install app&quot;"
        primaryButtonText="I&apos;ll do that right now!"
        onPrimaryButtonClick={closeAndroidModal}
        showSecondaryButton={false}
        showCloseButton={false}
      />

      {/* Hidden file input for camera overlay upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCameraUpload}
      />

      {/* Bio Modal */}
      {currentProfile && (
        <BioModal
          isOpen={showBioModal}
          onClose={() => setShowBioModal(false)}
          currentSection={sharingCategory as 'Personal' | 'Work'}
          profile={currentProfile}
          onBioSaved={(bio) => {
            const entries = [...(currentProfile.contactEntries || [])];
            const bioIdx = entries.findIndex(e => e.fieldType === 'bio' && e.section === 'universal');
            const bioEntry = { fieldType: 'bio', section: 'universal' as const, value: bio, order: 0, isVisible: true, confirmed: true };
            if (bioIdx >= 0) {
              entries[bioIdx] = { ...entries[bioIdx], ...bioEntry };
            } else {
              entries.push(bioEntry);
            }
            saveProfile({ contactEntries: entries });
          }}
          onSocialEntrySaved={(platform, username) => {
            const entries = [...(currentProfile.contactEntries || [])];
            const section = platform === 'linkedin' ? 'work' : 'personal';
            const idx = entries.findIndex(e => e.fieldType === platform);
            const entry = { fieldType: platform, value: username, section: section as 'personal' | 'work', order: entries.length, isVisible: true, confirmed: true };
            if (idx >= 0) {
              entries[idx] = { ...entries[idx], ...entry };
            } else {
              entries.push(entry);
            }
            saveProfile({ contactEntries: entries });
          }}
          onScrapeStarted={() => setIsBioLoading(true)}
          onScrapeFailed={() => setIsBioLoading(false)}
        />
      )}
    </div>
  );
};

export default ProfileView;
