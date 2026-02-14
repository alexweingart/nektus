/**
 * ContactView component - Displays a matched contact's profile
 * Similar to ProfileView but read-only with Save/Reject actions
 */

'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { ContactButton } from '../ui/buttons/ContactButton';
import { ContactInfo } from '../ui/modules/ContactInfo';
import type { UserProfile } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import { getFieldValue, getPhoneNumber, getFirstName } from '@/client/profile/transforms';
import { StandardModal } from '../ui/modals/StandardModal';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { Text } from "../ui/Typography";
import { generateMessageText, openMessagingAppDirectly } from '@/client/contacts/messaging';
import { useSession } from 'next-auth/react';
import { saveContactFlow } from '@/client/contacts/save';
import { startIncrementalAuth } from '@/client/auth/google-incremental';
import { getExchangeState, markUpsellShown, markUpsellDismissedGlobally } from '@/client/contacts/exchange/state';
import { isEmbeddedBrowser } from '@/client/platform-detection';
import { useProfile } from '@/app/context/ProfileContext';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import { useContactExchangeState } from '@/client/hooks/use-contact-exchange-state';
import { useSchedulingPreFetch } from '@/client/hooks/use-scheduling-pre-fetch';
import { useContactBackNavigation } from '@/client/hooks/use-contact-back-navigation';
import { useCalendarLocationManagement } from '@/client/hooks/use-calendar-location-management';

interface ContactViewProps {
  profile: UserProfile;
  onReject: () => void;
  isLoading?: boolean;
  token: string;
  isHistoricalContact?: boolean;
  skipEnterAnimation?: boolean;
}

export const ContactView: React.FC<ContactViewProps> = ({
  profile,
  onReject,
  isLoading = false,
  token,
  isHistoricalContact = false,
  skipEnterAnimation = false
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile: userProfile } = useProfile();
  const { data: session } = useSession();

  // Animation state
  // Check if we're returning from Google auth - skip animation in that case
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isReturningFromAuth = urlParams.get('incremental_auth') === 'success' || urlParams.get('incremental_auth') === 'denied';
  const [isEntering, setIsEntering] = useState(!isReturningFromAuth && !skipEnterAnimation);
  const contactCardRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  // Check if we're in historical mode (either from URL param or prop)
  const isHistoricalMode = searchParams.get('mode') === 'historical' || isHistoricalContact;

  // Modal state management via custom hook
  const {
    showSuccessModal,
    setShowSuccessModal,
    showUpsellModal,
    setShowUpsellModal,
    isSuccess
  } = useContactExchangeState(token, profile, isHistoricalMode);

  // Additional modals not managed by the hook
  const [showAddCalendarModal, setShowAddCalendarModal] = useState(false);

  // Back navigation with animation handling
  const { isExiting, handleBack } = useContactBackNavigation(isHistoricalMode, profile, onReject);

  // Calendar/location management with OAuth callback for smart-schedule navigation
  useCalendarLocationManagement({
    profile: userProfile,
    saveProfile: async () => null, // Not needed for ContactView
    onCalendarAddedViaOAuth: () => {
      // Navigate directly to smart-schedule after OAuth calendar addition
      router.push(`/c/${profile.shortCode}/smart-schedule`);
    }
  });

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
    setShowSuccessModal(false);
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
    setShowUpsellModal(false);

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

  const handleSayHi = () => {
    const senderName = getFieldValue(userProfile?.contactEntries, 'name') || session?.user?.name;
    if (!senderName) {
      return;
    }

    const senderFirstName = getFirstName(senderName);
    const contactFirstName = getFirstName(getFieldValue(profile.contactEntries, 'name'));
    // Use shortCode if available, fall back to userId (both work with /c/ route)
    const senderProfileId = userProfile?.shortCode;
    const messageText = generateMessageText(contactFirstName, senderFirstName, undefined, senderProfileId);
    const phoneNumber = getPhoneNumber(profile.contactEntries);

    openMessagingAppDirectly(messageText, phoneNumber);

    // Exchange state already persists the completion status
    setShowSuccessModal(false);
  };

  // Handle messaging for historical contacts
  const handleHistoricalMessage = () => {
    const senderName = getFieldValue(userProfile?.contactEntries, 'name') || session?.user?.name;
    if (!senderName) {
      return;
    }

    const senderFirstName = getFirstName(senderName);
    const contactFirstName = getFirstName(getFieldValue(profile.contactEntries, 'name'));
    const senderProfileId = userProfile?.shortCode;
    const messageText = generateMessageText(contactFirstName, senderFirstName, undefined, senderProfileId);
    const phoneNumber = getPhoneNumber(profile.contactEntries);

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
      router.push(`/c/${profile.shortCode}/smart-schedule`);
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

    // Stash the contact profile in sessionStorage so SmartScheduleView can use it
    // immediately without waiting for the saved contacts cache to update
    try {
      sessionStorage.setItem('smartScheduleContact', JSON.stringify({
        profile,
        contactType: currentSection,
      }));
    } catch {
      // sessionStorage may be unavailable, proceed anyway
    }

    // Check if user has a calendar for current profile type using ProfileContext
    const userHasCalendar = userProfile?.calendars?.some(
      (cal) => cal.section === currentSection
    );

    if (userHasCalendar) {
      // Navigate to smart-schedule page
      router.push(`/c/${profile.shortCode}/smart-schedule`);
    } else {
      // Open Add Calendar modal
      setShowAddCalendarModal(true);
    }
  };

  // Handle calendar added callback from modal
  const handleCalendarAdded = () => {
    setShowAddCalendarModal(false);
    // After calendar is added, navigate to smart-schedule
    router.push(`/c/${profile.shortCode}/smart-schedule`);
  };

  // Pre-fetch common time slots for historical contacts (proactive caching for scheduling)
  useSchedulingPreFetch({
    isHistoricalMode,
    sessionUserId: session?.user?.id,
    profile,
    userCalendars: userProfile?.calendars
  });

  const bioContent = useMemo(() => {
    return getFieldValue(profile?.contactEntries, 'bio') || 'Welcome to my profile!';
  }, [profile?.contactEntries]);

  const markdownComponents = useMemo(() => ({
    p: (props: React.ComponentProps<'p'>) => <Text variant="small" className="leading-relaxed mb-2" {...props} />,
    a: (props: React.ComponentProps<'a'>) => (
      <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
    ),
  }), []);

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
    // Skip animation if returning from auth or coming from phone modal
    if (isReturningFromAuth || skipEnterAnimation) {
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
    <div className="flex flex-col items-center px-4 py-2 relative z-[1001] min-h-dvh">

        {/* Header with back button - positioned absolutely to not affect centering */}
        {isHistoricalContact && (
          <div className="absolute top-2 left-4 right-4 z-10">
            <div className="w-full max-w-[var(--max-content-width,448px)] mx-auto">
              <PageHeader
                onBack={handleBack}
              />
            </div>
          </div>
        )}

        {/* Fixed Content Area - centered against full page */}
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
            <ContactInfo
              profile={profile}
              bioContent={bioContent}
              markdownComponents={markdownComponents}
            />
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
                  className="w-full"
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
                <ContactButton
                  isSuccess={isSuccess}
                  isSaving={isSaving}
                  isLoading={isLoading}
                  onClick={handleSaveContact}
                />

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
          onClose={() => setShowUpsellModal(false)}
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
          onClose={() => setShowAddCalendarModal(false)}
          section={
            isHistoricalMode
              ? (profile as SavedContact).contactType
              : (localStorage.getItem('profileViewMode') || 'personal') as 'personal' | 'work'
          }
          userEmail={session?.user?.email || ''}
          onCalendarAdded={handleCalendarAdded}
          redirectTo={`/c/${profile.shortCode}/smart-schedule`}
        />
      </div>
  );
};