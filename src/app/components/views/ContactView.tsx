/**
 * ContactView component - Displays a matched contact's profile
 * Similar to ProfileView but read-only with Save/Reject actions
 */

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '../ui/buttons/Button';
import Avatar from '../ui/Avatar';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import SocialIconsList from '../ui/SocialIconsList';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import ReactMarkdown from 'react-markdown';
import type { UserProfile } from '@/types/profile';
import { StandardModal } from '../ui/StandardModal';

import { generateMessageText, openMessagingAppDirectly } from '@/lib/services/messagingService';
import { useSession } from 'next-auth/react';
import { FaArrowLeft } from 'react-icons/fa';

interface ContactViewProps {
  profile: UserProfile;
  onReject: () => void;
  isLoading?: boolean;
  token: string;
  isHistoricalContact?: boolean;
}

export const ContactView: React.FC<ContactViewProps> = ({
  profile,
  onReject,
  isLoading = false,
  token,
  isHistoricalContact = false
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Check if we're in historical mode (either from URL param or prop)
  const isHistoricalMode = searchParams.get('mode') === 'historical' || isHistoricalContact;
  
  // Mock hooks for now - in historical mode we don't need these
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  
  const dismissSuccessModal = () => setShowSuccessModal(false);
  const dismissUpsellModal = () => setShowUpsellModal(false);
  const getButtonText = () => 'Save Contact';
  const isSuccess = false;

  // Only check for saved contact state in non-historical mode
  useEffect(() => {
    if (isHistoricalMode) return;
    
    const checkForSavedState = () => {
      try {
        const savedStateKey = `contact_saved_${profile.userId}_${token}`;
        const savedState = localStorage.getItem(savedStateKey);
        if (savedState) {
          const { timestamp } = JSON.parse(savedState);
          // Only apply saved state if it's recent (within last 5 minutes)
          const timeDiff = Date.now() - timestamp;
          if (timeDiff < 300000) { // 5 minutes
            // Show success modal for recently saved contact
            setShowSuccessModal(true);
          } else {
            localStorage.removeItem(savedStateKey);
          }
        }
      } catch (error) {
        console.error('Error checking for saved state:', error);
      }
    };

    checkForSavedState();
  }, [profile.userId, token, isHistoricalMode]);

  // Handle incremental auth results
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('incremental_auth');
    
    if (authResult === 'denied') {
      console.log('🚫 User denied Google Contacts permission');
      // Clean up URL - the ContactSaveService will handle showing upsell modal
      const url = new URL(window.location.href);
      url.searchParams.delete('incremental_auth');
      window.history.replaceState({}, document.title, url.toString());
    }
  }, []);

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
      // Clean up any saved state
      const savedStateKey = `contact_saved_${profile.userId}_${token}`;
      localStorage.removeItem(savedStateKey);
      // Close the ContactView by calling onReject (which navigates back)
      onReject();
      return;
    }

    try {
      setIsSaving(true);
      
      // Contact save logic would go here
      console.log('Would save contact:', profile.name);
      
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
    // Placeholder for upsell logic
    console.log('Upsell accept not implemented for simplified version');
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

  // Handle messaging for historical contacts
  const handleHistoricalMessage = () => {
    if (!session?.user?.name) {
      console.warn('Cannot send message: no user session');
      return;
    }

    const senderFirstName = session.user.name.split(' ')[0];
    const contactFirstName = profile.name.split(' ')[0];
    const messageText = generateMessageText(contactFirstName, senderFirstName);
    
    // Try to use phone number if available
    const phoneNumber = profile.contactChannels?.phoneInfo?.internationalPhone;
    
    openMessagingAppDirectly(messageText, phoneNumber);
  };

  // Handle back to history navigation
  const handleBackToHistory = () => {
    router.push('/history');
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
        
        {/* Header with back button for historical contacts */}
        <div className="w-full max-w-[var(--max-content-width,448px)] py-4 mb-4 flex-shrink-0">
          {isHistoricalContact ? (
            <div className="flex justify-start items-center">
              <Button 
                variant="circle"
                size="icon"
                className="w-14 h-14"
                onClick={onReject}
              >
                <FaArrowLeft className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div>{/* Empty space for non-historical contact view */}</div>
          )}
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
            {isHistoricalMode ? (
              // Historical mode buttons
              <>
                {/* Message Button (Primary) */}
                <Button 
                  variant="theme"
                  size="lg"
                  className="w-full font-bold text-lg"
                  onClick={handleHistoricalMessage}
                >
                  Say hi 👋
                </Button>
                
                {/* No secondary button for historical contacts when using new route */}
              </>
            ) : (
              // Normal contact exchange mode buttons
              <>
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
              </>
            )}
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
          secondaryButtonText="Nah, they'll text me"
          variant="success"
        />

        {/* Contact Write Upsell Modal */}
        <StandardModal
          isOpen={showUpsellModal}
          onClose={dismissUpsellModal}
          title="Save to Google Contacts?"
          subtitle={`We saved ${profile.name}'s contact to Nekt, but we need permission to save to Google so you can easily text them.`}
          primaryButtonText="Yes!"
          onPrimaryButtonClick={handleUpsellAccept}
          secondaryButtonText="Nah, just Nekt is fine"
          onSecondaryButtonClick={handleUpsellDecline}
          variant="upsell"
        />
      </div>
    </div>
  );
};
