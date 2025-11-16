/**
 * ContactView component - Displays a matched contact's profile
 * Similar to ProfileView but read-only with Save/Reject actions
 */

'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '../ui/buttons/Button';
import Avatar from '../ui/elements/Avatar';
import SocialIconsList from '../ui/elements/SocialIconsList';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import ReactMarkdown from 'react-markdown';
import type { UserProfile } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import { getFieldValue } from '@/lib/utils/profileTransforms';
import { StandardModal } from '../ui/modals/StandardModal';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { Text } from "../ui/Typography";
import { generateMessageText, openMessagingAppDirectly } from '@/lib/services/client/messagingService';
import { useSession } from 'next-auth/react';
import { saveContactFlow } from '@/lib/services/client/contactSaveService';
import { startIncrementalAuth } from '@/lib/services/client/clientIncrementalAuthService';
import { getExchangeState, setExchangeState, shouldShowUpsell, markUpsellShown, markUpsellDismissedGlobally } from '@/lib/services/client/exchangeStateService';
import { isEmbeddedBrowser } from '@/lib/utils/platformDetection';
import { useProfile } from '@/app/context/ProfileContext';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import { auth } from '@/lib/firebase/clientConfig';

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
  const { profile: userProfile } = useProfile();

  // Animation state
  // Check if we're returning from Google auth - skip animation in that case
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isReturningFromAuth = urlParams.get('incremental_auth') === 'success' || urlParams.get('incremental_auth') === 'denied';
  const [isEntering, setIsEntering] = useState(!isReturningFromAuth);
  const [isExiting, setIsExiting] = useState(false);
  const contactCardRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  // Check if we're in historical mode (either from URL param or prop)
  const isHistoricalMode = searchParams.get('mode') === 'historical' || isHistoricalContact;

  
  // Modal state with logging
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showAddCalendarModal, setShowAddCalendarModal] = useState(false);
  const [showCalendarAddedModal, setShowCalendarAddedModal] = useState(false);

  const dismissSuccessModal = () => setShowSuccessModal(false);
  const dismissUpsellModal = () => setShowUpsellModal(false);
  const dismissAddCalendarModal = () => setShowAddCalendarModal(false);
  const dismissCalendarAddedModal = () => setShowCalendarAddedModal(false);
  
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


  // Handle calendar OAuth callback - show success modal when calendar is added
  useEffect(() => {
    const calendarAdded = searchParams.get('calendar');
    if (calendarAdded === 'added') {
      // Clean up URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar');
      window.history.replaceState({}, document.title, url.toString());

      // Show success modal
      setShowCalendarAddedModal(true);
    }
  }, [searchParams]);

  // Handle back navigation with animation
  const handleBack = () => {
    const backClickTime = performance.now();
    console.log('🎯 ContactView: Back button clicked at', backClickTime.toFixed(2), 'ms, starting exit animation');
    sessionStorage.setItem('nav-back-clicked-at', backClickTime.toString());
    setIsExiting(true);

    // Mark that we're returning (for coordinating entrance animation)
    if (isHistoricalMode) {
      console.log('🎯 ContactView: Marking return to history');
      sessionStorage.setItem('returning-to-history', 'true');

      // Store contact background for crossfade
      if (profile.backgroundImage) {
        sessionStorage.setItem('contact-background-url', profile.backgroundImage);
      }
    } else {
      console.log('🎯 ContactView: Marking return to profile');
      sessionStorage.setItem('returning-to-profile', 'true');

      // Store contact background for crossfade
      if (profile.backgroundImage) {
        sessionStorage.setItem('contact-background-url', profile.backgroundImage);
      }
    }

    // Wait for exit animation to complete (reduced from 300ms for snappier navigation)
    setTimeout(() => {
      const navStartTime = performance.now();
      console.log('🎯 ContactView: Calling onReject (router.push) at', navStartTime.toFixed(2), 'ms');
      sessionStorage.setItem('nav-router-push-at', navStartTime.toString());
      onReject();
    }, 150);
  };

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

  // Phase 5: Handle calendar click for historical contacts
  const handleHistoricalCalendarClick = async () => {
    if (!session?.user?.id) {
      console.warn('Cannot schedule: no user session');
      return;
    }

    // For historical contacts, profile is actually a SavedContact with contactType
    const savedContact = profile as SavedContact;
    const contactType = savedContact.contactType;

    // Check if user has calendar for this contact's type using ProfileContext
    const userHasCalendar = userProfile?.calendars?.some(
      (cal) => cal.section === contactType
    );

    if (userHasCalendar) {
      // Navigate to smart-schedule page
      router.push(`/contact/${profile.userId}/smart-schedule`);
    } else {
      // Open Add Calendar modal
      setShowAddCalendarModal(true);
    }
  };

  // Phase 6: Handle Smart Schedule CTA
  const handleScheduleMeetUp = async () => {
    if (!session?.user?.id) return;

    // Get current profile type from localStorage
    const currentSection = (localStorage.getItem('profileViewMode') || 'personal') as 'personal' | 'work';

    // Check if user has a calendar for current profile type using ProfileContext
    const userHasCalendar = userProfile?.calendars?.some(
      (cal) => cal.section === currentSection
    );

    if (userHasCalendar) {
      // Navigate to smart-schedule page
      router.push(`/contact/${profile.userId}/smart-schedule`);
    } else {
      // Open Add Calendar modal
      setShowAddCalendarModal(true);
    }
  };

  // Handle calendar added callback from modal
  const handleCalendarAdded = () => {
    dismissAddCalendarModal();
    // After calendar is added, navigate to smart-schedule
    router.push(`/contact/${profile.userId}/smart-schedule`);
  };

  // Handle calendar added success modal CTA
  const handleCalendarAddedContinue = () => {
    dismissCalendarAddedModal();
    // Navigate to smart-schedule page
    router.push(`/contact/${profile.userId}/smart-schedule`);
  };

  const { data: session } = useSession();
  const hasFetchedSlotsRef = useRef(false);

  const bioContent = useMemo(() => {
    return getFieldValue(profile?.contactEntries, 'bio') || 'Welcome to my profile!';
  }, [profile?.contactEntries]);

  const markdownComponents = useMemo(() => ({
    p: (props: React.ComponentProps<'p'>) => <Text variant="small" className="leading-relaxed mb-2" {...props} />,
    a: (props: React.ComponentProps<'a'>) => (
      <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
    ),
  }), []);

  // Pre-fetch common time slots for historical contacts (proactive caching for scheduling)
  useEffect(() => {
    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;

    const preFetchCommonTimeSlots = async () => {
      if (!isHistoricalMode || !session?.user?.id || !profile?.userId || !auth?.currentUser) return;
      if (hasFetchedSlotsRef.current) return; // Already fetched

      const savedContact = profile as SavedContact;
      const contactType = savedContact.contactType;

      // Only pre-fetch if user has calendar for this contact type
      const userHasCalendar = userProfile?.calendars?.some(
        (cal) => cal.section === contactType
      );

      if (!userHasCalendar) return;

      hasFetchedSlotsRef.current = true;

      try {
        console.log('🔄 Proactively pre-fetching common time slots for contact page...');
        const idToken = await auth.currentUser.getIdToken();

        const response = await fetch('/api/scheduling/common-times', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            user1Id: session.user.id,
            user2Id: profile.userId,
            duration: 30,
            calendarType: contactType,
          }),
          signal: abortController.signal, // Allow request to be cancelled
        });

        if (response.ok) {
          const data = await response.json();
          const slots = data.slots || [];
          console.log(`✅ Proactively pre-fetched ${slots.length} common time slots (cached for scheduling)`);
        }
      } catch (error) {
        // Ignore abort errors (expected on unmount)
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Pre-fetch cancelled (component unmounted)');
        } else {
          console.log('Pre-fetch failed (non-critical):', error);
        }
      }
    };

    // Defer pre-fetch to avoid blocking initial render
    timeoutId = setTimeout(() => {
      preFetchCommonTimeSlots();
    }, 100); // 100ms delay ensures page is interactive first

    // Cleanup: abort ongoing requests and clear timeout
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [isHistoricalMode, session?.user?.id, profile?.userId, userProfile?.calendars]);

  // Add lifecycle logging
  useEffect(() => {
    console.log('🟢 ContactView: Component mounted');

    // Add a delay to see if component stays mounted
    const timer = setTimeout(() => {
      console.log('🟢 ContactView: Still mounted after 2 seconds');
    }, 2000);

    return () => {
      console.log('🔴 ContactView: Component unmounting');
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (profile?.userId) {
      console.log('🔄 ContactView: Profile changed to:', profile.userId);
    }
  }, [profile]);

  // Handle enter animation - delay 500ms to match profile exit
  useEffect(() => {
    // Skip animation if returning from auth
    if (isReturningFromAuth) {
      setIsEntering(false);
      return;
    }

    if (!isHistoricalMode) {
      // Delay enter animation by 500ms (matching profile exit duration)
      const enterTimer = setTimeout(() => {
        setIsEntering(false);
      }, 1000); // 500ms delay + 500ms animation = 1000ms total

      return () => clearTimeout(enterTimer);
    } else {
      // For historical mode, no delay needed
      setIsEntering(false);
    }
  }, [isHistoricalMode, isReturningFromAuth]);

  if (!profile) {
    console.log('❌ ContactView: No profile provided, returning null');
    return null; // No visual loading state
  }

  console.log('✅ ContactView: Rendering with profile:', profile.userId);

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="min-h-dvh flex flex-col items-center px-4 py-2 relative z-[1001]">

        {/* Header with back button for historical contacts */}
        {isHistoricalContact && (
          <div className="w-full max-w-[var(--max-content-width,448px)] flex-shrink-0">
            <PageHeader
              onBack={handleBack}
            />
          </div>
        )}

        {/* Fixed Content Area - No scroll */}
        <div className="w-full max-w-[var(--max-content-width,448px)] flex flex-col items-center justify-center flex-1 overflow-hidden">
          {/* Profile Image & Content - animated together */}
          <div
            ref={contactCardRef}
            className={`w-full flex flex-col items-center ${
              isEntering && !isHistoricalMode ? 'animate-contact-enter' : ''
            } ${
              isExiting ? 'animate-crossfade-exit' : ''
            }`}
            style={{
              animationDelay: isEntering && !isHistoricalMode ? '0ms' : '0ms',
              opacity: isEntering && !isHistoricalMode ? 0 : 1
            }}
          >
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
            <div className="w-full mb-4 text-center">
              {profile.contactEntries && (
                <SocialIconsList
                  contactEntries={profile.contactEntries}
                  size="md"
                  variant="white"
                />
              )}
            </div>
          </div>
          </div>
          {/* End of animated contact card wrapper */}

          {/* Action Buttons - staggered animation starting at 300ms */}
          <div
            ref={buttonsRef}
            className={`w-full mt-4 mb-4 space-y-3 ${
              isEntering && !isHistoricalMode ? 'animate-fade-in-up' : ''
            } ${
              isExiting ? 'animate-crossfade-exit' : ''
            }`}
            style={{
              maxWidth: 'var(--max-content-width, 448px)',
              animationDelay: isEntering && !isHistoricalMode ? '300ms' : '0ms',
              opacity: isEntering && !isHistoricalMode ? 0 : 1
            }}
          >
            {isHistoricalMode ? (
              // Historical mode buttons (Phase 5)
              <>
                {/* Meet Up Button (Primary) */}
                <Button
                  variant="white"
                  size="xl"
                  className="w-full font-bold"
                  onClick={handleHistoricalCalendarClick}
                >
                  Meet Up 🤝
                </Button>

                {/* Say Hi Button (Secondary) */}
                <div className="flex justify-center">
                  <SecondaryButton
                    onClick={handleHistoricalMessage}
                  >
                    Say Hi
                  </SecondaryButton>
                </div>
              </>
            ) : (
              // Normal contact exchange mode buttons
              <>
                {/* Save Contact Button (Primary) */}
                <Button
                  variant="white"
                  size="xl"
                  className="w-full font-bold"
                  onClick={handleSaveContact}
                  disabled={isSaving || isLoading}
                >
                  {getButtonText()}
                </Button>

                {/* Success/Error Messages - handled by modals now */}

                {/* Phase 6: Smart Schedule CTA - shown when contact is saved (Done state) */}
                {isSuccess && (
                  <div className="flex justify-center">
                    <SecondaryButton
                      variant="dark"
                      onClick={handleScheduleMeetUp}
                    >
                      Schedule next meet up now!
                    </SecondaryButton>
                  </div>
                )}

                {/* Reject Button (Secondary) - only show when not saved yet */}
                {!isSuccess && (
                  <div className="flex justify-center">
                    <SecondaryButton
                      onClick={handleBack}
                      disabled={isSaving || isLoading}
                    >
                      Nah, who this
                    </SecondaryButton>
                  </div>
                )}
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
          showCloseButton={false}
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
          showCloseButton={false}
        />

        {/* Add Calendar Modal */}
        <AddCalendarModal
          isOpen={showAddCalendarModal}
          onClose={dismissAddCalendarModal}
          section={
            isHistoricalMode
              ? (profile as SavedContact).contactType
              : (localStorage.getItem('profileViewMode') || 'personal') as 'personal' | 'work'
          }
          userEmail={session?.user?.email || ''}
          onCalendarAdded={handleCalendarAdded}
        />

        {/* Calendar Added Success Modal */}
        <StandardModal
          isOpen={showCalendarAddedModal}
          onClose={dismissCalendarAddedModal}
          title="Calendar Connected! 🎉"
          subtitle="Your calendar has been connected successfully. Let's find a time to meet up!"
          primaryButtonText="Find a time"
          onPrimaryButtonClick={handleCalendarAddedContinue}
          showSecondaryButton={false}
          showCloseButton={false}
        />
      </div>
    </div>
  );
};