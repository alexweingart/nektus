'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useStreamingAI, type ChatMessage } from '@/lib/hooks/use-streaming-ai';
import type { UserProfile, TimeSlot } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import type { Message as AIMessage } from '@/types/ai-scheduling';
import type { Event } from '@/types/profile';
import MessageList from '@/app/components/ui/chat/MessageList';
import ChatInput from '@/app/components/ui/chat/ChatInput';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import { useProfile } from '@/app/context/ProfileContext';
import { auth } from '@/lib/config/firebase/client';

// Helper: Generate unique message IDs
function generateMessageId(offset = 0): string {
  return (Date.now() + offset).toString();
}

export default function AIScheduleView() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { profile: currentUserProfile, getContact } = useProfile();
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [savedContact, setSavedContact] = useState<SavedContact | null>(null);
  const [loading, setLoading] = useState(true);

  const contactUserId = params.userId as string;
  const contactType = savedContact?.contactType || 'personal';

  // Chat interface state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Pre-fetched common time slots
  const [commonTimeSlots, setCommonTimeSlots] = useState<TimeSlot[]>([]);
  const hasFetchedSlotsRef = useRef(false);

  // Portal for fixed input - must be before early returns
  const [mounted, setMounted] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Initialize streaming AI hook
  const { handleStreamingResponse } = useStreamingAI({
    onUpdateMessages: setMessages,
    onUpdateConversationHistory: setConversationHistory,
  });

  const loadProfiles = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Get contact from cache (ContactLayout loads it)
      const savedContact = getContact(contactUserId);

      if (savedContact) {
        setContactProfile(savedContact);
        setSavedContact(savedContact);
      }

    } catch (error) {
      console.error('Error loading profiles:', error);
      router.push('/history');
    } finally {
      setLoading(false);
    }
  }, [contactUserId, session?.user?.id, router, getContact]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Pre-fetch common time slots when profiles are loaded (only once)
  useEffect(() => {
    const abortController = new AbortController();

    const fetchCommonTimeSlots = async () => {
      if (!session?.user?.id || !contactUserId || !auth?.currentUser) return;
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
            user2Id: contactUserId,
            duration: 30, // Use minimum duration for maximum flexibility
            calendarType: contactType,
          }),
          signal: abortController.signal, // Allow request to be cancelled
        });

        if (response.ok) {
          const data = await response.json();
          const slots = data.slots || [];
          setCommonTimeSlots(slots);
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

    if (contactProfile && currentUserProfile) {
      fetchCommonTimeSlots();
    }

    // Cleanup: abort ongoing requests
    return () => {
      abortController.abort();
    };
  }, [contactProfile, currentUserProfile, session?.user?.id, contactUserId, contactType]);

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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  const handleSend = async () => {

    if (!input.trim() || isProcessing || !currentUserProfile || !contactProfile || !session) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      type: 'user',
      content: input,
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
      content: input,
      timestamp: new Date(),
    };

    setInput('');
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
          userMessage: input,
          conversationHistory,
          user1Id: session.user.id,
          user2Id: contactUserId,
          user2Name: contactName,
          user2Email: contactEmail,
          user1Location: currentUserLocation,
          user2Location: contactLocation,
          user1Coordinates: currentUserCoordinates,
          user2Coordinates: contactCoordinates,
          calendarType: contactType,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          availableTimeSlots: commonTimeSlots, // Pass pre-fetched slots
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
  };

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
    router.push(`/contact/${contactUserId}/smart-schedule${queryString}`);
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle keyboard appearance - adjust scroll to keep messages visible
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportResize = () => {
      if (!window.visualViewport) return;

      // Calculate keyboard height as the difference between window height and visual viewport height
      const keyboardHeight = window.innerHeight - window.visualViewport.height;
      setKeyboardHeight(keyboardHeight);

      // If keyboard is visible and we have messages, scroll to keep last message visible
      if (keyboardHeight > 0 && messagesContainerRef.current) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          if (messagesEndRef.current && messagesContainerRef.current) {
            // Scroll messages container to show the last message
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        });
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, [messages]);

  if (loading || !contactProfile || !currentUserProfile) {
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

      {/* Input - rendered via portal to be fixed to viewport */}
      {mounted && createPortal(
        <div
          className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-200"
          style={{
            transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : 'translateY(0)',
          }}
        >
          <ChatInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onSend={handleSend}
            disabled={isProcessing}
          />
        </div>,
        document.body
      )}
    </>
  );
}
