/**
 * ContactView component - Displays a matched contact's profile
 * Similar to ProfileView but read-only with Save/Reject actions
 */

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '../ui/buttons/Button';
import Avatar from '../ui/Avatar';
import SocialIconsList from '../ui/SocialIconsList';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import ReactMarkdown from 'react-markdown';
import type { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/lib/utils/profileTransforms';
import { StandardModal } from '../ui/StandardModal';
import { Text } from "../ui/Typography";
import { generateMessageText, openMessagingAppDirectly } from '@/lib/services/client/messagingService';
import { useSession } from 'next-auth/react';
import { FaArrowLeft } from 'react-icons/fa';
import { saveContactFlow } from '@/lib/services/client/contactSaveService';
import { startIncrementalAuth } from '@/lib/services/client/clientIncrementalAuthService';
import { getExchangeState, setExchangeState, shouldShowUpsell, markUpsellShown, markUpsellDismissedGlobally } from '@/lib/services/client/exchangeStateService';
import { isEmbeddedBrowser } from '@/lib/utils/platformDetection';

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
  
  // Check if we're in historical mode (either from URL param or prop)
  const isHistoricalMode = searchParams.get('mode') === 'historical' || isHistoricalContact;
  
  // Modal state with logging
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  
  
  const dismissSuccessModal = () => setShowSuccessModal(false);
  const dismissUpsellModal = () => setShowUpsellModal(false);
  
  // Check if contact is already saved by checking exchange state
  const exchangeState = getExchangeState(token);
  const isSuccess = exchangeState?.state === 'completed_success' || exchangeState?.state === 'completed_firebase_only';
  const getButtonText = () => isSuccess ? "Done" : 'Save Contact';

  // Check for exchange state on mount
  useEffect(() => {
    if (isHistoricalMode) return;
    
    const checkExchangeState = async () => {
      try {
        const exchangeState = getExchangeState(token);
        
        if (!exchangeState) {
          return;
        }
        
        // Check if this matches the current profile
        if (exchangeState.profileId !== profile.userId) {
          return;
        }
        
        // Check for auth success URL params first
        const urlParams = new URLSearchParams(window.location.search);
        const authResult = urlParams.get('incremental_auth');
        
        if (authResult === 'success') {
          // Show success modal immediately - we know auth succeeded!
          setShowSuccessModal(true);
          
          // Clean up URL parameters
          const url = new URL(window.location.href);
          url.searchParams.delete('incremental_auth');
          url.searchParams.delete('contact_save_token');
          url.searchParams.delete('profile_id');
          window.history.replaceState({}, document.title, url.toString());
          
          // Update exchange state to completed_success immediately
          setExchangeState(token, {
            state: 'completed_success',
            platform: exchangeState?.platform || 'android',
            profileId: profile.userId || '',
            timestamp: Date.now()
          });
          
          // Make Google API call in background (don't wait for it)
          saveContactFlow(profile, token).catch(() => {
            // Could optionally show a toast notification if the background save fails
          });
          
          return;
        }
        
        if (authResult === 'denied') {
          // For denied, we still need to call saveContactFlow to handle the denial logic
          const result = await saveContactFlow(profile, token);
          
          if (result.showUpsellModal) {
            setShowUpsellModal(true);
          }
          if (result.showSuccessModal) {
            setShowSuccessModal(true);
          }
          
          return;
        }
        
        // Handle different states (only if no auth params)
        if (exchangeState.state === 'completed_success') {
          setShowSuccessModal(true);
          return;
        }
        
        if (exchangeState.state === 'auth_in_progress') {
          // Call saveContactFlow to handle potential auth return
          const result = await saveContactFlow(profile, token);
          
          if (result.showUpsellModal) {
            setShowUpsellModal(true);
          }
          if (result.showSuccessModal) {
            setShowSuccessModal(true);
          }
          
          return;
        }
        
        if (exchangeState.state === 'completed_firebase_only') {
          // Check if we should show upsell based on platform rules
          const iosNonEmbedded = exchangeState.platform === 'ios' && !isEmbeddedBrowser();
          if (shouldShowUpsell(token, exchangeState.platform, iosNonEmbedded)) {
            setShowUpsellModal(true);
          } else {
            setShowSuccessModal(true);
          }
          return;
        }
        
      } catch {
        // Error checking exchange state
      }
    };

    checkExchangeState();
  }, [profile, profile.userId, token, isHistoricalMode]);



  // Apply the contact's background image or default pattern to the screen
  useEffect(() => {
    try {
      // Clean up any existing backgrounds (both contact and app backgrounds)
      const existingContactBg = document.getElementById('contact-background');
      if (existingContactBg) {
        existingContactBg.remove();
      }
      
      // Clean up any app background that might be showing user's background
      const existingAppBg = document.getElementById('app-background');
      if (existingAppBg) {
        existingAppBg.remove();
      }

      // Remove default background class from body and reset body background
      document.body.classList.remove('default-nekt-background');
      document.body.style.background = '';

      if (profile?.backgroundImage) {
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
      } else {
        // No contact background image, always use default green pattern
        // NEVER show the user's own background image in contact view
        document.body.classList.add('default-nekt-background');
      }

      // Cleanup function
      return () => {
        try {
          const bgDiv = document.getElementById('contact-background');
          if (bgDiv) {
            bgDiv.remove();
          }
          document.body.classList.remove('default-nekt-background');
          document.body.style.background = '';
        } catch {
          // Error cleaning up background
        }
      };
    } catch {
      // Error applying contact background
    }
  }, [profile?.backgroundImage]);

  const handleSaveContact = async () => {
    try {
      // Check if contact is already saved (button shows "I'm Done")
      if (isSuccess) {
        // Clean up any saved state
        const savedStateKey = `contact_saved_${profile.userId}_${token}`;
        localStorage.removeItem(savedStateKey);
        // Close the ContactView by calling onReject (which navigates back)
        onReject();
        return;
      }

      setIsSaving(true);
      
      // Call the actual contact save service
      const result = await saveContactFlow(profile, token);
      
      if (result.success) {
        if (result.showSuccessModal) {
          setShowSuccessModal(true);
        }
        if (result.showUpsellModal) {
          setShowUpsellModal(true);
        }
      } else {
        // Could show an error state here
      }
      
    } catch {
      // Failed to save contact
    } finally {
      setIsSaving(false);
    }
  };

  // Handle navigation after success modal is dismissed
  const handleSuccessModalClose = () => {
    dismissSuccessModal();
    // Exchange state already persists the completion status
  };

  const handleUpsellAccept = async () => {
    try {
      // Use the proper startIncrementalAuth function with current user's ID
      await startIncrementalAuth(token, session?.user?.id || '');
      
    } catch {
      // Keep the upsell modal open on error
    }
  };

  const handleUpsellDecline = () => {
    dismissUpsellModal();
    
    // For iOS Safari/Chrome/Edge, use global tracking
    const exchangeState = getExchangeState(token);
    const iosNonEmbedded = exchangeState?.platform === 'ios' && !isEmbeddedBrowser();
    
    if (iosNonEmbedded) {
      // Mark globally for iOS non-embedded browsers
      markUpsellDismissedGlobally();
    } else {
      // Use per-token tracking for other platforms
      markUpsellShown(token);
    }
  };

  // Helper function to extract phone number from contact entries
  const extractPhoneNumber = (contactEntries: typeof profile.contactEntries): string => {
    if (!contactEntries) return '';
    const phoneEntry = contactEntries.find(e => e.fieldType === 'phone');
    return phoneEntry?.value || '';
  };

  const handleSayHi = () => {
    if (!session?.user?.name) {
      return;
    }

    const senderFirstName = session.user.name.split(' ')[0];
    const contactFirstName = getFieldValue(profile.contactEntries, 'name').split(' ')[0];
    const messageText = generateMessageText(contactFirstName, senderFirstName,undefined,profile.userId);
    const phoneNumber = extractPhoneNumber(profile.contactEntries);
    
    openMessagingAppDirectly(messageText, phoneNumber);
    
    // Exchange state already persists the completion status
    dismissSuccessModal();
  };

  // Handle messaging for historical contacts
  const handleHistoricalMessage = () => {
    if (!session?.user?.name) {
      return;
    }

    const senderFirstName = session.user.name.split(' ')[0];
    const contactFirstName = getFieldValue(profile.contactEntries, 'name').split(' ')[0];
    const messageText = generateMessageText(contactFirstName, senderFirstName);
    const phoneNumber = extractPhoneNumber(profile.contactEntries);
    
    openMessagingAppDirectly(messageText, phoneNumber);
  };


  const { data: session } = useSession();
  const bioContent = useMemo(() => {
    return getFieldValue(profile?.contactEntries, 'bio') || 'Welcome to my profile!';
  }, [profile?.contactEntries]);

  const markdownComponents = useMemo(() => ({
    p: (props: React.ComponentProps<'p'>) => <Text variant="small" className="leading-relaxed mb-2" {...props} />,
    a: (props: React.ComponentProps<'a'>) => (
      <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
    ),
  }), []);

  if (!profile) {
    return null; // No visual loading state
  }


  return (
    <div className="fixed inset-0 z-[1000]">
      
      <div className="h-[100dvh] flex flex-col items-center justify-center px-4 py-2 relative z-[1001]">
        
        {/* Header with back button for historical contacts */}
        {isHistoricalContact && (
          <div className="w-full max-w-[var(--max-content-width,448px)] flex-shrink-0">
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
          </div>
        )}
        
        {/* Fixed Content Area - No scroll */}
        <div className="w-full max-w-[var(--max-content-width,448px)] flex flex-col items-center justify-center flex-1 overflow-hidden">
          {/* Profile Image */}
          <div className="mb-4">
            <div className="border-4 border-white shadow-lg rounded-full">
              <Avatar 
                src={profile.profileImage} 
                alt={getFieldValue(profile.contactEntries, 'name') || 'Contact'}
                size="lg"
              />
            </div>
          </div>
          
          {/* Content with blur background */}
          <div className="w-full bg-black/60 backdrop-blur-sm px-6 py-4 rounded-2xl" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
            {/* Name */}
            <div className="text-center mb-4">
              <h1 className="text-white text-2xl font-bold">{getFieldValue(profile.contactEntries, 'name') || 'Anonymous'}</h1>
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
              {profile.contactEntries && (
                <SocialIconsList
                  contactEntries={profile.contactEntries}
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
                  size="xl"
                  className="w-full font-bold"
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
                  size="xl"
                  className="w-full font-bold"
                  onClick={handleSaveContact}
                  disabled={isSaving || isLoading}
                >
                  {getButtonText()}
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
          subtitle={`${getFieldValue(profile.contactEntries, 'name')}'s contact has been saved successfully!`}
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
          subtitle={`We saved ${getFieldValue(profile.contactEntries, 'name')}'s contact to Nekt, but we need permission to save to Google so you can easily text them.`}
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