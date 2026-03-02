'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useStreamingAI, type ChatMessage } from '@/client/hooks/use-streaming-ai';
import type { UserProfile, TimeSlot } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import type { Message as AIMessage } from '@/types/ai-scheduling';
import type { Event } from '@/types/profile';
import MessageList from '@/app/components/ui/chat/MessageList';
import ChatInput from '@/app/components/ui/chat/ChatInput';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import { StandardModal } from '@/app/components/ui/modals/StandardModal';
import { useProfile } from '@/app/context/ProfileContext';
import { formatLocationString, getFieldValue } from '@nektus/shared-client';
import { auth } from '@/client/config/firebase';
import { openMessagingAppDirectly } from '@/client/contacts/messaging';

// Helper: Generate unique message IDs
function generateMessageId(offset = 0): string {
  return (Date.now() + offset).toString();
}

export default function AIScheduleView() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldAutoFocus = searchParams.get('autoFocus') === 'true';
  const { data: session } = useSession();
  const { profile: currentUserProfile, getContact, getContacts, contactsLoading } = useProfile();
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [savedContact, setSavedContact] = useState<SavedContact | null>(null);
  const [loading, setLoading] = useState(true);

  const code = params.code as string;
  const contactType = savedContact?.contactType || 'personal';

  // Chat interface state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const layoutContainerRef = useRef<HTMLDivElement>(null);
  const [showChatInput, setShowChatInput] = useState(false);

  // Pre-fetched common time slots (using ref to avoid re-renders that blur input)
  const commonTimeSlotsRef = useRef<TimeSlot[]>([]);
  const hasFetchedSlotsRef = useRef(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    subtitle: string;
    calendarEventUrl?: string;
    inviteCode?: string;
    attendeePhone?: string;
    attendeeName?: string;
    addedToRecipient?: boolean;
  }>({ visible: false, title: '', subtitle: '' });

  // Initialize streaming AI hook
  const { handleStreamingResponse } = useStreamingAI({
    onUpdateMessages: setMessages,
    onUpdateConversationHistory: setConversationHistory,
  });

  const loadProfiles = useCallback(async () => {
    if (!session?.user?.id || !code || contactsLoading) return;

    try {
      // Get contact from cache - try by userId first, then by shortCode
      let contact = getContact(code);

      // If not found by userId, search by shortCode
      if (!contact) {
        const allContacts = getContacts();
        contact = allContacts.find(c => c.shortCode === code) || null;
      }

      if (contact) {
        setContactProfile(contact);
        setSavedContact(contact);

        // Dispatch match-found event for background colors (safe areas)
        if (contact.backgroundColors) {
          window.dispatchEvent(new CustomEvent('match-found', {
            detail: { backgroundColors: contact.backgroundColors }
          }));
        }
      } else {
        // Contact still not found after loading - redirect to history
        console.log('📦 [AIScheduleView] Contact not found, redirecting to history');
        router.push('/history');
      }

    } catch (error) {
      console.error('Error loading profiles:', error);
      router.push('/history');
    } finally {
      setLoading(false);
    }
  }, [code, session?.user?.id, router, getContact, getContacts, contactsLoading]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Pre-fetch common time slots when profiles are loaded (only once)
  useEffect(() => {
    const abortController = new AbortController();

    const fetchCommonTimeSlots = async () => {
      if (!session?.user?.id || !savedContact?.userId || !auth?.currentUser) return;
      if (hasFetchedSlotsRef.current) return; // Already fetched

      hasFetchedSlotsRef.current = true;

      try {
        console.log('🔄 Pre-fetching common time slots for AI scheduling...');

        // Check if Firebase auth is initialized
        if (!auth.currentUser) {
          console.warn('⚠️ Firebase auth not ready, skipping common times pre-fetch');
          return;
        }

        const idToken = await auth.currentUser.getIdToken();

        const response = await fetch('/api/scheduling/common-times', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            user1Id: session.user.id,
            user2Id: savedContact.userId,
            duration: 30, // Use minimum duration for maximum flexibility
            calendarType: contactType,
          }),
          signal: abortController.signal, // Allow request to be cancelled
        });

        if (response.ok) {
          const data = await response.json();
          const slots = data.slots || [];
          commonTimeSlotsRef.current = slots;
          console.log(`✅ Pre-fetched ${slots.length} common time slots`);
        } else {
          console.error(`❌ Failed to pre-fetch common times: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        // Ignore abort errors (expected on unmount)
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Pre-fetch cancelled (component unmounted)');
        } else {
          console.error('❌ Error pre-fetching common times:', error);
        }
      }
    };

    if (contactProfile && currentUserProfile && savedContact) {
      fetchCommonTimeSlots();
    }

    // Cleanup: abort ongoing requests
    return () => {
      abortController.abort();
    };
  }, [contactProfile, currentUserProfile, session?.user?.id, savedContact, contactType]);

  useEffect(() => {
    // Initialize chat with AI greeting when component mounts
    if (contactProfile && currentUserProfile && messages.length === 0) {
      const userFirstName = (currentUserProfile.contactEntries?.find(e => e.fieldType === 'name')?.value || '').split(' ')[0] || 'They-who-must-not-be-named';
      const contactFirstName = (contactProfile.contactEntries?.find(e => e.fieldType === 'name')?.value || '').split(' ')[0] || 'They-who-must-not-be-named';
      setMessages([{
        id: '1',
        type: 'ai',
        content: `Hey ${userFirstName}! I'll help you find time to meet with **${contactFirstName}**.\n\nJust tell me days, times, duration, and/or type of activity. Or, ask me to suggest something — I got you.`,
      }]);
    }
  }, [contactProfile, currentUserProfile, messages.length]);

  const prevMessagesLengthRef = useRef(messages.length);

  useEffect(() => {
    // Only auto-scroll when new messages are added, not when existing messages are updated
    // Skip auto-scroll for the initial greeting message (messages.length === 1)
    if (messages.length > prevMessagesLengthRef.current && messages.length > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  const handleSend = useCallback(async (text: string) => {
    if (!text || !currentUserProfile || !contactProfile || !session) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      type: 'user',
      content: text,
    };

    setMessages(prev => [...prev, userMessage]);

    // Add typing indicator immediately
    const typingIndicatorId = generateMessageId(1);
    setMessages(prev => [...prev, {
      id: typingIndicatorId,
      type: 'ai',
      content: '',
      isProcessing: true,
    }]);

    // Add user message to conversation history
    const newUserAIMessage: AIMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    try {
      // Get user locations from the locations array
      const currentUserLoc = currentUserProfile.locations?.find(
        loc => loc.section === contactType
      );
      const currentUserLocation = formatLocationString(currentUserLoc);

      const contactLoc = contactProfile.locations?.find(
        loc => loc.section === contactType
      );
      const contactLocation = formatLocationString(contactLoc);

      // Extract coordinates from user locations
      const currentUserCoordinates = currentUserLoc?.coordinates;
      const contactCoordinates = contactLoc?.coordinates;

      const contactEmail = contactProfile.contactEntries?.find(e => e.fieldType === 'email')?.value || '';
      const contactName = contactProfile.contactEntries?.find(e => e.fieldType === 'name')?.value || 'They-who-must-not-be-named';

      // Get ID token for authentication
      const idToken = await auth?.currentUser?.getIdToken();

      const response = await fetch('/api/scheduling/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userMessage: text,
          conversationHistory,
          user1Id: session.user.id,
          user2Id: savedContact?.userId,
          user2Name: contactName,
          user2Email: contactEmail,
          user1Location: currentUserLocation,
          user2Location: contactLocation,
          user1Coordinates: currentUserCoordinates,
          user2Coordinates: contactCoordinates,
          calendarType: contactType,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          availableTimeSlots: commonTimeSlotsRef.current, // Pass pre-fetched slots
        }),
      });

      if (!response.ok) {
        throw new Error(`AI scheduling failed: ${response.statusText}`);
      }

      // Handle streaming response
      await handleStreamingResponse(response, newUserAIMessage, generateMessageId);

    } catch (error) {
      console.error('Error processing AI request:', error);

      const errorMessage: ChatMessage = {
        id: generateMessageId(1),
        type: 'ai',
        content: 'Sorry, I had trouble processing your request. Please try again with a different approach.',
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  }, [currentUserProfile, contactProfile, session, conversationHistory, savedContact, contactType, handleStreamingResponse]);

  const handleScheduleEvent = async (event: Event) => {
    const userCalendar = currentUserProfile?.calendars?.find(cal => cal.section === contactType);

    // Try API creation if user has a calendar with write scope
    if (userCalendar?.calendarWriteScope && contactProfile) {
      try {
        const idToken = await auth?.currentUser?.getIdToken();
        if (!idToken) throw new Error('Not authenticated');

        const response = await fetch('/api/scheduling/create-event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            attendeeId: contactProfile.userId,
            eventTitle: event.title,
            eventDescription: event.description || '',
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            calendarSection: contactType,
            travelBuffer: event.travelBuffer,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          if (err.error === 'RECONNECT_REQUIRED') {
            // Fall through to URL-based flow
            throw new Error('RECONNECT_REQUIRED');
          }
          throw new Error(err.error || 'Failed to create event');
        }

        const result = await response.json();

        // Update event object with API result
        event.calendarEventUrl = result.calendarEventUrl;
        event.calendarEventId = result.calendarEventId;
        event.inviteCode = result.inviteCode;
        event.addedToRecipient = result.addedToRecipient;

        // Build subtitle
        const contactName = getFieldValue(contactProfile.contactEntries, 'name') || 'contact';
        const contactPhone = getFieldValue(contactProfile.contactEntries, 'phone');

        const firstName = contactName.split(' ')[0];
        const subtitle = result.addedToRecipient
          ? `${firstName} has been added to the event, but needs to accept`
          : `${firstName} needs to add their calendar to get added to the event — let them know!`;

        setConfirmModal({
          visible: true,
          title: "You're all set!",
          subtitle,
          calendarEventUrl: result.calendarEventUrl,
          inviteCode: result.inviteCode,
          attendeePhone: contactPhone,
          attendeeName: contactName,
          addedToRecipient: result.addedToRecipient,
        });

        return; // Success — don't fall through
      } catch (err) {
        console.warn('[AISchedule] API event creation failed, falling back to URL:', err);
      }
    }

    // Fallback: open calendar URL
    if (!event.calendar_urls) return;

    const provider = userCalendar?.provider || 'google';
    if (provider === 'apple') {
      const icsContent = event.calendar_urls.apple;
      if (icsContent) window.location.href = icsContent;
    } else {
      const calendarUrl = provider === 'microsoft'
        ? event.calendar_urls.outlook
        : event.calendar_urls.google;
      if (calendarUrl) window.location.href = calendarUrl;
    }
  };

  const handleBack = () => {
    // Preserve the 'from' parameter when navigating back
    const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const fromParam = searchParams.get('from');
    const queryString = fromParam ? `?from=${fromParam}` : '';
    router.push(`/c/${savedContact?.shortCode}/smart-schedule${queryString}`);
  };

  // Wait 1.5 seconds before showing ChatInput (allows background transition to complete)
  // This prevents backdrop-blur from caching black background on page refresh
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowChatInput(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Lock page scroll so Safari can't auto-scroll when the keyboard opens.
  // All scrolling happens inside the messages container (overflow-y: auto).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = '';
      body.style.overflow = '';
    };
  }, []);

  // Resize layout container to match the visual viewport when keyboard opens.
  // Debounced so we apply the final height after the keyboard animation (~300ms),
  // instead of tracking every frame (which causes a visible sliding effect).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const container = layoutContainerRef.current;
    if (!container) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const handleViewportChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const vv = window.visualViewport;
        if (vv) container.style.height = `${vv.height}px`;
      }, 150);
    };

    // Set initial height immediately (no debounce needed)
    container.style.height = `${window.visualViewport.height}px`;

    window.visualViewport.addEventListener('resize', handleViewportChange);

    return () => {
      clearTimeout(timeoutId);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
    };
  }, []);


  if (loading || !contactProfile || !currentUserProfile) {
    return null;
  }

  return (
    <div
      ref={layoutContainerRef}
      className="fixed left-0 right-0 flex flex-col"
      style={{ top: 0, height: '100dvh' }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 py-2">
        <div className="max-w-[var(--max-content-width,448px)] mx-auto">
          <PageHeader
            onBack={handleBack}
            title="Find a Time"
          />
        </div>
      </div>

      {/* Messages - scrollable area that compresses when keyboard opens */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4"
      >
        <div className="max-w-[var(--max-content-width,448px)] mx-auto space-y-3 pt-4 pb-4">
          <MessageList messages={messages} onCreateEvent={handleScheduleEvent} dominantColor={contactProfile.backgroundColors?.[0] || undefined} />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input - normal flex child, stays at bottom */}
      {showChatInput && (
        <ChatInput
          onSend={handleSend}
          disabled={false}
          sendDisabled={false}
          fadeIn={true}
          autoFocus={shouldAutoFocus}
        />
      )}

      {/* Confirmation Modal */}
      <StandardModal
        isOpen={confirmModal.visible}
        onClose={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        title={confirmModal.title}
        subtitle={confirmModal.subtitle}
        primaryButtonText={confirmModal.attendeePhone
          ? 'Send the deets'
          : 'See the event'}
        onPrimaryButtonClick={() => {
          if (confirmModal.attendeePhone) {
            const inviteUrl = confirmModal.inviteCode ? `nekt.us/i/${confirmModal.inviteCode}` : '';
            const firstName = (confirmModal.attendeeName || '').split(' ')[0];
            const message = confirmModal.addedToRecipient
              ? `Hey ${firstName}! I just sent you a calendar invite — accept it so we're locked in! ${inviteUrl}`
              : `Hey ${firstName}! I just scheduled us to hang — link your calendar so you get the invite: ${inviteUrl}`;
            openMessagingAppDirectly(message, confirmModal.attendeePhone);
          } else if (confirmModal.calendarEventUrl) {
            window.location.href = confirmModal.calendarEventUrl;
          }
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }}
        secondaryButtonText={confirmModal.attendeePhone ? 'See the event' : undefined}
        showSecondaryButton={!!confirmModal.attendeePhone && !!confirmModal.calendarEventUrl}
        onSecondaryButtonClick={() => {
          if (confirmModal.calendarEventUrl) {
            window.location.href = confirmModal.calendarEventUrl;
          }
          setConfirmModal(prev => ({ ...prev, visible: false }));
        }}
      />
    </div>
  );
}
