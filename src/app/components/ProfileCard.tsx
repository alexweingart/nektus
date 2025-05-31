'use client';

import React from 'react';
import SocialIcon from './SocialIcon';
import { UserProfile } from '../context/ProfileContext';

type SocialPlatform = 'facebook' | 'instagram' | 'x' | 'whatsapp' | 'snapchat' | 'telegram' | 'linkedin';

interface SocialProfile {
  platform: SocialPlatform;
  username: string;
  shareEnabled: boolean;
}

interface ProfileCardProps {
  userData: {
    name: string;
    title?: string;
    company?: string;
    location?: string;
    contactChannels: UserProfile['contactChannels'];
  };
  isCurrentUser?: boolean;
  onNektClick?: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ 
  userData,
  isCurrentUser = false,
  onNektClick
}) => {
  const { name, title, company, location, contactChannels } = userData;
  
  // Convert contactChannels to the expected format for SocialIcon
  const socialProfiles: SocialProfile[] = [
    { platform: 'facebook' as const, username: contactChannels.facebook.username, shareEnabled: contactChannels.facebook.userConfirmed },
    { platform: 'instagram' as const, username: contactChannels.instagram.username, shareEnabled: contactChannels.instagram.userConfirmed },
    { platform: 'x' as const, username: contactChannels.x.username, shareEnabled: contactChannels.x.userConfirmed },
    { platform: 'whatsapp' as const, username: contactChannels.whatsapp.username, shareEnabled: contactChannels.whatsapp.userConfirmed },
    { platform: 'snapchat' as const, username: contactChannels.snapchat.username, shareEnabled: contactChannels.snapchat.userConfirmed },
    { platform: 'telegram' as const, username: contactChannels.telegram.username, shareEnabled: contactChannels.telegram.userConfirmed },
    { platform: 'linkedin' as const, username: contactChannels.linkedin.username, shareEnabled: contactChannels.linkedin.userConfirmed },
  ];
  
  // Filter social profiles to only show ones with usernames and that are enabled for sharing
  const visibleSocialProfiles = socialProfiles.filter(
    profile => profile.username && (isCurrentUser || profile.shareEnabled)
  );

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Header with browser-like styling to match wireframes */}
      <div className="flex items-center p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-1">
          <button className="w-3 h-3 rounded-full bg-red-500"></button>
          <button className="w-3 h-3 rounded-full bg-yellow-500"></button>
          <button className="w-3 h-3 rounded-full bg-green-500"></button>
        </div>
        <div className="flex-1 text-center">
          <span className="text-xs text-gray-600 dark:text-gray-300 px-2 py-1 rounded bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500">
            nekt.us
          </span>
        </div>
        <div className="w-8"></div> {/* Spacer for balance */}
      </div>
      
      {/* Empty space or loading indicator as shown in wireframes */}
      <div className="py-10 flex items-center justify-center">
        {/* This area can be empty or contain loading spinner */}
      </div>
      
      {/* Profile information */}
      <div className="p-6 text-center border-t border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white uppercase">{name}</h2>
        {title && company && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {title} at {company}
          </p>
        )}
        {location && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {location}
          </p>
        )}
        
        {/* Social icons */}
        <div className="flex justify-center space-x-3 mt-4">
          {visibleSocialProfiles.map((profile, index) => (
            <SocialIcon 
              key={`${profile.platform}-${index}`}
              platform={profile.platform}
              username={profile.username}
            />
          ))}
        </div>
      </div>
      
      {/* Nekt button */}
      <div className="p-4 flex justify-center border-t border-gray-200 dark:border-gray-700">
        <button 
          onClick={onNektClick}
          className="nekt-button"
          disabled={!onNektClick}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 5L21 12L13 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 5L3 12L11 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{isCurrentUser ? 'Nekt' : 'Nekt Us'}</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileCard;
