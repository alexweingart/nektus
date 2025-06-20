/**
 * ContactView component - Displays a matched contact's profile
 * Similar to ProfileView but read-only with Save/Reject actions
 */

'use client';

import React, { useMemo, useState } from 'react';
import { Button } from './ui/Button';
import Avatar from './ui/Avatar';
import SocialIcon from './ui/SocialIcon';
import { SuccessModal } from './ui/SuccessModal';
import ReactMarkdown from 'react-markdown';
import type { UserProfile } from '@/types/profile';

interface ContactViewProps {
  profile: UserProfile;
  onSaveContact: () => Promise<void>;
  onReject: () => void;
  isLoading?: boolean;
  onMessageContact?: (profile: UserProfile) => void;
}

export const ContactView: React.FC<ContactViewProps> = ({
  profile,
  onSaveContact,
  onReject,
  isLoading = false,
  onMessageContact
}) => {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveContact = async () => {
    setIsSaving(true);
    try {
      await onSaveContact();
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to save contact:', error);
      // Error handling is done in the parent component
    } finally {
      setIsSaving(false);
    }
  };

  const handleMessageContact = () => {
    setShowSuccessModal(false);
    if (onMessageContact) {
      onMessageContact(profile);
    }
  };
  const bioContent = useMemo(() => {
    return profile?.bio || 'Welcome to my profile!';
  }, [profile?.bio]);

  const markdownComponents = useMemo(() => ({
    p: ({node, ...props}: any) => <p className="text-white text-sm leading-relaxed mb-2" {...props} />,
    a: ({ node: _node, ...props }: any) => (
      <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
    ),
  }), []);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading contact...</p>
        </div>
      </div>
    );
  }

  const backgroundStyle: React.CSSProperties = profile.backgroundImage
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `url(${profile.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: -1,
      }
    : {};

  return (
    <div className="h-[100dvh] flex flex-col items-center px-4 py-2">
      {/* Background Image */}
      {profile.backgroundImage && <div style={backgroundStyle} />}
      
      {/* Top spacing - no navigation buttons for contact view */}
      <div className="w-full max-w-[var(--max-content-width,448px)] py-4 mb-4 flex-shrink-0">
        {/* Empty space where nav buttons would be */}
      </div>
      
      {/* Fixed Content Area - No scroll */}
      <div className="w-full max-w-[var(--max-content-width,448px)] flex flex-col items-center flex-1 overflow-hidden">
        {/* Profile Image */}
        <div className="mb-4">
          <div className="border-4 border-white shadow-lg rounded-full">
            <Avatar 
              src={profile.profileImage} 
              alt={profile.name || 'Contact'}
              size="lg"
            />
          </div>
        </div>
        
        {/* Content with blur background */}
        <div className="w-full bg-black/40 backdrop-blur-sm px-6 py-4 rounded-2xl" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
          {/* Name */}
          <div className="text-center mb-4">
            <h1 className="text-white text-2xl font-bold">{profile.name || 'Anonymous'}</h1>
          </div>
          
          {/* Bio */}
          <div className="text-center mb-6">
            <div className="text-white text-sm leading-relaxed">
              <ReactMarkdown components={markdownComponents}>
                {bioContent}
              </ReactMarkdown>
            </div>
          </div>
          
          {/* Social Media Icons */}
          <div className="w-full">
            <div className="flex flex-wrap justify-center gap-4 mb-4">
              {profile.contactChannels?.phoneInfo?.internationalPhone && (
                <a 
                  href={`tel:${profile.contactChannels.phoneInfo.internationalPhone}`}
                  className="text-white hover:text-green-300 transition-colors"
                >
                  <SocialIcon platform="phone" username={profile.contactChannels.phoneInfo.internationalPhone} size="md" variant="white" />
                </a>
              )}
              
              {profile.contactChannels?.email?.email && (
                <a 
                  href={`mailto:${profile.contactChannels.email.email}`}
                  className="text-white hover:text-blue-300 transition-colors"
                >
                  <SocialIcon platform="email" username={profile.contactChannels.email.email} size="md" variant="white" />
                </a>
              )}
              
              {profile.contactChannels?.facebook?.username && (
                <a 
                  href={`https://facebook.com/${profile.contactChannels.facebook.username}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  <SocialIcon platform="facebook" username={profile.contactChannels.facebook.username} size="md" variant="white" />
                </a>
              )}
              
              {profile.contactChannels?.instagram?.username && (
                <a 
                  href={`https://instagram.com/${profile.contactChannels.instagram.username}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-pink-400 transition-colors"
                >
                  <SocialIcon platform="instagram" username={profile.contactChannels.instagram.username} size="md" variant="white" />
                </a>
              )}
              
              {profile.contactChannels?.x?.username && (
                <a 
                  href={`https://x.com/${profile.contactChannels.x.username}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-[hsl(var(--background))] transition-colors"
                >
                  <SocialIcon platform="x" username={profile.contactChannels.x.username} size="md" variant="white" />
                </a>
              )}
              
              {profile.contactChannels?.whatsapp?.username && (
                <a 
                  href={`https://wa.me/${profile.contactChannels.whatsapp.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-green-300 transition-colors"
                >
                  <SocialIcon platform="whatsapp" username={profile.contactChannels.whatsapp.username} size="md" variant="white" />
                </a>
              )}
              
              {profile.contactChannels?.snapchat?.username && (
                <a 
                  href={`https://www.snapchat.com/add/${profile.contactChannels.snapchat.username}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-yellow-300 transition-colors"
                >
                  <SocialIcon platform="snapchat" username={profile.contactChannels.snapchat.username} size="md" variant="white" />
                </a>
              )}
              
              {profile.contactChannels?.telegram?.username && (
                <a 
                  href={`https://t.me/${profile.contactChannels.telegram.username}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-blue-300 transition-colors"
                >
                  <SocialIcon platform="telegram" username={profile.contactChannels.telegram.username} size="md" variant="white" />
                </a>
              )}
              
              {profile.contactChannels?.wechat?.username && (
                <a 
                  href={`weixin://dl/chat?${profile.contactChannels.wechat.username}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-[hsl(var(--background))] transition-colors"
                >
                  <SocialIcon platform="wechat" username={profile.contactChannels.wechat.username} size="md" variant="white" />
                </a>
              )}
              
              {profile.contactChannels?.linkedin?.username && (
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
        <div className="w-full mt-4 mb-4 space-y-3" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
          {/* Save Contact Button (Primary) */}
          <Button 
            variant="theme"
            size="lg"
            className="w-full font-bold text-lg"
            onClick={handleSaveContact}
            disabled={isSaving || isLoading}
          >
            {isSaving ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                <span>Saving...</span>
              </div>
            ) : (
              'Save Contact'
            )}
          </Button>
          
          {/* Reject Button (Secondary) */}
          <div className="flex justify-center">
            <button
              onClick={onReject}
              disabled={isSaving || isLoading}
              className="bg-white/80 px-3 py-1 rounded-xl text-black hover:bg-white text-sm transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              Nah, who this
            </button>
          </div>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Yay! New friend"
        subtitle="Send them some love now so ya'll stay in touch"
        buttonText="👋"
        onButtonClick={handleMessageContact}
      />
    </div>
    </div>
  );
};
