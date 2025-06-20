'use client';

import React, { useMemo } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import { LoadingSpinner } from './ui/LoadingSpinner';
import Link from 'next/link';
import { Button } from './ui/Button';
import Avatar from './ui/Avatar';
import SocialIcon from './ui/SocialIcon';
import { useAdminModeActivator } from './ui/AdminBanner';
import { ExchangeButton } from './ExchangeButton';
import ReactMarkdown from 'react-markdown';
import { Heading } from './ui/Typography';
import { useRouter } from 'next/navigation';

const ProfileView: React.FC = () => {
  const { data: session, status: sessionStatus } = useSession();
  
  const { profile, isLoading: isProfileLoading, isDeletingAccount, getLatestProfile, streamingBackgroundImage } = useProfile();

  // Get the latest profile
  const currentProfile = getLatestProfile() || profile;

  // Admin mode activation props
  const adminModeProps = useAdminModeActivator();
  
  const router = useRouter();

  // Memoized values that need to be declared before conditional returns
  const bioContent = useMemo(() => {
    return currentProfile?.bio || 'Welcome to my profile!';
  }, [currentProfile?.bio]);

  // Show loading state while checking auth status or loading profile
  if (isProfileLoading || sessionStatus === 'loading') {
    const bgUrl = streamingBackgroundImage || currentProfile?.backgroundImage;
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
  if (isDeletingAccount) {
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
    <div className="h-[100dvh] flex flex-col items-center px-4 py-2">
      {/* Top Navigation Buttons - Fixed */}
      <div className="w-full max-w-[var(--max-content-width,448px)] flex justify-between items-center py-4 flex-shrink-0">
        <Button 
          variant="circle"
          size="icon"
          className="w-12 h-12"
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
            className="w-12 h-12"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </Button>
        </Link>
      </div>
      
      {/* Fixed Content Area - No scroll */}
      <div className="w-full max-w-[var(--max-content-width,448px)] flex flex-col items-center flex-1 overflow-hidden">
        {/* Profile Image */}
        <div className="mb-4">
          <div className="border-4 border-white shadow-lg rounded-full">
            <Avatar 
              src={currentProfile?.profileImage} 
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
            {/* First row - icons with equal spacing */}
            <div className="flex flex-wrap justify-center gap-4">
            {currentProfile?.contactChannels?.phoneInfo?.internationalPhone && (
              <a 
                href={`sms:${currentProfile.contactChannels.phoneInfo.internationalPhone}`}
                className="text-white hover:text-green-300 transition-colors"
              >
                <SocialIcon platform="phone" username={currentProfile.contactChannels.phoneInfo.internationalPhone} size="md" variant="white" />
              </a>
            )}
            
            {currentProfile?.contactChannels?.email?.email && (
              <a 
                href={`mailto:${currentProfile.contactChannels.email.email}`}
                className="text-white hover:text-blue-300 transition-colors"
              >
                <SocialIcon platform="email" username={currentProfile.contactChannels.email.email} size="md" variant="white" />
              </a>
            )}
            
            {currentProfile?.contactChannels?.facebook?.username && (
              <a 
                href={`https://facebook.com/${currentProfile.contactChannels.facebook.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-blue-400 transition-colors"
              >
                <SocialIcon platform="facebook" username={currentProfile.contactChannels.facebook.username} size="md" variant="white" />
              </a>
            )}
            
            {currentProfile?.contactChannels?.instagram?.username && (
              <a 
                href={`https://instagram.com/${currentProfile.contactChannels.instagram.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-pink-400 transition-colors"
              >
                <SocialIcon platform="instagram" username={currentProfile.contactChannels.instagram.username} size="md" variant="white" />
              </a>
            )}
            
            {currentProfile?.contactChannels?.x?.username && (
              <a 
                href={`https://x.com/${currentProfile.contactChannels.x.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-[hsl(var(--background))] transition-colors"
              >
                <SocialIcon platform="x" username={currentProfile.contactChannels.x.username} size="md" variant="white" />
              </a>
            )}
            
            {currentProfile?.contactChannels?.whatsapp?.username && (
              <a 
                href={`https://wa.me/${currentProfile.contactChannels.whatsapp.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-green-300 transition-colors"
              >
                <SocialIcon platform="whatsapp" username={currentProfile.contactChannels.whatsapp.username} size="md" variant="white" />
              </a>
            )}
            
            {currentProfile?.contactChannels?.snapchat?.username && (
              <a 
                href={`https://www.snapchat.com/add/${currentProfile.contactChannels.snapchat.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-yellow-300 transition-colors"
              >
                <SocialIcon platform="snapchat" username={currentProfile.contactChannels.snapchat.username} size="md" variant="white" />
              </a>
            )}
            
            {currentProfile?.contactChannels?.telegram?.username && (
              <a 
                href={`https://t.me/${currentProfile.contactChannels.telegram.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-blue-300 transition-colors"
              >
                <SocialIcon platform="telegram" username={currentProfile.contactChannels.telegram.username} size="md" variant="white" />
              </a>
            )}
            
            {currentProfile?.contactChannels?.wechat?.username && (
              <a 
                href={`weixin://dl/chat?${currentProfile.contactChannels.wechat.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-[hsl(var(--background))] transition-colors"
              >
                <SocialIcon platform="wechat" username={currentProfile.contactChannels.wechat.username} size="md" variant="white" />
              </a>
            )}
            
            {currentProfile?.contactChannels?.linkedin?.username && (
              <a 
                href={`https://linkedin.com/in/${currentProfile.contactChannels.linkedin.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-blue-300 transition-colors"
              >
                <SocialIcon platform="linkedin" username={currentProfile.contactChannels.linkedin.username} size="md" variant="white" />
              </a>
            )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="w-full mt-4 mb-4" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
          <ExchangeButton />
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
