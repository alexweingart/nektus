'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useStreamingAI, type ChatMessage } from '@/app/hooks/useStreamingAI';
import type { UserProfile } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import type { Message as AIMessage } from '@/types/ai-scheduling';
import type { Event } from '@/types/profile';
import MessageList from '@/app/components/chat/MessageList';
import ChatInput from '@/app/components/chat/ChatInput';
import { FaArrowLeft } from 'react-icons/fa';

// Helper: Generate unique message IDs
function generateMessageId(offset = 0): string {
  return (Date.now() + offset).toString();
}

export default function AISchedulePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
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

  // Initialize streaming AI hook
  const { handleStreamingResponse } = useStreamingAI({
    onUpdateMessages: setMessages,
    onUpdateConversationHistory: setConversationHistory,
  });

  const loadProfiles = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Fetch contact profile
      const contactResponse = await fetch(`/api/profile/${contactUserId}`);
      if (!contactResponse.ok) {
        console.error('Failed to fetch contact profile');
        router.push('/history');
        return;
      }
      const contact = await contactResponse.json();
      setContactProfile(contact);

      // Fetch current user profile
      const userResponse = await fetch(`/api/profile/${session.user.id}`);
      if (!userResponse.ok) {
        console.error('Failed to fetch user profile');
        return;
      }
      const user = await userResponse.json();
      setCurrentUserProfile(user);

      // Fetch saved contact to get contactType
      const savedContactResponse = await fetch(`/api/contacts/${contactUserId}`);
      if (savedContactResponse.ok) {
        const saved = await savedContactResponse.json();
        setSavedContact(saved);
      }

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
      // Get user locations
      const currentUserLocation = currentUserProfile.contactEntries?.find(
        e => e.fieldType === 'location' && e.section === contactType
      )?.value || '';
      const contactLocation = contactProfile.contactEntries?.find(
        e => e.fieldType === 'location' && e.section === contactType
      )?.value || '';

      const contactEmail = contactProfile.contactEntries?.find(e => e.fieldType === 'email')?.value || '';
      const contactName = contactProfile.contactEntries?.find(e => e.fieldType === 'name')?.value || 'Contact';

      const response = await fetch('/api/ai-schedule/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    router.push(`/contact/${contactUserId}/smart-schedule`);
  };

  if (loading || !contactProfile || !currentUserProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FaArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Find a Time</h1>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-4 pb-2 px-4 pt-4">
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
