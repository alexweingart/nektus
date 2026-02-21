/**
 * SmartScheduleView - Smart scheduling with suggested meeting times
 * Shows pre-computed meeting suggestions based on both users' calendars
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { useScreenRefresh } from '../../../client/hooks/use-screen-refresh';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../App';
import type { UserProfile, TimeSlot, Place } from '@nektus/shared-types';
import {
  getApiBaseUrl,
  getFieldValue,
  EVENT_TEMPLATES,
  formatSmartDay,
  processCommonSlots,
} from '@nektus/shared-client';
import { getIdToken } from '../../../client/auth/firebase';
import { createCalendarEvent, openEventInCalendar } from '../../../client/calendar/eventkit-service';
import { getEventKitBusyTimesForProfile } from '../../../client/calendar/eventkit-helpers';
import { StandardModal } from '../ui/modals/StandardModal';
import { useSession } from '../../providers/SessionProvider';
import { useProfile } from '../../context/ProfileContext';
import { ClientProfileService } from '../../../client/firebase/firebase-save';
import { PageHeader } from '../ui/layout/PageHeader';
import { ScreenTransition, useGoBackWithFade, useNavigateWithFade } from '../ui/layout/ScreenTransition';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../ui/buttons/Button';
import { ItemChip } from '../ui/modules/ItemChip';
import { textSizes, fontStyles } from '../ui/Typography';
import { emitMatchFound } from '../../utils/animationEvents';

type SmartScheduleViewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SmartSchedule'>;
type SmartScheduleViewRouteProp = RouteProp<RootStackParamList, 'SmartSchedule'>;


interface SuggestionChip {
  id: string;
  eventId: string;
  icon: string;
}

const PERSONAL_SUGGESTION_CHIPS: SuggestionChip[] = [
  { id: 'chip-1', eventId: 'video-30', icon: 'telephone-classic' },
  { id: 'chip-2', eventId: 'coffee-30', icon: 'coffee-simple' },
  { id: 'chip-3', eventId: 'lunch-60', icon: 'burger' },
  { id: 'chip-4', eventId: 'dinner-60', icon: 'utensils' },
  { id: 'chip-5', eventId: 'drinks-60', icon: 'drinks' },
];

const WORK_SUGGESTION_CHIPS: SuggestionChip[] = [
  { id: 'chip-1', eventId: 'quick-sync-30', icon: 'lightning-charge' },
  { id: 'chip-2', eventId: 'coffee-30', icon: 'coffee-simple' },
  { id: 'chip-3', eventId: 'deep-dive-60', icon: 'search' },
  { id: 'chip-4', eventId: 'live-working-session-60', icon: 'people' },
  { id: 'chip-5', eventId: 'lunch-60', icon: 'burger' },
];

/**
 * Format time slot for display
 */
const formatTimeSlot = (slot: TimeSlot, duration: number): string => {
  const start = new Date(slot.start);
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const startTime = start.toLocaleTimeString('en-US', timeOptions);
  const dayString = formatSmartDay(start);
  return `${dayString} • ${startTime} (${duration} min)`;
};

/**
 * Render chip icon SVG by name (matching web's /public/icons/*.svg)
 */
const ChipIcon = ({ name }: { name: string }) => {
  const size = 20;
  const fill = '#ffffff';

  switch (name) {
    case 'telephone-classic':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <Path fillRule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z" fill={fill} />
        </Svg>
      );
    case 'coffee-simple':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <Path fillRule="evenodd" d="M.5 6a.5.5 0 0 0-.488.608l1.652 7.434A2.5 2.5 0 0 0 4.104 16h5.792a2.5 2.5 0 0 0 2.44-1.958l.131-.59a3 3 0 0 0 1.3-5.854l.221-.99A.5.5 0 0 0 13.5 6zM13 12.5a2 2 0 0 1-.316-.025l.867-3.898A2.001 2.001 0 0 1 13 12.5" fill={fill} />
          <Path d="m4.4.8-.003.004-.014.019a4 4 0 0 0-.204.31 2 2 0 0 0-.141.267c-.026.06-.034.092-.037.103v.004a.6.6 0 0 0 .091.248c.075.133.178.272.308.445l.01.012c.118.158.26.347.37.543.112.2.22.455.22.745 0 .188-.065.368-.119.494a3 3 0 0 1-.202.388 5 5 0 0 1-.253.382l-.018.025-.005.008-.002.002A.5.5 0 0 1 3.6 4.2l.003-.004.014-.019a4 4 0 0 0 .204-.31 2 2 0 0 0 .141-.267c.026-.06.034-.092.037-.103a.6.6 0 0 0-.091-.248 1.4 1.4 0 0 0-.308-.445l-.01-.012C3.431 2.91 3.29 2.721 3.18 2.535c-.112-.2-.22-.455-.22-.745 0-.188.065-.368.119-.494A3 3 0 0 1 3.28.908 5 5 0 0 1 3.533.526l.018-.025.005-.008.002-.002A.5.5 0 0 1 4.4.8M5.5.8a.5.5 0 0 1 .823-.379l.003.004.014.019a4 4 0 0 1 .204.31 2 2 0 0 1 .141.267c.026.06.034.092.037.103a.6.6 0 0 1-.091.248 1.4 1.4 0 0 1-.308.445l-.01.012C6.095 2.089 5.954 2.278 5.844 2.464c-.112.2-.22.455-.22.745 0 .188.065.368.119.494.048.118.109.253.202.388a5 5 0 0 0 .253.382l.018.025.005.008.002.002a.5.5 0 0 1-.823.379l-.003-.004-.014-.019a4 4 0 0 1-.204-.31 2 2 0 0 1-.141-.267c-.026-.06-.034-.092-.037-.103a.6.6 0 0 1 .091-.248c.075-.133.178-.272.308-.445l.01-.012C5.569 2.911 5.71 2.722 5.82 2.536c.112-.2.22-.455.22-.745 0-.188-.065-.368-.119-.494A3 3 0 0 0 5.72.909 5 5 0 0 0 5.467.527l-.018-.025L5.444.494l-.002-.002A.5.5 0 0 1 5.5.8m2.5 0a.5.5 0 0 1 .823-.379l.003.004.014.019a4 4 0 0 1 .204.31 2 2 0 0 1 .141.267c.026.06.034.092.037.103a.6.6 0 0 1-.091.248 1.4 1.4 0 0 1-.308.445l-.01.012C8.595 2.089 8.454 2.278 8.344 2.464c-.112.2-.22.455-.22.745 0 .188.065.368.119.494.048.118.109.253.202.388a5 5 0 0 0 .253.382l.018.025.005.008.002.002a.5.5 0 0 1-.823.379l-.003-.004-.014-.019a4 4 0 0 1-.204-.31 2 2 0 0 1-.141-.267c-.026-.06-.034-.092-.037-.103a.6.6 0 0 1 .091-.248c.075-.133.178-.272.308-.445l.01-.012C8.069 2.911 8.21 2.722 8.32 2.536c.112-.2.22-.455.22-.745 0-.188-.065-.368-.119-.494A3 3 0 0 0 8.22.909 5 5 0 0 0 7.967.527l-.018-.025L7.944.494l-.002-.002A.5.5 0 0 1 8 .8" fill={fill} />
        </Svg>
      );
    case 'burger':
      return (
        <Svg width={size} height={size} viewBox="0 0 122.88 105.47" fill="none">
          <Path d="M4.99,83.59c37.32-0.07,74.61-0.11,111.93,0c2.22,0.01,4.04,1.82,4.04,4.04c0,6.03-2.53,17.83-16.17,17.83 c-29.23,0-58.45,0-87.68,0c-13.64,0-16.17-11.8-16.17-17.83C0.94,85.41,2.76,83.6,4.99,83.59L4.99,83.59z M88.55,13.6 c3.43,0,6.22,2.78,6.22,6.22c0,3.43-2.78,6.22-6.22,6.22c-3.43,0-6.22-2.78-6.22-6.22C82.34,16.39,85.12,13.6,88.55,13.6 L88.55,13.6z M34.33,14.04c3.43,0,6.22,2.78,6.22,6.22c0,3.43-2.78,6.22-6.22,6.22c-3.43,0-6.22-2.78-6.22-6.22 C28.11,16.82,30.89,14.04,34.33,14.04L34.33,14.04z M61.22,8.11c3.43,0,6.22,2.78,6.22,6.22c0,3.43-2.78,6.22-6.22,6.22 c-3.43,0-6.22-2.78-6.22-6.22C55.01,10.89,57.79,8.11,61.22,8.11L61.22,8.11z M111.63,44.63H11.57C5.21,44.63,0,39.43,0,33.07v0 C0,16.6,32.81,0.28,60.36,0C114.57-0.54,138.9,44.63,111.63,44.63L111.63,44.63z M120.69,62.21c0.17,0.29,0.26,0.6,0.26,0.93 c0,0.21-0.01,0.44-0.02,0.67c0.02,0.23,0.02,0.46,0.02,0.67c0,0.33-0.09,0.64-0.26,0.93c-0.92,4.01-4.6,9.26-15.9,9.26 c-29.23,0-58.45,0-87.68,0c-11.31,0-14.98-5.24-15.9-9.26c-0.17-0.29-0.26-0.6-0.26-0.93c0-0.21,0.01-0.44,0.02-0.67 c-0.02-0.23-0.02-0.46-0.02-0.67c0-0.33,0.09-0.64,0.26-0.93c0.92-4.01,4.6-9.26,15.9-9.26h45.4l16.74,17.29l16.63-17.29h8.91 C116.1,52.96,119.77,58.2,120.69,62.21L120.69,62.21z" fill={fill} fillRule="evenodd" clipRule="evenodd" />
        </Svg>
      );
    case 'utensils':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <Path d="M13 .5c0-.276-.226-.506-.498-.465-1.703.257-2.94 2.012-3 8.462a.5.5 0 0 0 .498.5c.56.01 1 .13 1 1.003v5.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5zM4.25 0a.25.25 0 0 1 .25.25v5.122a.128.128 0 0 0 .256.006l.233-5.14A.25.25 0 0 1 5.24 0h.522a.25.25 0 0 1 .25.238l.233 5.14a.128.128 0 0 0 .256-.006V.25A.25.25 0 0 1 6.75 0h.29a.5.5 0 0 1 .498.458l.423 5.07a1.69 1.69 0 0 1-1.059 1.711l-.053.022a.92.92 0 0 0-.58.884L6.47 15a.971.971 0 1 1-1.942 0l.202-6.855a.92.92 0 0 0-.58-.884l-.053-.022a1.69 1.69 0 0 1-1.059-1.712L3.462.458A.5.5 0 0 1 3.96 0z" fill={fill} />
        </Svg>
      );
    case 'drinks':
      return (
        <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
          <Path d="M32 0C19.1 0 7.4 7.8 2.4 19.8s-2.2 25.7 6.9 34.9L224 269.3 224 448l-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0 96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-178.7L502.6 54.6c9.2-9.2 11.9-22.9 6.9-34.9S492.9 0 480 0L32 0zM173.3 128l-64-64 293.5 0-64 64-165.5 0z" fill={fill} />
        </Svg>
      );
    case 'lightning-charge':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <Path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09z" fill={fill} />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <Path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" fill={fill} />
        </Svg>
      );
    case 'people':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <Path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" fill={fill} />
        </Svg>
      );
    default:
      return null;
  }
};

export function SmartScheduleView() {
  const navigation = useNavigation<SmartScheduleViewNavigationProp>();
  const route = useRoute<SmartScheduleViewRouteProp>();
  const goBackWithFade = useGoBackWithFade();
  const navigateWithFade = useNavigateWithFade();
  const { contactUserId, backgroundColors, contactProfile: passedContactProfile } = route.params;
  const { data: session } = useSession();
  const { profile: currentUserProfile } = useProfile();
  const apiBaseUrl = getApiBaseUrl();

  const isColdStart = useRef(true);
  const skipCacheOnRefresh = useRef(false);
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'personal' | 'work'>('personal');
  const [suggestedTimes, setSuggestedTimes] = useState<Record<string, TimeSlot | null>>({});
  const [chipPlaces, setChipPlaces] = useState<Record<string, Place | null>>({});
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [createdEventModal, setCreatedEventModal] = useState<{
    visible: boolean;
    title: string;
    subtitle: string;
    eventId: string;
    startDate: Date;
  } | null>(null);

  // Emit background colors immediately from nav params
  useEffect(() => {
    if (backgroundColors && backgroundColors.length >= 3) {
      emitMatchFound(backgroundColors);
    }
  }, [backgroundColors]);

  // Determine which chips to use based on section
  const SUGGESTION_CHIPS = section === 'work' ? WORK_SUGGESTION_CHIPS : PERSONAL_SUGGESTION_CHIPS;

  // Handle back navigation
  const handleBack = useCallback(() => {
    goBackWithFade();
  }, [goBackWithFade]);

  // Load contact profile
  useEffect(() => {
    const loadContact = async () => {
      if (!session?.user?.id || !contactUserId) return;

      try {
        // Fetch contact from Firestore (same approach as ContactView)
        const contact = await ClientProfileService.getContactById(session.user.id, contactUserId);
        if (contact) {
          setContactProfile(contact);
          // Emit contact colors for LayoutBackground
          if (contact.backgroundColors) {
            emitMatchFound(contact.backgroundColors);
          }
          // Use contactType from saved contact if available
          if ('contactType' in contact) {
            setSection((contact as any).contactType || 'personal');
          }
        } else if (passedContactProfile) {
          // Contact not yet in Firestore (just saved) - use the profile passed via nav params
          setContactProfile(passedContactProfile);
          if (passedContactProfile.backgroundColors) {
            emitMatchFound(passedContactProfile.backgroundColors);
          }
        }
      } catch (error) {
        console.error('[SmartScheduleView] Error loading contact:', error);
        // Fall back to passed profile on error
        if (passedContactProfile) {
          setContactProfile(passedContactProfile);
        }
      } finally {
        setLoading(false);
      }
    };

    loadContact();
  }, [session, contactUserId, passedContactProfile]);

  // Fetch suggested times
  const fetchSuggestedTimes = useCallback(async () => {
    if (!session?.user?.id || !contactProfile || !currentUserProfile) return;

    setLoadingTimes(true);

    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error('No auth token');

      const response = await fetch(`${apiBaseUrl}/api/scheduling/common-times`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          user1Id: session.user.id,
          user2Id: contactProfile.userId,
          calendarType: section,
          duration: 30,
          ...(await getEventKitBusyTimesForProfile(currentUserProfile)),
          ...(isColdStart.current || skipCacheOnRefresh.current ? { skipCache: true } : {}),
        }),
      });

      isColdStart.current = false;
      skipCacheOnRefresh.current = false;

      if (response.ok) {
        const data = await response.json();
        const commonSlots: TimeSlot[] = data.slots || [];

        // Process slots using template-aware scheduling (preferred hours, middle-time, travel buffers)
        const templateIds = SUGGESTION_CHIPS.map(chip => chip.eventId);
        const templateTimes = processCommonSlots(commonSlots, templateIds);

        // Map template results back to chip IDs
        const times: Record<string, TimeSlot | null> = {};
        SUGGESTION_CHIPS.forEach(chip => {
          times[chip.id] = templateTimes[chip.eventId] || null;
        });

        setSuggestedTimes(times);
      } else {
        throw new Error(`API call failed: ${response.status}`);
      }
    } catch (error) {
      console.error('[SmartScheduleView] Error fetching suggested times:', error);
      const errorTimes: Record<string, TimeSlot | null> = {};
      SUGGESTION_CHIPS.forEach(chip => {
        errorTimes[chip.id] = null;
      });
      setSuggestedTimes(errorTimes);
    } finally {
      setLoadingTimes(false);
    }
  }, [session, contactProfile, currentUserProfile, section, SUGGESTION_CHIPS, apiBaseUrl]);

  // Pull-to-refresh - refreshes suggested times (bypasses Redis cache)
  const { refreshControl } = useScreenRefresh({
    onRefresh: async () => {
      if (currentUserProfile && contactProfile) {
        skipCacheOnRefresh.current = true;
        setSuggestedTimes({});
        await fetchSuggestedTimes();
      }
    },
  });

  // Fetch places for in-person meetings
  const fetchPlaces = useCallback(async () => {
    if (!currentUserProfile || !contactProfile) return;

    // Filter for in-person chips with available time slots
    const inPersonChips = SUGGESTION_CHIPS.filter(chip => {
      const eventTemplate = EVENT_TEMPLATES[chip.eventId];
      const timeSlot = suggestedTimes[chip.id];
      return eventTemplate?.eventType === 'in-person' && timeSlot != null;
    });

    if (inPersonChips.length === 0) return;

    // Build addresses from user locations
    const findLocation = (locations: any[] | undefined) => {
      if (!locations || locations.length === 0) return null;
      return locations.find((l: any) => l.section === section)
        || locations.find((l: any) => l.section === 'universal')
        || locations[0]
        || null;
    };
    const buildAddress = (loc: any) => {
      if (!loc) return '';
      return [loc.address, loc.city, loc.region].filter((p: string) => p?.trim()).join(', ') || '';
    };

    const userAAddress = buildAddress(findLocation(currentUserProfile.locations));
    const userBAddress = buildAddress(findLocation(contactProfile.locations));

    // Group chips by meeting type to avoid duplicate API calls
    const meetingTypeMap: Record<string, string> = {
      'coffee-30': 'coffee', 'lunch-60': 'lunch', 'dinner-60': 'dinner', 'drinks-60': 'drinks',
    };
    const groups = new Map<string, string[]>();
    for (const chip of inPersonChips) {
      const meetingType = meetingTypeMap[chip.eventId] || 'coffee';
      if (!groups.has(meetingType)) groups.set(meetingType, []);
      groups.get(meetingType)!.push(chip.id);
    }

    const places: Record<string, Place | null> = {};
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);

    for (const [meetingType, chipIds] of groups.entries()) {
      try {
        const response = await fetch(`${apiBaseUrl}/api/scheduling/places`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userA_address: userAAddress,
            userB_address: userBAddress,
            meeting_type: meetingType,
            datetime: tomorrow.toISOString(),
            duration: 60,
            useIpFallback: true,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const suggestions: Place[] = data[meetingType] || [];
          chipIds.forEach((chipId, i) => {
            places[chipId] = suggestions.length > 0 ? suggestions[i % suggestions.length] : null;
          });
        } else {
          chipIds.forEach(id => { places[id] = null; });
        }
      } catch (error) {
        console.error(`[SmartScheduleView] Error fetching places for ${meetingType}:`, error);
        chipIds.forEach(id => { places[id] = null; });
      }
    }

    setChipPlaces(places);
  }, [currentUserProfile, contactProfile, section, suggestedTimes, SUGGESTION_CHIPS, apiBaseUrl]);

  // Fetch times when profiles are loaded
  useEffect(() => {
    if (currentUserProfile && contactProfile) {
      fetchSuggestedTimes();
    }
  }, [currentUserProfile, contactProfile, fetchSuggestedTimes]);

  // Fetch places when suggested times are loaded
  useEffect(() => {
    if (Object.keys(suggestedTimes).length > 0) {
      fetchPlaces();
    }
  }, [suggestedTimes, fetchPlaces]);

  // Handle chip click - open calendar event composer
  const handleChipClick = useCallback(async (chip: SuggestionChip) => {
    if (!currentUserProfile || !contactProfile || !session?.user) return;

    const eventTemplate = EVENT_TEMPLATES[chip.eventId];
    if (!eventTemplate) return;

    const existingTime = suggestedTimes[chip.id];
    const hasCheckedChip = chip.id in suggestedTimes;

    if (hasCheckedChip) {
      if (existingTime) {
        const contactName = getFieldValue(contactProfile.contactEntries, 'name');
        const contactEmail = getFieldValue(contactProfile.contactEntries, 'email');
        const startDate = new Date(existingTime.start);
        const endDate = new Date(existingTime.end);
        const place = chipPlaces[chip.id];

        const title = `${eventTemplate.title} with ${contactName}`;
        const location = (eventTemplate.eventType === 'in-person' && place) ? place.name : '';

        // Determine user's calendar access method for this section
        const userCalendar = currentUserProfile.calendars?.find(cal => cal.section === section);
        const accessMethod = userCalendar?.accessMethod;
        const provider = userCalendar?.provider || 'google';

        // EventKit: create event directly on device
        if (accessMethod === 'eventkit') {
          try {
            const eventId = await createCalendarEvent({
              title,
              startDate,
              endDate,
              location: location || undefined,
            });
            setCreatedEventModal({
              visible: true,
              title: 'Added to Calendar',
              subtitle: `${title} — ${formatTimeSlot(existingTime, eventTemplate.duration)}`,
              eventId,
              startDate,
            });
          } catch (error) {
            console.error('[SmartSchedule] EventKit create failed:', error);
            Alert.alert('Error', 'Failed to create calendar event. Please try again.');
          }
          return;
        }

        const formatDateForGoogle = (d: Date) =>
          d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        let calendarUrl: string;
        if (provider === 'microsoft') {
          const params = new URLSearchParams({
            subject: title,
            startdt: startDate.toISOString(),
            enddt: endDate.toISOString(),
            location,
            path: '/calendar/action/compose',
            rru: 'addevent',
          });
          if (contactEmail) params.append('to', contactEmail);
          calendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
        } else {
          // Google (default fallback for all providers including apple)
          const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: title,
            dates: `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`,
            location,
          });
          if (contactEmail) params.append('add', contactEmail);
          calendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;
        }

        Linking.openURL(calendarUrl).catch(() => {
          Alert.alert(
            'Add to Calendar',
            `${eventTemplate.title} with ${contactName}\n${formatTimeSlot(existingTime, eventTemplate.duration)}`,
            [{ text: 'OK' }]
          );
        });
      } else {
        // No available time — chip subtitle already shows the state, no-op
      }
    } else {
      // Data still loading — ignore tap
    }
  }, [currentUserProfile, contactProfile, session, suggestedTimes, chipPlaces, section]);

  // Navigate to AI Schedule view
  const handleCustomTimePlace = useCallback(() => {
    navigateWithFade('AISchedule', {
      contactUserId,
      backgroundColors: contactProfile?.backgroundColors || backgroundColors,
      savedContact: contactProfile,
      autoFocus: true,
    });
  }, [navigateWithFade, contactUserId, contactProfile, backgroundColors]);

  // Loading state
  if (loading || !contactProfile) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <PageHeader title="Meet Up" onBack={handleBack} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition>
      <View style={styles.container}>
        <PageHeader title="Meet Up" onBack={handleBack} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {/* Suggestion Chips */}
          <View style={styles.chipsContainer}>
            {SUGGESTION_CHIPS.map((chip) => {
              const hasCheckedChip = chip.id in suggestedTimes;
              const suggestedTime = suggestedTimes[chip.id];
              const isUnavailable = hasCheckedChip && !suggestedTime;
              const eventTemplate = EVENT_TEMPLATES[chip.eventId];

              // Build subtitle with time information
              const subtitle = loadingTimes
                ? 'Crunching calendars...'
                : suggestedTime && eventTemplate
                ? formatTimeSlot(suggestedTime, eventTemplate.duration)
                : isUnavailable
                ? 'Booked solid for 2 weeks'
                : 'Crunching calendars...';

              const place = chipPlaces[chip.id];
              const title = eventTemplate?.eventType === 'in-person' && place
                ? `${eventTemplate.title} @${place.name}`
                : eventTemplate?.title || 'Meeting';

              return (
                <ItemChip
                  key={chip.id}
                  icon={
                    <View style={styles.chipIcon}>
                      <ChipIcon name={chip.icon} />
                    </View>
                  }
                  title={title}
                  subtitle={subtitle}
                  onClick={() => !isUnavailable && !loadingTimes && handleChipClick(chip)}
                  truncateTitle={true}
                />
              );
            })}
          </View>

          {/* Custom Time & Place Button */}
          <Button
            variant="white"
            size="xl"
            onPress={handleCustomTimePlace}
            style={styles.customButton}
          >
            <Text style={styles.customButtonText}>Custom time & place</Text>
          </Button>
        </ScrollView>

        {/* EventKit success modal */}
        {createdEventModal && (
          <StandardModal
            isOpen={createdEventModal.visible}
            onClose={() => setCreatedEventModal(null)}
            title="You're on the books ✓"
            subtitle={createdEventModal.subtitle}
            primaryButtonText="See it in my calendar"
            onPrimaryButtonClick={async () => {
              await openEventInCalendar(createdEventModal.eventId, createdEventModal.startDate);
              setCreatedEventModal(null);
            }}
            secondaryButtonText="Nice"
            onSecondaryButtonClick={() => setCreatedEventModal(null)}
            showCloseButton={false}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  chipsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  chipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customButton: {
    width: '100%',
  },
  customButtonText: {
    ...textSizes.lg,
    ...fontStyles.bold,
    color: '#374151',
  },
});

