'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useProfile } from '../../context/ProfileContext';
import { useSession } from 'next-auth/react';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import Link from 'next/link';
import { Button } from '../ui/Button';
import Avatar from '../ui/Avatar';
import SocialIconsList from '../ui/SocialIconsList';
import { SecondaryButton } from '../ui/SecondaryButton';
import { useAdminModeActivator } from '../ui/AdminBanner';
import { ExchangeButton } from '../ui/ExchangeButton';
import { StandardModal } from '../ui/StandardModal';

import ReactMarkdown from 'react-markdown';
import { Heading } from '../ui/Typography';
import { useRouter } from 'next/navigation';
import { generateMessageText, openMessagingApp } from '@/lib/services/messagingService';
import { usePWAInstall } from '@/lib/hooks/usePWAInstall';
import type { UserProfile } from '@/types/profile';

const ProfileView: React.FC = () => {
  const { data: session, status: sessionStatus } = useSession();
  
  const { 
    profile, 
    isLoading: isProfileLoading, 
    saveProfile, 
    setNavigatingFromSetup,
    streamingBio,
    streamingProfileImage,
    streamingSocialContacts
  } = useProfile();

  // Get the latest profile
  const currentProfile = profile;

  // Admin mode activation props
  const adminModeProps = useAdminModeActivator();
  
  // PWA install hook
  const { isInstallable, installPWA, showIOSModal, closeIOSModal } = usePWAInstall();
  
  const router = useRouter();

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

  const handleMessageContact = () => {
    if (!session?.user?.name || !savedContactProfile?.name) {
      console.warn('Missing user names for message generation');
      return;
    }

    const senderFirstName = session.user.name.split(' ')[0];
    const contactFirstName = savedContactProfile.name.split(' ')[0];
    const messageText = generateMessageText(contactFirstName, senderFirstName);
    
    // Try to use phone number if available
    const phoneNumber = savedContactProfile.contactChannels?.phoneInfo?.internationalPhone;
    
    console.log('📱 Opening messaging app with:', { messageText, phoneNumber });
    openMessagingApp(messageText, phoneNumber);
    
    setShowSuccessModal(false);
  };

  // Memoized values that need to be declared before conditional returns
  const bioContent = useMemo(() => {
    // Prioritize streaming bio during generation, then profile bio, then default
    return streamingBio || currentProfile?.bio || 'Welcome to my profile!';
  }, [streamingBio, currentProfile?.bio]);

  // Profile image with streaming support
  const profileImageSrc = useMemo(() => {
    return streamingProfileImage || currentProfile?.profileImage;
  }, [streamingProfileImage, currentProfile?.profileImage]);

  // Contact channels with streaming support
  const contactChannels = useMemo(() => {
    return streamingSocialContacts || currentProfile?.contactChannels;
  }, [streamingSocialContacts, currentProfile?.contactChannels]);

  // Check if any contact channels are unconfirmed
  const hasUnconfirmedChannels = useMemo(() => {
    if (!contactChannels) return false;
    
    // Check phone info
    if (contactChannels.phoneInfo && !contactChannels.phoneInfo.userConfirmed) {
      return true;
    }
    
    // Check email
    if (contactChannels.email && !contactChannels.email.userConfirmed) {
      return true;
    }
    
    // Check all social media channels
    const socialChannels = [
      contactChannels.facebook,
      contactChannels.instagram,
      contactChannels.x,
      contactChannels.linkedin,
      contactChannels.snapchat,
      contactChannels.whatsapp,
      contactChannels.telegram,
      contactChannels.wechat
    ];
    
    return socialChannels.some(channel => channel && !channel.userConfirmed);
  }, [contactChannels]);

  // Show loading state while checking auth status or loading profile
  if (isProfileLoading || sessionStatus === 'loading') {
    const bgUrl = currentProfile?.backgroundImage;
    const loadingStyle: React.CSSProperties = bgUrl
      ? {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundImage: `url('${bgUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
          zIndex: 1000
        }
      : {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'black',
          zIndex: 1000
        };
    return (
      <div style={loadingStyle}>
        <div className="flex items-center justify-center w-full h-full">
          <div className="flex flex-col items-center">
            <LoadingSpinner size="sm" className="mb-4" />
            <p className="text-white">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state during account deletion to prevent "Unable to load profile" flash
  if (isProfileLoading) {
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

  if (!profile) {
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

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-2">
      {/* Top Navigation Buttons - Fixed */}
      <div className="w-full max-w-[var(--max-content-width,448px)] flex justify-between items-center py-4 flex-shrink-0">
        <Button 
          variant="circle"
          size="icon"
          className="w-14 h-14"
          onClick={() => {}}
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
      <div className="w-full max-w-[var(--max-content-width,448px)] flex flex-col items-center flex-1 overflow-hidden">
        {/* Profile Image */}
        <div className="mb-4">
          <div className="border-4 border-white shadow-lg rounded-full">
            <Avatar 
              src={profileImageSrc} 
              alt={currentProfile?.name || 'Profile'}
              size="lg"
            />
          </div>
        </div>
        
        {/* Content with blur background */}
        <div className="w-full bg-black/40 backdrop-blur-sm px-6 py-4 rounded-2xl" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
          {/* Profile Name - Double click to activate admin mode */}
          <div className="mb-3 text-center cursor-pointer" {...adminModeProps}>
            <Heading as="h1">{currentProfile?.name}</Heading>
          </div>
          
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
                  p: ({node, ...props}) => <p className="text-sm text-white" {...props} />,
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
          <div className="w-full">
            {contactChannels && (
              <SocialIconsList
                contactChannels={contactChannels}
                size="md"
                variant="white"
              />
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="w-full mt-4 mb-4 space-y-3" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
          <ExchangeButton />
          
          {/* PWA Install Button */}
          {isInstallable && (
            <div className="flex justify-center">
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
        variant="success"
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
        variant="info"
        showSecondaryButton={false}
      />
    </div>
  );
};

export default ProfileView;
