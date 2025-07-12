/**
 * ContactView component - Displays a matched contact's profile
 * Similar to ProfileView but read-only with Save/Reject actions
 */

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '../ui/buttons/Button';
import Avatar from '../ui/Avatar';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import SocialIconsList from '../ui/SocialIconsList';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import ReactMarkdown from 'react-markdown';
import type { UserProfile } from '@/types/profile';
import { useContactSaveFlow } from '@/lib/hooks/useContactSaveFlow';
import { StandardModal } from '../ui/StandardModal';

import { generateMessageText, openMessagingAppDirectly } from '@/lib/services/messagingService';
import { useSession } from 'next-auth/react';

interface ContactViewProps {
  profile: UserProfile;
  onReject: () => void;
  isLoading?: boolean;
  token: string;
}

export const ContactView: React.FC<ContactViewProps> = ({
  profile,
  onReject,
  isLoading = false,
  token
}) => {
  const [isSaving, setIsSaving] = useState(false);
  
  // Use the simplified contact save flow hook
  const {
    saveContact,
    retryPermission,
    dismissSuccessModal,
    dismissUpsellModal,
    showSuccessModal,
    showUpsellModal,
    getButtonText,
    isSuccess,
    restoreSuccessState
  } = useContactSaveFlow();

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔍 ContactView state update:', {
      isSuccess,
      showSuccessModal,
      showUpsellModal,
      buttonText: getButtonText()
    });
  }, [isSuccess, showSuccessModal, showUpsellModal, getButtonText]);

  // Check for saved contact state on component mount
  useEffect(() => {
    const checkForSavedState = () => {
      try {
        const savedStateKey = `contact_saved_${profile.userId}_${token}`;
        const savedState = localStorage.getItem(savedStateKey);
        if (savedState) {
          const { timestamp } = JSON.parse(savedState);
          // Only apply saved state if it's recent (within last 5 minutes)
          const timeDiff = Date.now() - timestamp;
          if (timeDiff < 300000) { // 5 minutes
            console.log('🔄 Restoring saved contact state for:', profile.name);
            // Restore the success state in the hook
            restoreSuccessState(profile.userId, token);
          } else {
            localStorage.removeItem(savedStateKey);
          }
        }
      } catch (error) {
        console.error('Error checking for saved state:', error);
      }
    };

    checkForSavedState();
  }, [profile.userId, token, profile.name, restoreSuccessState]);

  // Apply the contact's background image to the screen
  useEffect(() => {
    if (!profile?.backgroundImage) return;

    // Clean up any existing contact background
    const existingBg = document.getElementById('contact-background');
    if (existingBg) {
      existingBg.remove();
    }

    // Create background div with contact's background image
    const cleanedUrl = profile.backgroundImage.replace(/[\n\r\t]/g, '').trim();
    const backgroundDiv = document.createElement('div');
    backgroundDiv.id = 'contact-background';
    backgroundDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url(${cleanedUrl});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      z-index: 999;
      pointer-events: none;
    `;
    document.body.appendChild(backgroundDiv);

    // Cleanup function
    return () => {
      const bgDiv = document.getElementById('contact-background');
      if (bgDiv) {
        bgDiv.remove();
      }
    };
  }, [profile?.backgroundImage]);

  const handleSaveContact = async () => {
    // Check if contact is already saved (button shows "I'm Done")
    if (isSuccess) {
      console.log('🎉 Contact already saved, closing ContactView');
      // Clean up any saved state
      const savedStateKey = `contact_saved_${profile.userId}_${token}`;
      localStorage.removeItem(savedStateKey);
      // Close the ContactView by calling onReject (which navigates back)
      onReject();
      return;
    }

    try {
      setIsSaving(true);
      
      // Run the full contact save flow (this includes accepting the exchange)
      await saveContact(profile, token);
      
      // Note: Don't store success state here immediately - let the success modal show first
      // The persistence will be handled when the modal is dismissed
      
    } catch (error) {
      console.error('Failed to save contact:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle navigation after success modal is dismissed
  const handleSuccessModalClose = () => {
    dismissSuccessModal();
    
    // Store success state for persistence across navigation when modal is closed
    const savedStateKey = `contact_saved_${profile.userId}_${token}`;
    localStorage.setItem(savedStateKey, JSON.stringify({
      timestamp: Date.now(),
      profileId: profile.userId,
      token: token
    }));
  };

  const handleUpsellAccept = async () => {
    try {
      await retryPermission(profile, token);
    } catch (error) {
      console.error('Failed to retry permission:', error);
    }
  };

  const handleUpsellDecline = () => {
    dismissUpsellModal();
  };

  const handleSayHi = () => {
    if (!session?.user?.name) {
      console.warn('Cannot send message: no user session');
      return;
    }

    const senderFirstName = session.user.name.split(' ')[0];
    const contactFirstName = profile.name.split(' ')[0];
    const messageText = generateMessageText(contactFirstName, senderFirstName);
    
    // Try to use phone number if available
    const phoneNumber = profile.contactChannels?.phoneInfo?.internationalPhone;
    
    console.log('📱 Opening messaging app directly with pre-populated text');
    openMessagingAppDirectly(messageText, phoneNumber);
    
    // Store success state for persistence and dismiss modal
    const savedStateKey = `contact_saved_${profile.userId}_${token}`;
    localStorage.setItem(savedStateKey, JSON.stringify({
      timestamp: Date.now(),
      profileId: profile.userId,
      token: token
    }));
    
    dismissSuccessModal();
  };

  const { data: session } = useSession();
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
      <div className="flex items-center justify-center min-h-dvh">
        <div className="text-center">
          <LoadingSpinner size="sm" className="mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Loading contact...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/20 backdrop-blur-sm">
      <div className="h-[100dvh] flex flex-col items-center px-4 py-2 relative z-[1001]">
        
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
            <div className="w-full mb-4">
              {profile.contactChannels && (
                <SocialIconsList
                  contactChannels={profile.contactChannels}
                  size="md"
                  variant="white"
                />
              )}
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
                  <LoadingSpinner size="sm" />
                  <span>{getButtonText()}</span>
                </div>
              ) : (
                getButtonText()
              )}
            </Button>
            
            {/* Success/Error Messages - handled by modals now */}
            
            {/* Reject Button (Secondary) */}
            <div className="flex justify-center">
              <SecondaryButton
                onClick={onReject}
                disabled={isSaving || isLoading}
              >
                Nah, who this
              </SecondaryButton>
            </div>
          </div>
        </div>

        {/* Success Modal */}
        <StandardModal
          isOpen={showSuccessModal}
          onClose={handleSuccessModalClose}
          title="Contact Saved! 🎉"
          subtitle={`${profile.name}'s contact has been saved successfully!`}
          primaryButtonText="Say hi 👋"
          onPrimaryButtonClick={handleSayHi}
          secondaryButtonText="I'm done"
          variant="success"
        />

        {/* Contact Write Upsell Modal */}
        <StandardModal
          isOpen={showUpsellModal}
          onClose={dismissUpsellModal}
          title="Whoops - contact not fully saved"
          subtitle="You need to let us save contacts to Google to easily text your new friend!"
          primaryButtonText="OK! I'll do that"
          onPrimaryButtonClick={handleUpsellAccept}
          secondaryButtonText="Nah"
          onSecondaryButtonClick={handleUpsellDecline}
          variant="upsell"
        />
      </div>
    </div>
  );
};
