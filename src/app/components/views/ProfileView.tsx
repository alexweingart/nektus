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

import { useRouter } from 'next/navigation';
import { generateMessageText, openMessagingApp } from '@/lib/services/client/messagingService';
import { usePWAInstall } from '@/lib/hooks/usePWAInstall';
import type { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/lib/utils/profileTransforms';
import { getOptimalProfileImageUrl } from '@/lib/utils/imageUtils';

type AnimationPhase = 'idle' | 'floating' | 'wind-up' | 'exiting' | 'entering';

const ProfileView: React.FC = () => {
  const { data: session, status: sessionStatus } = useSession();
  
  const {
    profile,
    isLoading: isProfileLoading,
    isNavigatingFromSetup,
    streamingBio,
    streamingSocialContacts,
    isGoogleInitials
  } = useProfile();



  // Get the latest profile
  const currentProfile = profile;

  // Admin mode activation props
  const adminModeProps = useAdminModeActivator();
  
  // PWA install hook
  const { isInstallable, installPWA, showIOSModal, closeIOSModal } = usePWAInstall();
  
  const router = useRouter();

  // Animation state
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const profileInfoRef = useRef<HTMLDivElement>(null);
  const topButtonsRef = useRef<HTMLDivElement>(null);
  const nektButtonRef = useRef<HTMLDivElement>(null);
  const pwaButtonRef = useRef<HTMLDivElement>(null);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedContactProfile, setSavedContactProfile] = useState<UserProfile | null>(null);

  // Check for saved contact on component mount
  useEffect(() => {
    const checkForSavedContact = () => {
      try {
        const savedContactData = localStorage.getItem('savedContact');
        if (savedContactData) {
          const { profile: contactProfile, timestamp } = JSON.parse(savedContactData);
          
          // Only show modal if the save was recent (within last 30 seconds)
          const timeDiff = Date.now() - timestamp;
          if (timeDiff < 30000) {
            console.log('🎉 Showing success modal for recently saved contact:', contactProfile.name);
            setSavedContactProfile(contactProfile);
            setShowSuccessModal(true);
          }
          
          // Clear the localStorage data
          localStorage.removeItem('savedContact');
        }
      } catch (error) {
        console.error('Error checking for saved contact:', error);
        // Clear corrupted data
        localStorage.removeItem('savedContact');
      }
    };

    // Check when component mounts and profile is available
    if (currentProfile) {
      checkForSavedContact();
    }
  }, [currentProfile]);

  // Floating animation is now triggered by ExchangeButton's waiting-for-bump state
  // No auto-floating on mount
  const [shouldStopFloating, setShouldStopFloating] = useState(false);

  // Listen for bump animation events
  useEffect(() => {
    const handleStartFloating = () => {
      console.log('🎯 ProfileView: Starting floating animation');
      setShouldStopFloating(false);
      setAnimationPhase('floating');
    };

    const handleStopFloating = () => {
      console.log('🎯 ProfileView: Stop floating requested, will finish current cycle');
      setShouldStopFloating(true);
      // Don't change animation phase yet - let animation iteration event handle it
    };

    const handleBumpDetected = () => {
      console.log('🎯 ProfileView: Bump detected, starting wind-up animation');
      setAnimationPhase('wind-up');
    };

    const handleMatchFound = (_event: CustomEvent) => {
      console.log('🎯 ProfileView: Match found, starting exit animation');
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
        console.log('🎯 ProfileView: Float cycle complete, stopping now');
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
      console.log('🎯 ProfileView: Detected return from ContactView, starting fade-in');

      // Clear the flags
      sessionStorage.removeItem('returning-to-profile');
      sessionStorage.removeItem('contact-background-url'); // Background crossfade now handled by LayoutBackground

      // Trigger entrance animation
      setAnimationPhase('entering');

      // Return to idle state after animation
      setTimeout(() => {
        setAnimationPhase('idle');
      }, 300);
    }
  }, [profile?.backgroundImage]);

  const handleMessageContact = () => {
    const contactName = getFieldValue(savedContactProfile?.contactEntries, 'name');
    if (!session?.user?.name || !contactName) {
      console.warn('Missing user names for message generation');
      return;
    }

    const senderFirstName = session.user.name.split(' ')[0];
    const contactFirstName = contactName.split(' ')[0];
    const messageText = generateMessageText(contactFirstName, senderFirstName);
    
    // Try to use phone number if available
    let phoneNumber = '';
    
    if (savedContactProfile?.contactEntries) {
      const phoneEntry = savedContactProfile.contactEntries.find(e => e.fieldType === 'phone');
      phoneNumber = phoneEntry?.value || '';
    }
    
    console.log('📱 Opening messaging app with:', { messageText, phoneNumber });
    openMessagingApp(messageText, phoneNumber);
    
    setShowSuccessModal(false);
  };

  // Memoized values that need to be declared before conditional returns
  const bioContent = useMemo(() => {
    // Prioritize streaming bio during generation, then profile bio, then default
    const profileBio = getFieldValue(currentProfile?.contactEntries, 'bio');
    return streamingBio || profileBio || 'My bio is going to be awesome once I create it.';
  }, [streamingBio, currentProfile?.contactEntries]);

  // Profile image - wait for profile reload after generation
  // Filter out Google initials images to show our gradient instead
  const profileImageSrc = useMemo(() => {
    if (isGoogleInitials) {
      return undefined; // Show gradient fallback for Google initials
    }
    const baseImageUrl = currentProfile?.profileImage;
    return getOptimalProfileImageUrl(baseImageUrl, 400);
  }, [currentProfile?.profileImage, isGoogleInitials]);

  // Contact channels with streaming support
  const contactChannels = useMemo(() => {
    return streamingSocialContacts || currentProfile?.contactEntries;
  }, [streamingSocialContacts, currentProfile?.contactEntries]);

  // Check if any contact channels are unconfirmed
  const hasUnconfirmedChannels = useMemo(() => {
    if (!contactChannels) return false;
    
    // contactChannels is now a ContactEntry array
    if (Array.isArray(contactChannels)) {
      return contactChannels.some(entry => {
        // Check if entry has a value and is not confirmed
        return entry.value && !entry.confirmed;
      });
    }
    
    return false;
  }, [contactChannels]);


  // Show loading state while checking auth status or loading profile, but not when navigating from setup
  if ((isProfileLoading || sessionStatus === 'loading') && !isNavigatingFromSetup) {
    console.log('[ProfileView] Showing main loading state (auth/profile loading)');
    // Return empty div - green background pattern from body will show through for smooth transition
    return <div className="min-h-dvh w-full" />;
  }

  // Show loading state during account deletion to prevent "Unable to load profile" flash
  if (isProfileLoading && !isNavigatingFromSetup) {
    console.log('[ProfileView] Showing deletion loading state');
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
    console.log('[ProfileView] No profile and not navigating from setup - showing error');
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
    console.log('[ProfileView] Navigating from setup with no profile - showing save state');
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-2">
        <div className="flex flex-col items-center">
          <LoadingSpinner size="sm" className="mb-4" />
          <p className="text-white">Saving your profile...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-2">
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
            {hasUnconfirmedChannels && (
              <div className="absolute top-0 right-0 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white"></div>
            )}
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

          {/* PWA Install Button */}
          {isInstallable && (
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
              <SecondaryButton onClick={installPWA}>
                Add to home screen
              </SecondaryButton>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal - shows when contact is saved */}
      <StandardModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="All set - new friend saved!"
        subtitle="Shoot them a quick text before you forget"
        primaryButtonText="Say hey 👋"
        onPrimaryButtonClick={handleMessageContact}
        secondaryButtonText="Maybe later"
        showCloseButton={false}
      />

      {/* PWA Install Modal - shows for iOS users */}
      <StandardModal
        isOpen={showIOSModal}
        onClose={closeIOSModal}
        title="Nekt in a tap"
        subtitle="Tap the share icon, then select &quot;Add to Home Screen&quot;"
        primaryButtonText="I&apos;ll do that right now!"
        onPrimaryButtonClick={() => {
          console.log('📱 PWA install modal button clicked');
          closeIOSModal();
        }}
        showSecondaryButton={false}
        showCloseButton={false}
      />
    </div>
  );
};

export default ProfileView;
