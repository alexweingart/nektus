'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useStreamingAI, type ChatMessage } from '@/client/hooks/use-streaming-ai';
import type { UserProfile, TimeSlot } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import type { Message as AIMessage } from '@/types/ai-scheduling';
import type { Event } from '@/types/profile';
import MessageList from '@/app/components/ui/chat/MessageList';
import ChatInput from '@/app/components/ui/chat/ChatInput';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import { useProfile } from '@/app/context/ProfileContext';
import { auth } from '@/client/config/firebase';

// Helper: Generate unique message IDs
function generateMessageId(offset = 0): string {
  return (Date.now() + offset).toString();
}

export default function AIScheduleView() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { profile: currentUserProfile, getContact, getContacts, invalidateContactsCache } = useProfile();
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [savedContact, setSavedContact] = useState<SavedContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const code = params.code as string;
  const contactType = savedContact?.contactType || 'personal';

  // Chat interface state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('\u200B'); // Zero-width space to prevent iOS positioning bug
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showChatInput, setShowChatInput] = useState(false);

  // Pre-fetched common time slots (using ref to avoid re-renders that blur input)
  const commonTimeSlotsRef = useRef<TimeSlot[]>([]);
  const hasFetchedSlotsRef = useRef(false);

  // Initialize streaming AI hook
  const { handleStreamingResponse } = useStreamingAI({
    onUpdateMessages: setMessages,
    onUpdateConversationHistory: setConversationHistory,
  });

  const loadProfiles = useCallback(async () => {
    if (!session?.user?.id || !code) return;

    try {
      // Get contact from cache - try by userId first, then by shortCode
      let contact = getContact(code);

      // If not found by userId, search by shortCode
      if (!contact) {
        const allContacts = getContacts();
        contact = allContacts.find(c => c.shortCode === code) || null;
      }

      if (contact) {
        // Check if we're viewing via userId but contact doesn't have a shortCode yet
        const isViewingViaUserId = code === contact.userId && !contact.shortCode;

        if (isViewingViaUserId) {
          // Fetch/generate shortCode for the profile, update saved contact, then redirect
          try {
            const profileRes = await fetch(`/api/profile/shortcode/${contact.userId}`);
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              if (profileData.profile?.shortCode) {
                const shortCode = profileData.profile.shortCode;

                // Update the saved contact with the shortCode
                await fetch(`/api/contacts/${contact.userId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ shortCode })
                });

                console.log(`📌 [AIScheduleView] Updated saved contact with shortCode: ${shortCode}`);

                // Invalidate cache and redirect to shortCode URL
                invalidateContactsCache();
                setIsRedirecting(true);
                router.replace(`/c/${shortCode}/ai-schedule${window.location.search}`);
                return;
              }
            }
          } catch (err) {
            console.warn('[AIScheduleView] Failed to migrate to shortCode, continuing with userId:', err);
          }
        }

        setContactProfile(contact);
        setSavedContact(contact);
      }

    } catch (error) {
      console.error('Error loading profiles:', error);
      router.push('/history');
    } finally {
      setLoading(false);
    }
  }, [code, session?.user?.id, router, getContact, getContacts, invalidateContactsCache]);

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
    if (contactProfile && messages.length === 0) {
      const contactName = contactProfile.contactEntries?.find(e => e.fieldType === 'name')?.value || 'this contact';
      setMessages([{
        id: '1',
        type: 'ai',
        content: `I'll help you find the perfect time & place to meet with **${contactName}**. Can you let me know:

- How long you want to meet
- Days or times you're free
- What type of place you'd like to meet at

And if you don't know any of those things, and just want me to suggest based off common available times, that's fine too!`,
      }]);
    }
  }, [contactProfile, messages.length]);

  const prevMessagesLengthRef = useRef(messages.length);

  useEffect(() => {
    // Only auto-scroll when new messages are added, not when existing messages are updated
    // Skip auto-scroll for the initial greeting message (messages.length === 1)
    if (messages.length > prevMessagesLengthRef.current && messages.length > 1) {
      // Signal that this is a programmatic scroll (don't blur input)
      (window as Window & { __programmaticScroll?: boolean }).__programmaticScroll = true;
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

      // Clear flag after scroll completes (~500ms for smooth scroll)
      setTimeout(() => {
        (window as Window & { __programmaticScroll?: boolean }).__programmaticScroll = false;
      }, 600);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  const handleSend = useCallback(async () => {
    // Strip zero-width space for actual content
    const actualInput = input.replace(/\u200B/g, '').trim();

    if (!actualInput || isProcessing || !currentUserProfile || !contactProfile || !session) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      type: 'user',
      content: actualInput,
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
      content: actualInput,
      timestamp: new Date(),
    };

    setInput('\u200B'); // Reset to zero-width space
    setIsProcessing(true);

    try {
      // Get user locations from the locations array
      const currentUserLoc = currentUserProfile.locations?.find(
        loc => loc.section === contactType
      );
      // Build full address with city context to avoid geocoding ambiguity
      const currentUserLocation = currentUserLoc
        ? currentUserLoc.address
          ? `${currentUserLoc.address}, ${currentUserLoc.city}, ${currentUserLoc.region}${currentUserLoc.country ? ', ' + currentUserLoc.country : ''}`
          : `${currentUserLoc.city}, ${currentUserLoc.region}${currentUserLoc.country ? ', ' + currentUserLoc.country : ''}`
        : '';

      const contactLoc = contactProfile.locations?.find(
        loc => loc.section === contactType
      );
      // Build full address with city context to avoid geocoding ambiguity
      const contactLocation = contactLoc
        ? contactLoc.address
          ? `${contactLoc.address}, ${contactLoc.city}, ${contactLoc.region}${contactLoc.country ? ', ' + contactLoc.country : ''}`
          : `${contactLoc.city}, ${contactLoc.region}${contactLoc.country ? ', ' + contactLoc.country : ''}`
        : '';

      // Extract coordinates from user locations
      const currentUserCoordinates = currentUserLoc?.coordinates;
      const contactCoordinates = contactLoc?.coordinates;

      const contactEmail = contactProfile.contactEntries?.find(e => e.fieldType === 'email')?.value || '';
      const contactName = contactProfile.contactEntries?.find(e => e.fieldType === 'name')?.value || 'Contact';

      // Get ID token for authentication
      const idToken = await auth?.currentUser?.getIdToken();

      const response = await fetch('/api/scheduling/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userMessage: actualInput,
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
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, currentUserProfile, contactProfile, session, conversationHistory, savedContact, contactType, handleStreamingResponse]);

  const handleScheduleEvent = (event: Event) => {
    if (!event.calendar_urls?.google) {
      return;
    }

    // Open the pre-generated calendar URL
    window.open(event.calendar_urls.google, '_blank');
  };

  const handleBack = () => {
    // Preserve the 'from' parameter when navigating back
    const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const fromParam = searchParams.get('from');
    const queryString = fromParam ? `?from=${fromParam}` : '';
    router.push(`/c/${savedContact?.shortCode ?? code}/smart-schedule${queryString}`);
  };

  // Wait 1.5 seconds before showing ChatInput (allows background transition to complete)
  // This prevents backdrop-blur from caching black background on page refresh
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowChatInput(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Track keyboard appearance for debugging (no state updates to avoid re-render issues)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportResize = () => {
      if (!window.visualViewport) return;
      const keyboardHeight = window.innerHeight - window.visualViewport.height;
      console.log('[AIScheduleView] Visual viewport resize:', {
        keyboardHeight,
        visualViewportHeight: window.visualViewport.height,
        windowInnerHeight: window.innerHeight,
        keyboardOpen: keyboardHeight > 0,
      });
      // Note: Not updating state to avoid re-renders that break iOS fixed positioning
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);


  if (loading || !contactProfile || !currentUserProfile || isRedirecting) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col items-center px-4 py-2 pb-32">
        {/* Header */}
        <div className="w-full max-w-[var(--max-content-width,448px)]">
          <PageHeader
            onBack={handleBack}
            title="Find a Time"
          />
        </div>

        {/* Messages - extra padding for fixed input */}
        <div
          ref={messagesContainerRef}
          className="w-full max-w-[var(--max-content-width,448px)] space-y-3 pt-4"
        >
          <MessageList messages={messages} onCreateEvent={handleScheduleEvent} />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input - appears at 1.5s, content fades in */}
      {showChatInput && (
        <ChatInput
          value={input}
          onChange={(e) => {
            const newValue = e.target.value;
            // Ensure we always have at least the zero-width space
            if (newValue === '' || newValue.replace(/\u200B/g, '') === '') {
              setInput('\u200B');
            } else {
              setInput(newValue);
            }
          }}
          onSend={handleSend}
          disabled={false}
          sendDisabled={isProcessing}
          fadeIn={true}
        />
      )}
    </>
  );
}
