/**
 * ContactView component - Displays a matched contact's profile
 * Similar to ProfileView but read-only with Save/Reject actions
 */

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '../ui/buttons/Button';
import Avatar from '../ui/Avatar';
import SocialIconsList from '../ui/SocialIconsList';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import ReactMarkdown from 'react-markdown';
import type { UserProfile } from '@/types/profile';
import { StandardModal } from '../ui/StandardModal';
import { Text } from "../ui/Typography";
import { generateMessageText, openMessagingAppDirectly } from '@/lib/services/client/messagingService';
import { useSession } from 'next-auth/react';
import { FaArrowLeft } from 'react-icons/fa';
import { saveContactFlow } from '@/lib/services/client/contactSaveService';
import { startIncrementalAuth } from '@/lib/services/client/clientIncrementalAuthService';
import { getExchangeState, setExchangeState, shouldShowSuccess, shouldShowUpsell } from '@/lib/services/client/exchangeStateService';

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
  
  // Modal state with logging
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  
  // Add logging when modal states change
  useEffect(() => {
    console.log('🔄 Modal state changed - Success:', showSuccessModal, 'Upsell:', showUpsellModal);
  }, [showSuccessModal, showUpsellModal]);
  
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
        console.log('🔍 Checking exchange state on component mount...');
        
        const exchangeState = getExchangeState(token);
        console.log('🔍 Exchange state:', exchangeState);
        
        if (!exchangeState) {
          console.log('ℹ️ No exchange state found - waiting for user action');
          return;
        }
        
        // Check if this matches the current profile
        if (exchangeState.profileId !== profile.userId) {
          console.log('🔍 Exchange state profile mismatch:', {
            stored: exchangeState.profileId,
            current: profile.userId
          });
          return;
        }
        
        // Check for auth success URL params first
        const urlParams = new URLSearchParams(window.location.search);
        const authResult = urlParams.get('incremental_auth');
        
        if (authResult === 'success') {
          console.log('✅ Auth successful detected in URL - showing success modal immediately');
          
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
          saveContactFlow(profile, token).catch(error => {
            console.warn('Background Google save failed:', error);
            // Could optionally show a toast notification if the background save fails
          });
          
          return;
        }
        
        if (authResult === 'denied') {
          console.log('🚫 Auth denied detected in URL, calling saveContactFlow to handle denial');
          
          // For denied, we still need to call saveContactFlow to handle the denial logic
          const result = await saveContactFlow(profile, token);
          console.log('📊 SaveContactFlow result from mount (auth denied):', JSON.stringify(result, null, 2));
          
          if (result.showUpsellModal) {
            console.log('🆙 Setting showUpsellModal to true from mount check');
            setShowUpsellModal(true);
          }
          if (result.showSuccessModal) {
            console.log('✅ Setting showSuccessModal to true from mount check');
            setShowSuccessModal(true);
          }
          
          return;
        }
        
        // Handle different states (only if no auth params)
        if (exchangeState.state === 'completed_success') {
          console.log('✅ Found completed success state, showing success modal');
          setShowSuccessModal(true);
          return;
        }
        
        if (exchangeState.state === 'auth_in_progress') {
          console.log('🔄 Found auth in progress, calling saveContactFlow to handle potential auth return');
          
          // Call saveContactFlow to handle potential auth return
          const result = await saveContactFlow(profile, token);
          console.log('📊 SaveContactFlow result from mount:', JSON.stringify(result, null, 2));
          
          if (result.showUpsellModal) {
            console.log('🆙 Setting showUpsellModal to true from mount check');
            setShowUpsellModal(true);
          }
          if (result.showSuccessModal) {
            console.log('✅ Setting showSuccessModal to true from mount check');
            setShowSuccessModal(true);
          }
          
          return;
        }
        
        if (exchangeState.state === 'completed_firebase_only') {
          // Check if we should show upsell based on platform rules
          if (shouldShowUpsell(token, exchangeState.platform)) {
            console.log('🆙 Should show upsell modal for completed Firebase-only state');
            setShowUpsellModal(true);
          } else {
            console.log('✅ Should show success modal for completed Firebase-only state');
            setShowSuccessModal(true);
          }
          return;
        }
        
        console.log('ℹ️ Exchange state in pending state - waiting for user action');
      } catch (error) {
        console.error('Error checking exchange state:', error);
      }
    };

    checkExchangeState();
  }, [profile.userId, token, isHistoricalMode]);

  // Handle incremental auth results and back navigation
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const authResult = urlParams.get('incremental_auth');
      console.log('🔍 Auth result from URL params:', authResult);
      
      if (authResult === 'denied') {
        console.log('🚫 User denied Google Contacts permission');
        // Clean up URL - the ContactSaveService will handle showing upsell modal
        const url = new URL(window.location.href);
        url.searchParams.delete('incremental_auth');
        window.history.replaceState({}, document.title, url.toString());
      }
    } catch (error) {
      console.error('❌ Error handling incremental auth URL params:', error);
    }
  }, []);


  // Apply the contact's background image to the screen
  useEffect(() => {
    try {
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
        try {
          const bgDiv = document.getElementById('contact-background');
          if (bgDiv) {
            bgDiv.remove();
          }
        } catch (cleanupError) {
          console.warn('❌ Error cleaning up background:', cleanupError);
        }
      };
    } catch (error) {
      console.error('❌ Error applying contact background image:', error);
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
      console.log('💾 Saving contact:', profile.name);
      
      // Call the actual contact save service
      const result = await saveContactFlow(profile, token);
      console.log('💾 Save contact flow result:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('✅ Contact saved successfully');
        if (result.showSuccessModal) {
          console.log('✅ Showing success modal');
          setShowSuccessModal(true);
        }
        if (result.showUpsellModal) {
          console.log('🆙 Showing upsell modal');
          setShowUpsellModal(true);
        }
      } else {
        console.error('❌ Failed to save contact:', {
          firebase: result.firebase,
          google: result.google
        });
        // Could show an error state here
      }
      
    } catch (error) {
      console.error('❌ Failed to save contact (exception):', error);
      console.error('❌ Save contact error stack:', error instanceof Error ? error.stack : 'No stack');
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
      console.log('🔄 Starting Google auth for contacts permission...');
      
      // Use the proper startIncrementalAuth function with current user's ID
      await startIncrementalAuth(token, session?.user?.id || '');
      
    } catch (error) {
      console.error('Failed to start Google auth:', error);
      // Keep the upsell modal open on error
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
    const messageText = generateMessageText(contactFirstName, senderFirstName,undefined,profile.userId);
    
    // Try to use phone number if available
    const phoneNumber = profile.contactChannels?.phoneInfo?.internationalPhone;
    
    openMessagingAppDirectly(messageText, phoneNumber);
    
    // Exchange state already persists the completion status
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
    p: ({node, ...props}: any) => <Text variant="small" className="leading-relaxed mb-2" {...props} />,
    a: ({ node: _node, ...props }: any) => (
      <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
    ),
  }), []);

  if (!profile) {
    return null; // No visual loading state
  }

  return (
    <div className="fixed inset-0 z-[1000] backdrop-blur-sm">
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
                alt={profile.name || 'Contact'}
                size="lg"
              />
            </div>
          </div>
          
          {/* Content with blur background */}
          <div className="w-full bg-black/60 backdrop-blur-sm px-6 py-4 rounded-2xl" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
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
