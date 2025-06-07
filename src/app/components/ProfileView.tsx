'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProfile, profileHasPhone } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import { LoadingSpinner } from './ui/LoadingSpinner';
import Link from 'next/link';
import { Button } from './ui/Button';
import Avatar from './ui/Avatar';
import SocialIcon from './ui/SocialIcon';
import { useAdminModeActivator } from './ui/AdminBanner';
import type { UserProfile } from '@/types/profile';
import ReactMarkdown from 'react-markdown';
import { Heading, Text } from './ui/Typography';
import { useRouter } from 'next/navigation';

const ProfileView: React.FC = () => {
  console.log('[ProfileView] Rendering ProfileView');
  
  const { data: session, status: sessionStatus } = useSession();
  
  const { profile, isLoading: isProfileLoading } = useProfile();
  console.log('[ProfileView] Profile state:', {
    hasProfile: !!profile,
    isProfileLoading,
    sessionStatus,
    hasSession: !!session
  });

  const adminModeProps = useAdminModeActivator(); // Get admin mode activation props
  
  const router = useRouter();

  // Show loading state while checking auth status or loading profile
  if (isProfileLoading || sessionStatus === 'loading') {
    console.log('[ProfileView] Showing loading state:', {
      sessionStatus,
      isProfileLoading
    });
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <p className="text-white mb-4">Unable to load profile</p>
          <Button onClick={() => router.push('/setup')}>
            Go to Setup
          </Button>
        </div>
      </div>
    );
  }

  // Simple bio display - just show what's in the profile
  const bioContent = useMemo(() => {
    return profile.bio || 'Welcome to my profile!';
  }, [profile.bio]);

  const markdownComponents = useMemo(() => ({
    p: ({node, ...props}: any) => <p className="text-white text-sm leading-relaxed mb-2" {...props} />,
    a: ({ node: _node, ...props }: any) => (
      <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
    ),
  }), []);

  return (
    <div 
      className="min-h-screen flex flex-col items-center px-4 py-4"
      style={{
        backgroundImage: profile.backgroundImage ? `url(${profile.backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#004D40' // Theme background color that shows while image loads
      }}
    >
      {/* Top Navigation Buttons */}
      <div className="w-full max-w-[var(--max-content-width,448px)] flex justify-between items-center py-4 mb-6">
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
      
      <div className="w-full max-w-[var(--max-content-width,448px)] flex flex-col items-center">
        {/* Profile Image */}
        <div className="mb-4">
          <div className="border-4 border-white shadow-lg rounded-full">
            <Avatar 
              src={profile.profileImage} 
              alt={profile.name || 'Profile'}
              size="lg"
            />
          </div>
        </div>
        
        {/* Content with blur background */}
        <div className="w-full bg-black/40 backdrop-blur-sm px-6 py-4 rounded-2xl" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
          {/* Profile Name - Double click to activate admin mode */}
          <div className="mb-3 text-center cursor-pointer" {...adminModeProps}>
            <Heading as="h1">{profile.name}</Heading>
          </div>
          
          {/* Bio with markdown support */}
          <div className="mb-4 text-center">
            <style>{`
              .bio-content a {
                color: hsl(var(--background)); /* Using CSS variable */
                text-decoration: underline;
              }
              .bio-content a:hover {
                color: hsl(var(--background)); /* Using CSS variable */
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
            {/* First row - 5 icons with equal spacing */}
            <div className="flex flex-wrap justify-center gap-4">
            {profile.contactChannels.facebook.username && (
              <a 
                href={`https://facebook.com/${profile.contactChannels.facebook.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-blue-400 transition-colors"
              >
                <SocialIcon platform="facebook" username={profile.contactChannels.facebook.username} size="md" variant="white" />
              </a>
            )}
            
            {profile.contactChannels.instagram.username && (
              <a 
                href={`https://instagram.com/${profile.contactChannels.instagram.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-pink-400 transition-colors"
              >
                <SocialIcon platform="instagram" username={profile.contactChannels.instagram.username} size="md" variant="white" />
              </a>
            )}
            
            {profile.contactChannels.x.username && (
              <a 
                href={`https://x.com/${profile.contactChannels.x.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-[hsl(var(--background))] transition-colors"
              >
                <SocialIcon platform="x" username={profile.contactChannels.x.username} size="md" variant="white" />
              </a>
            )}
            
            {profile.contactChannels.whatsapp.username && (
              <a 
                href={`https://wa.me/${profile.contactChannels.whatsapp.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-[hsl(var(--background))] transition-colors"
              >
                <SocialIcon platform="whatsapp" username={profile.contactChannels.whatsapp.username} size="md" variant="white" />
              </a>
            )}
            
            {profile.contactChannels.snapchat.username && (
              <a 
                href={`https://www.snapchat.com/add/${profile.contactChannels.snapchat.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-yellow-300 transition-colors"
              >
                <SocialIcon platform="snapchat" username={profile.contactChannels.snapchat.username} size="md" variant="white" />
              </a>
            )}
            
            {profile.contactChannels.telegram.username && (
              <a 
                href={`https://t.me/${profile.contactChannels.telegram.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-blue-300 transition-colors"
              >
                <SocialIcon platform="telegram" username={profile.contactChannels.telegram.username} size="md" variant="white" />
              </a>
            )}
            
            {profile.contactChannels.wechat?.username && (
              <a 
                href={`weixin://dl/chat?${profile.contactChannels.wechat.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-[hsl(var(--background))] transition-colors"
              >
                <SocialIcon platform="wechat" username={profile.contactChannels.wechat.username} size="md" variant="white" />
              </a>
            )}
            
            {profile.contactChannels.linkedin.username && (
              <a 
                href={`https://linkedin.com/in/${profile.contactChannels.linkedin.username}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-blue-300 transition-colors"
              >
                <SocialIcon platform="linkedin" username={profile.contactChannels.linkedin.username} size="md" variant="white" />
              </a>
            )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="w-full mt-4" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
          <Link href="/connect" className="w-full">
            <Button 
              variant="theme"
              size="lg"
              className="w-full font-bold text-lg"
            >
              Nekt
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
