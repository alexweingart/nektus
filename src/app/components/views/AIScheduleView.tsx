'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useStreamingAI, type ChatMessage } from '@/lib/hooks/useStreamingAI';
import type { UserProfile, TimeSlot } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import type { Message as AIMessage } from '@/types/ai-scheduling';
import type { Event } from '@/types/profile';
import MessageList from '@/app/components/ui/chat/MessageList';
import ChatInput from '@/app/components/ui/chat/ChatInput';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';
import { useProfile } from '@/app/context/ProfileContext';
import { auth } from '@/lib/firebase/clientConfig';

// Helper: Generate unique message IDs
function generateMessageId(offset = 0): string {
  return (Date.now() + offset).toString();
}

export default function AIScheduleView() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { profile: currentUserProfile } = useProfile();
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

  // Pre-fetched common time slots
  const [commonTimeSlots, setCommonTimeSlots] = useState<TimeSlot[]>([]);
  const hasFetchedSlotsRef = useRef(false);

  // Initialize streaming AI hook
  const { handleStreamingResponse } = useStreamingAI({
    onUpdateMessages: setMessages,
    onUpdateConversationHistory: setConversationHistory,
  });

  const loadProfiles = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Load saved contacts to get the contact profile and type
      const contacts = await ClientProfileService.getContacts(session.user.id);
      const savedContact = contacts.find((c: SavedContact) => c.userId === contactUserId);

      if (!savedContact) {
        console.error('Contact not found in saved contacts');
        router.push('/history');
        return;
      }

      // Set contact profile and saved contact info
      setContactProfile(savedContact);
      setSavedContact(savedContact);

    } catch (error) {
      console.error('Error loading profiles:', error);
      router.push('/history');
    } finally {
      setLoading(false);
    }
  }, [contactUserId, session?.user?.id, router]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Pre-fetch common time slots when profiles are loaded (only once)
  useEffect(() => {
    const fetchCommonTimeSlots = async () => {
      if (!session?.user?.id || !contactUserId || !auth?.currentUser) return;
      if (hasFetchedSlotsRef.current) return; // Already fetched

      hasFetchedSlotsRef.current = true;

      try {
        console.log('🔄 Pre-fetching common time slots for AI scheduling...');
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
        console.error('❌ Error pre-fetching common times:', error);
      }
    };

    if (contactProfile && currentUserProfile) {
      fetchCommonTimeSlots();
    }
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

*And if you don't know any of those things, and just want me to suggest based off common available times, that's fine too!*`,
      }]);
    }
  }, [contactProfile, messages.length]);

  const prevMessagesLengthRef = useRef(messages.length);

  useEffect(() => {
    // Only auto-scroll when new messages are added, not when existing messages are updated
    if (messages.length > prevMessagesLengthRef.current) {
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
      const currentUserLocation = currentUserLoc
        ? `${currentUserLoc.city}, ${currentUserLoc.region}${currentUserLoc.country ? ', ' + currentUserLoc.country : ''}`
        : '';

      const contactLoc = contactProfile.locations?.find(
        loc => loc.section === contactType
      );
      const contactLocation = contactLoc
        ? `${contactLoc.city}, ${contactLoc.region}${contactLoc.country ? ', ' + contactLoc.country : ''}`
        : '';

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
          contactType: contactType,
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

  if (loading || !contactProfile || !currentUserProfile) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-pulse text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh relative z-[1001] flex flex-col">
      {/* Header */}
      <div className="px-6 pt-2">
        <div className="max-w-[var(--max-content-width,448px)] mx-auto">
          <PageHeader
            onBack={handleBack}
            title="Find a Time"
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="max-w-[var(--max-content-width,448px)] mx-auto space-y-3 pb-2 pt-4">
          <MessageList messages={messages} onCreateEvent={handleScheduleEvent} />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onSend={handleSend}
        disabled={isProcessing}
      />
    </div>
  );
}
