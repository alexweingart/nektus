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
 * - Added animated keyboard spacer for proper keyboard handling
 * - Removed visualViewport handling (iOS handles keyboard natively)
 * - Uses getApiBaseUrl for API calls
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  Keyboard,
  Linking,
  Alert,
} from 'react-native';
import { useScreenRefresh } from '../../../client/hooks/use-screen-refresh';
import { useRoute, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../../../App';
import { useSession } from '../../providers/SessionProvider';
import { useProfile, type UserProfile, type SavedContact } from '../../context/ProfileContext';
import { useStreamingAI, type ChatMessage } from '../../../client/hooks/use-streaming-ai';
import { ClientProfileService } from '../../../client/firebase/firebase-save';
import { getApiBaseUrl, getIdToken, getCurrentUser } from '../../../client/auth/firebase';
import { getFieldValue, formatLocationString } from '@nektus/shared-client';
import type { Event, TimeSlot } from '@nektus/shared-types';
import { openMessagingApp } from '../../../client/contacts/messaging';
import { StandardModal } from '../ui/modals/StandardModal';
import { PageHeader } from '../ui/layout/PageHeader';
import { ScreenTransition, useGoBackWithFade } from '../ui/layout/ScreenTransition';
import { MessageList } from '../ui/chat/MessageList';
import { ChatInput, type ChatInputHandle } from '../ui/chat/ChatInput';
import { emitMatchFound } from '../../utils/animationEvents';
import { ensureReadableColor } from '@nektus/shared-client';

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



export function AIScheduleView() {
  const route = useRoute<AIScheduleViewRouteProp>();
  const goBackWithFade = useGoBackWithFade();
  const { contactUserId, backgroundColors, savedContact: passedContact, autoFocus } = route.params;

  const { data: session } = useSession();
  const { profile: currentUserProfile, getContact } = useProfile();
  const isColdStart = useRef(true);
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
    eventId: string;
    startDate: Date;
    contactName?: string;
    contactPhone?: string;
    inviteCode?: string;
    calendarEventUrl?: string;
  } | null>(null);

  // Emit background colors immediately from nav params
  useEffect(() => {
    if (backgroundColors && backgroundColors.length >= 3) {
      emitMatchFound(backgroundColors);
    }
  }, [backgroundColors]);

  // Keyboard tracking for chat layout + auto-scroll
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(keyboardHeight, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
      // Auto-scroll messages when keyboard opens
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [keyboardHeight]);

  // Chat interface state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('\u200B'); // Zero-width space to prevent iOS positioning bug
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Auto-focus the input when navigating from SmartScheduleView
  useEffect(() => {
    if (autoFocus && !loading) {
      // Short delay to let screen transition complete
      const timer = setTimeout(() => {
        chatInputRef.current?.focus();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, loading]);

  // Pre-fetched common time slots (using ref to avoid re-renders that blur input)
  const commonTimeSlotsRef = useRef<TimeSlot[]>([]);
  const hasFetchedSlotsRef = useRef(false);
  const prevMessagesLengthRef = useRef(messages.length);

  // Function to fetch common time slots (extracted for reuse)
  const fetchCommonTimeSlots = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!session?.user?.id || !contactUserId || !currentUser) return;

    try {
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
          ...(isColdStart.current || skipCacheOnRefresh.current ? { skipCache: true } : {}),
        }),
      });

      isColdStart.current = false;
      skipCacheOnRefresh.current = false;

      if (response.ok) {
        const data = await response.json();
        const slots = data.slots || [];
        commonTimeSlotsRef.current = slots;
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
  const { sendStreamingRequest } = useStreamingAI({
    onUpdateMessages: setMessages,
    onUpdateConversationHistory: setConversationHistory,
  });

  // Helper: apply a Firestore SavedContact (extends UserProfile) as contactProfile + savedContact
  const applyFirestoreContact = useCallback((fsContact: any) => {
    setContactProfile(fsContact as unknown as UserProfile);
    const entries = fsContact.contactEntries || [];
    setSavedContact({
      odtId: fsContact.userId,
      odtName: getFieldValue(entries, 'name') || '',
      userId: fsContact.userId,
      addedAt: fsContact.addedAt || Date.now(),
      profileImage: fsContact.profileImage,
      phone: getFieldValue(entries, 'phone'),
      email: getFieldValue(entries, 'email'),
      contactType: fsContact.contactType,
      backgroundColors: fsContact.backgroundColors,
    });
    if (fsContact.backgroundColors?.length >= 3) {
      emitMatchFound(fsContact.backgroundColors);
    }
  }, []);

  // Load contact profile
  const loadProfiles = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // 1. Try ProfileContext cache first
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
          backgroundColors: contact.backgroundColors,
        } as unknown as UserProfile);
        setSavedContact(contact);
        // Emit contact colors for LayoutBackground
        if (contact.backgroundColors && contact.backgroundColors.length >= 3) {
          emitMatchFound(contact.backgroundColors);
        }
      } else if (passedContact) {
        // 2. Use contact passed from SmartScheduleView (Firestore SavedContact extends UserProfile)
        applyFirestoreContact(passedContact);
      } else {
        // 3. Last resort: fetch directly from Firestore
        const firestoreContact = await ClientProfileService.getContactById(session.user.id, contactUserId);
        if (firestoreContact) {
          applyFirestoreContact(firestoreContact);
        }
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
      goBackWithFade();
    } finally {
      setLoading(false);
    }
  }, [contactUserId, session?.user?.id, goBackWithFade, getContact, passedContact, applyFirestoreContact]);

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
    if (contactProfile && currentUserProfile && messages.length === 0) {
      const userFirstName = (getFieldValue(currentUserProfile.contactEntries, 'name') || '').split(' ')[0] || 'They-who-must-not-be-named';
      const contactFirstName = (getFieldValue(contactProfile.contactEntries, 'name') || '').split(' ')[0] || 'They-who-must-not-be-named';
      setMessages([{
        id: '1',
        type: 'ai',
        content: `Hey ${userFirstName}! I'll help you find time to meet with **${contactFirstName}**.\n\nJust tell me days, times, duration, and/or type of activity. Or, ask me to suggest something — I got you.`,
      }]);
    }
  }, [contactProfile, currentUserProfile, messages.length]);

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

    if (!actualInput || !currentUserProfile || !contactProfile || !session) return;

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

    try {
      // Get user locations from the locations array
      const currentUserLoc = currentUserProfile.locations?.find(loc => loc.section === contactType);
      const currentUserLocation = formatLocationString(currentUserLoc);
      const currentUserCoordinates = currentUserLoc?.coordinates;

      const contactLoc = contactProfile.locations?.find(loc => loc.section === contactType);
      const contactLocation = formatLocationString(contactLoc);
      const contactCoordinates = contactLoc?.coordinates;

      const contactEmail = getFieldValue(contactProfile.contactEntries, 'email') || '';
      const contactName = getFieldValue(contactProfile.contactEntries, 'name') || 'They-who-must-not-be-named';

      const idToken = await getIdToken();

      // Use XHR-based streaming for real-time SSE on native
      await sendStreamingRequest(
        `${apiBaseUrl}/api/scheduling/ai`,
        {
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
        },
        newUserAIMessage,
        generateMessageId,
      );

    } catch (error) {
      console.error('Error processing AI request:', error);

      const errorMessage: ChatMessage = {
        id: generateMessageId(1),
        type: 'ai',
        content: 'Sorry, I had trouble processing your request. Please try again with a different approach.',
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  }, [input, currentUserProfile, contactProfile, session, conversationHistory, contactUserId, contactType, sendStreamingRequest, apiBaseUrl]);

  const handleScheduleEvent = useCallback(async (event: Event) => {
    const userCalendar = currentUserProfile?.calendars?.find(cal => cal.section === contactType);

    // Google / Microsoft / Apple with write scope: use API
    if (userCalendar?.calendarWriteScope && contactProfile) {
      try {
        const idToken = await getIdToken();
        if (!idToken) throw new Error('Not authenticated');

        const response = await fetch(`${apiBaseUrl}/api/scheduling/create-event`, {
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

        if (response.ok) {
          const result = await response.json();

          // Update event with API result
          event.calendarEventUrl = result.calendarEventUrl;
          event.calendarEventId = result.calendarEventId;
          event.inviteCode = result.inviteCode;
          event.addedToRecipient = result.addedToRecipient;

          const startDate = new Date(event.startTime!);
          const timeStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          const dayStr = startDate.toLocaleDateString('en-US', { weekday: 'long' });
          const contactName = getFieldValue(contactProfile.contactEntries, 'name') || 'contact';
          const contactPhone = getFieldValue(contactProfile.contactEntries, 'phone');

          let subtitle = `${event.title} — ${dayStr} \u2022 ${timeStr} (${event.duration} min)`;
          if (result.addedToRecipient) subtitle += `\nInvite sent to ${contactName}!`;
          else if (result.notificationSent) subtitle += `\nNotification sent to ${contactName}!`;

          setCreatedEventModal({
            visible: true,
            title: 'Added to Calendar',
            subtitle,
            eventId: result.calendarEventId,
            startDate,
            contactName: contactName || undefined,
            contactPhone: contactPhone || undefined,
            inviteCode: result.inviteCode,
            calendarEventUrl: result.calendarEventUrl,
          });
          return; // Success
        }
      } catch (err) {
        console.warn('[AISchedule] API creation failed, falling back to URL:', err);
      }
    }

    // Fallback: open calendar URL
    if (!event.calendar_urls) return;

    const provider = userCalendar?.provider || 'google';
    const calendarUrl = provider === 'microsoft'
      ? event.calendar_urls.outlook
      : event.calendar_urls.google;

    if (!calendarUrl) return;
    Linking.openURL(calendarUrl);
  }, [currentUserProfile, contactProfile, contactType, apiBaseUrl]);

  if (loading || !contactProfile || !currentUserProfile) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <PageHeader title="Find a Time" onBack={goBackWithFade} />
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition>
      <View style={styles.container}>
        <PageHeader title="Find a Time" onBack={goBackWithFade} />

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          <MessageList messages={messages} onCreateEvent={handleScheduleEvent} dominantColor={contactProfile.backgroundColors?.[0] ? ensureReadableColor(contactProfile.backgroundColors[0]) : undefined} />
        </ScrollView>

        {/* Chat Input — keyboard spacer is inside, covered by blur */}
        <ChatInput
          ref={chatInputRef}
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
          sendDisabled={false}
          fadeIn={false}
          keyboardHeight={keyboardHeight}
        />

        {/* Success modal */}
        {createdEventModal && (
          <StandardModal
            isOpen={createdEventModal.visible}
            onClose={() => setCreatedEventModal(null)}
            title="Added to Calendar \u2713"
            subtitle={createdEventModal.subtitle}
            primaryButtonText={createdEventModal.contactPhone
              ? `Text invite to ${createdEventModal.contactName || 'contact'}`
              : 'View Event'}
            onPrimaryButtonClick={async () => {
              if (createdEventModal.contactPhone) {
                const inviteUrl = createdEventModal.inviteCode ? `nekt.us/i/${createdEventModal.inviteCode}` : '';
                const message = `Hey ${createdEventModal.contactName || ''}! Here are the details for our hangout: ${inviteUrl}`;
                await openMessagingApp(message, createdEventModal.contactPhone);
              } else if (createdEventModal.calendarEventUrl) {
                Linking.openURL(createdEventModal.calendarEventUrl);
              } else {
                // No web URL available — just close the modal
              }
              setCreatedEventModal(null);
            }}
            secondaryButtonText={createdEventModal.contactPhone ? 'View Event' : 'Done'}
            onSecondaryButtonClick={async () => {
              if (createdEventModal.contactPhone && createdEventModal.calendarEventUrl) {
                Linking.openURL(createdEventModal.calendarEventUrl);
              } else if (createdEventModal.contactPhone) {
                // No web URL available — just close the modal
              }
              setCreatedEventModal(null);
            }}
            showCloseButton={true}
          />
        )}
      </View>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
});

