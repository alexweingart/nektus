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

import { generateMessageText, openMessagingAppDirectly } from '@/lib/services/client/messagingService';
import { useSession } from 'next-auth/react';
import { FaArrowLeft } from 'react-icons/fa';
import { saveContactFlow } from '@/lib/services/client/contactSaveService';
import { startIncrementalAuth } from '@/lib/services/client/clientIncrementalAuthService';

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
  const getButtonText = () => 'Save Contact';
  const isSuccess = false;

  // Check for saved contact state on mount (but NOT auth return state)
  useEffect(() => {
    if (isHistoricalMode) return;
    
    const checkForSavedState = async () => {
      try {
        console.log('🔍 Checking for saved state on component mount...');
        
        // Only check for saved state (existing logic) - do NOT trigger saveContactFlow
        const savedStateKey = `contact_saved_${profile.userId}_${token}`;
        const savedState = localStorage.getItem(savedStateKey);
        if (savedState) {
          const { timestamp } = JSON.parse(savedState);
          // Only apply saved state if it's recent (within last 5 minutes)
          const timeDiff = Date.now() - timestamp;
          if (timeDiff < 300000) { // 5 minutes
            console.log('✅ Found recent saved state, showing success modal');
            setShowSuccessModal(true);
            return;
          } else {
            localStorage.removeItem(savedStateKey);
          }
        }
        
        console.log('ℹ️ No recent saved state found, waiting for user action');
      } catch (error) {
        console.error('Error checking for saved state:', error);
      }
    };

    checkForSavedState();
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

  // Check for auth return on page visibility change (handles back navigation from auth)
  useEffect(() => {
    if (isHistoricalMode) return;

    const handleVisibilityChange = async () => {
      console.log('📱 Visibility change detected:', document.visibilityState);
      
      if (document.visibilityState === 'visible') {
        console.log('🔍 Page became visible, checking for auth return...');
        console.log('📄 Current URL:', window.location.href);
        console.log('🔍 URL search params:', window.location.search);
        
        // Only trigger saveContactFlow if there are auth-related URL params
        const urlParams = new URLSearchParams(window.location.search);
        const hasAuthParams = urlParams.has('incremental_auth') || urlParams.has('code') || urlParams.has('state');
        
        if (!hasAuthParams) {
          console.log('ℹ️ No auth-related URL params found, skipping auth check');
          return;
        }
        
        console.log('👤 Profile:', profile.name);
        console.log('🎫 Token:', token);
        
        try {
          // Only call saveContactFlow if we're returning from auth
          console.log('🚀 Calling saveContactFlow for auth return...');
          const result = await saveContactFlow(profile, token);
          console.log('📊 SaveContactFlow result:', JSON.stringify(result, null, 2));
          
          if (result.showUpsellModal) {
            console.log('🆙 Setting showUpsellModal to true');
            setShowUpsellModal(true);
          }
          if (result.showSuccessModal) {
            console.log('✅ Setting showSuccessModal to true');
            setShowSuccessModal(true);
          }
          
          if (!result.showUpsellModal && !result.showSuccessModal) {
            console.log('❌ No modals to show from saveContactFlow result');
          }
        } catch (error) {
          console.error('❌ Error handling auth return:', error);
          console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
          // Silently handle errors - auth flow cancellation should not crash the app
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile, token, isHistoricalMode]);

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
    return null; // No visual loading state
  }

  return (
    <div className="fixed inset-0 z-[1000] backdrop-blur-sm">
      <div className="h-[100dvh] flex flex-col items-center px-4 py-2 relative z-[1001]">
        
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
