/**
 * AIScheduleView for iOS
 * Adapted from: apps/web/src/app/components/views/AIScheduleView.tsx
 *
 * Changes from web:
 * - Replaced Next.js navigation with React Navigation
 * - Replaced useSession from next-auth with iOS SessionProvider
 * - Replaced window.open with Linking.openURL
 * - Replaced div/className with View/StyleSheet
 * - Replaced ref scroll with ScrollView scrollToEnd
 * - Added KeyboardAvoidingView for proper keyboard handling
 * - Removed visualViewport handling (iOS handles keyboard natively)
 * - Uses getApiBaseUrl for API calls
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { useScreenRefresh } from '../../../client/hooks/use-screen-refresh';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../App';
import { useSession } from '../../providers/SessionProvider';
import { useProfile, type UserProfile, type SavedContact } from '../../context/ProfileContext';
import { useStreamingAI, type ChatMessage } from '../../../client/hooks/use-streaming-ai';
import { getApiBaseUrl, getIdToken, getCurrentUser } from '../../../client/auth/firebase';
import type { Event, TimeSlot } from '@nektus/shared-types';
import { isEventKitAvailable, getDeviceBusyTimes, createCalendarEvent, openEventInCalendar } from '../../../client/calendar/eventkit-service';
import { StandardModal } from '../ui/modals/StandardModal';
import { PageHeader } from '../ui/layout/PageHeader';
import { ScreenTransition, useGoBackWithFade } from '../ui/layout/ScreenTransition';
import { MessageList } from '../ui/chat/MessageList';
import { ChatInput } from '../ui/chat/ChatInput';
import { emitMatchFound } from '../../utils/animationEvents';

type AIScheduleViewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AISchedule'>;
type AIScheduleViewRouteProp = RouteProp<RootStackParamList, 'AISchedule'>;

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Helper: Generate unique message IDs
function generateMessageId(offset = 0): string {
  return (Date.now() + offset).toString();
}

async function getEventKitBusyTimesForProfile(
  profile: UserProfile | null
): Promise<{ user1BusyTimes: { start: string; end: string }[] } | {}> {
  if (!isEventKitAvailable() || !profile) return {};
  const calendar = profile.calendars?.find(
    (cal) => cal.accessMethod === 'eventkit'
  );
  if (!calendar) return {};
  try {
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const busyTimes = await getDeviceBusyTimes(now, twoWeeksOut);
    return { user1BusyTimes: busyTimes };
  } catch (error) {
    console.error('[AIScheduleView] Failed to get EventKit busy times:', error);
    return {};
  }
}

// Cold start flag — true on first request after app launch, resets after use
let isColdStart = true;

export function AIScheduleView() {
  const navigation = useNavigation<AIScheduleViewNavigationProp>();
  const route = useRoute<AIScheduleViewRouteProp>();
  const goBackWithFade = useGoBackWithFade();
  const { contactUserId, backgroundColors } = route.params;

  const { data: session } = useSession();
  const { profile: currentUserProfile, getContact } = useProfile();
  const skipCacheOnRefresh = useRef(false);
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [savedContact, setSavedContact] = useState<SavedContact | null>(null);
  const [loading, setLoading] = useState(true);

  const contactType = savedContact?.contactType || 'personal';
  const apiBaseUrl = getApiBaseUrl();
  const [createdEventModal, setCreatedEventModal] = useState<{
    visible: boolean;
    title: string;
    subtitle: string;
    startDate: Date;
  } | null>(null);

  // Emit background colors immediately from nav params
  useEffect(() => {
    if (backgroundColors && backgroundColors.length >= 3) {
      emitMatchFound(backgroundColors);
    }
  }, [backgroundColors]);

  // Chat interface state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('\u200B'); // Zero-width space to prevent iOS positioning bug
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const showChatInput = true;

  // Pre-fetched common time slots (using ref to avoid re-renders that blur input)
  const commonTimeSlotsRef = useRef<TimeSlot[]>([]);
  const hasFetchedSlotsRef = useRef(false);
  const prevMessagesLengthRef = useRef(messages.length);

  // Function to fetch common time slots (extracted for reuse)
  const fetchCommonTimeSlots = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!session?.user?.id || !contactUserId || !currentUser) return;

    try {
      console.log('Fetching common time slots for AI scheduling...');
      const idToken = await getIdToken();

      const response = await fetch(`${apiBaseUrl}/api/scheduling/common-times`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          user1Id: session.user.id,
          user2Id: contactUserId,
          duration: 30,
          calendarType: contactType,
          ...(await getEventKitBusyTimesForProfile(currentUserProfile)),
          ...(isColdStart || skipCacheOnRefresh.current ? { skipCache: true } : {}),
        }),
      });

      isColdStart = false;
      skipCacheOnRefresh.current = false;

      if (response.ok) {
        const data = await response.json();
        const slots = data.slots || [];
        commonTimeSlotsRef.current = slots;
        console.log(`Fetched ${slots.length} common time slots`);
      } else {
        console.error(`Failed to fetch common times: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching common times:', error);
    }
  }, [session?.user?.id, contactUserId, contactType, apiBaseUrl]);

  // Pull-to-refresh - re-fetches common time slots (bypasses Redis cache)
  const { refreshControl } = useScreenRefresh({
    onRefresh: async () => {
      skipCacheOnRefresh.current = true;
      await fetchCommonTimeSlots();
    },
  });

  // Initialize streaming AI hook
  const { handleStreamingResponse } = useStreamingAI({
    onUpdateMessages: setMessages,
    onUpdateConversationHistory: setConversationHistory,
  });

  // Load contact profile
  const loadProfiles = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Get contact from cache
      const contact = getContact(contactUserId);

      if (contact) {
        // Build a profile-like object from saved contact
        // Using 'unknown' cast since we only need subset of UserProfile fields
        setContactProfile({
          id: contact.userId,
          userId: contact.userId,
          contactEntries: [
            { fieldType: 'name', value: contact.odtName },
            ...(contact.email ? [{ fieldType: 'email', value: contact.email }] : []),
            ...(contact.phone ? [{ fieldType: 'phone', value: contact.phone }] : []),
          ],
          profileImage: contact.profileImage,
        } as unknown as UserProfile);
        setSavedContact(contact);
        // Emit contact colors for LayoutBackground
        if (contact.backgroundColors && contact.backgroundColors.length >= 3) {
          emitMatchFound(contact.backgroundColors);
        }
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
      goBackWithFade();
    } finally {
      setLoading(false);
    }
  }, [contactUserId, session?.user?.id, goBackWithFade, getContact]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Pre-fetch common time slots when profiles are loaded (only once)
  useEffect(() => {
    if (contactProfile && currentUserProfile && !hasFetchedSlotsRef.current) {
      hasFetchedSlotsRef.current = true;
      fetchCommonTimeSlots();
    }
  }, [contactProfile, currentUserProfile, fetchCommonTimeSlots]);

  // Initialize chat with AI greeting when component mounts
  useEffect(() => {
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

  // Auto-scroll when new messages are added
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current && messages.length > 1) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  const handleSend = useCallback(async () => {
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

    setInput('\u200B');
    setIsProcessing(true);

    try {
      // Get user locations from the locations array
      const currentUserLoc = currentUserProfile.locations?.find(
        loc => loc.section === contactType
      );
      const currentUserLocation = currentUserLoc
        ? currentUserLoc.address
          ? `${currentUserLoc.address}, ${currentUserLoc.city}, ${currentUserLoc.region}${currentUserLoc.country ? ', ' + currentUserLoc.country : ''}`
          : `${currentUserLoc.city}, ${currentUserLoc.region}${currentUserLoc.country ? ', ' + currentUserLoc.country : ''}`
        : '';

      const contactLoc = contactProfile.locations?.find(
        loc => loc.section === contactType
      );
      const contactLocation = contactLoc
        ? contactLoc.address
          ? `${contactLoc.address}, ${contactLoc.city}, ${contactLoc.region}${contactLoc.country ? ', ' + contactLoc.country : ''}`
          : `${contactLoc.city}, ${contactLoc.region}${contactLoc.country ? ', ' + contactLoc.country : ''}`
        : '';

      const currentUserCoordinates = currentUserLoc?.coordinates;
      const contactCoordinates = contactLoc?.coordinates;

      const contactEmail = contactProfile.contactEntries?.find(e => e.fieldType === 'email')?.value || '';
      const contactName = contactProfile.contactEntries?.find(e => e.fieldType === 'name')?.value || 'Contact';

      const idToken = await getIdToken();

      const response = await fetch(`${apiBaseUrl}/api/scheduling/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userMessage: actualInput,
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
          availableTimeSlots: commonTimeSlotsRef.current,
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
  }, [input, isProcessing, currentUserProfile, contactProfile, session, conversationHistory, contactUserId, contactType, handleStreamingResponse, apiBaseUrl]);

  const handleScheduleEvent = useCallback(async (event: Event) => {
    // Determine user's calendar access method for this section
    const userCalendar = currentUserProfile?.calendars?.find(cal => cal.section === contactType);
    const accessMethod = userCalendar?.accessMethod;

    // EventKit: create event directly on device
    if (accessMethod === 'eventkit') {
      const startDate = event.startTime ? new Date(event.startTime) : null;
      const endDate = event.endTime ? new Date(event.endTime) : null;
      if (!startDate || !endDate) {
        Alert.alert('Error', 'Event is missing start or end time.');
        return;
      }

      try {
        await createCalendarEvent({
          title: event.title,
          startDate,
          endDate,
          location: event.location || undefined,
          notes: event.description || undefined,
        });

        const timeStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const dayStr = startDate.toLocaleDateString('en-US', { weekday: 'long' });

        setCreatedEventModal({
          visible: true,
          title: 'Added to Calendar',
          subtitle: `${event.title} — ${dayStr} • ${timeStr} (${event.duration} min)`,
          startDate,
        });
      } catch (error) {
        console.error('[AISchedule] EventKit create failed:', error);
        Alert.alert('Error', 'Failed to create calendar event. Please try again.');
      }
      return;
    }

    // Google / Microsoft: open web URL
    if (!event.calendar_urls) return;

    const provider = userCalendar?.provider || 'google';
    const calendarUrl = provider === 'microsoft'
      ? event.calendar_urls.outlook
      : event.calendar_urls.google;

    if (!calendarUrl) return;
    Linking.openURL(calendarUrl);
  }, [currentUserProfile, contactType]);

  const handleBack = useCallback(() => {
    goBackWithFade();
  }, [goBackWithFade]);


  if (loading || !contactProfile || !currentUserProfile) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <PageHeader title="Find a Time" onBack={handleBack} />
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.container}>
          <PageHeader title="Find a Time" onBack={handleBack} />

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            <MessageList messages={messages} onCreateEvent={handleScheduleEvent} />
          </ScrollView>

          {/* Chat Input - appears at 1.5s, content fades in */}
          {showChatInput && (
            <ChatInput
              value={input}
              onChange={(e) => {
                const newValue = e.target.value;
                if (newValue === '' || newValue.replace(/\u200B/g, '') === '') {
                  setInput('\u200B');
                } else {
                  setInput(newValue);
                }
              }}
              onSend={handleSend}
              disabled={false}
              sendDisabled={isProcessing}
              fadeIn={false}
            />
          )}

          {/* EventKit success modal */}
          {createdEventModal && (
            <StandardModal
              isOpen={createdEventModal.visible}
              onClose={() => setCreatedEventModal(null)}
              title="Added to Calendar ✓"
              subtitle={createdEventModal.subtitle}
              primaryButtonText="View Event"
              onPrimaryButtonClick={() => {
                openEventInCalendar(createdEventModal.startDate);
                setCreatedEventModal(null);
              }}
              secondaryButtonText="Done"
              onSecondaryButtonClick={() => setCreatedEventModal(null)}
              showCloseButton={false}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 200, // Extra padding for fixed input
    paddingHorizontal: 16,
  },
});

export default AIScheduleView;
