/**
 * SmartScheduleView - Smart scheduling with suggested meeting times
 * Shows pre-computed meeting suggestions based on both users' calendars
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../App';
import type { UserProfile, TimeSlot } from '@nektus/shared-types';
import { getApiBaseUrl } from '@nektus/shared-client';
import { useSession } from '../../providers/SessionProvider';
import { useProfile } from '../../context/ProfileContext';
import { PageHeader } from '../ui/layout/PageHeader';
import { Button } from '../ui/buttons/Button';
import { ItemChip } from '../ui/modules/ItemChip';

type SmartScheduleViewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SmartSchedule'>;
type SmartScheduleViewRouteProp = RouteProp<RootStackParamList, 'SmartSchedule'>;

interface SuggestionChip {
  id: string;
  eventId: string;
  icon: string;
}

interface EventTemplate {
  id: string;
  title: string;
  duration: number;
  eventType: 'video' | 'in-person';
}

// Event templates
const EVENT_TEMPLATES: Record<string, EventTemplate> = {
  'video-30': { id: 'video-30', title: 'Quick Call', duration: 30, eventType: 'video' },
  'coffee-30': { id: 'coffee-30', title: 'Coffee', duration: 30, eventType: 'in-person' },
  'lunch-60': { id: 'lunch-60', title: 'Lunch', duration: 60, eventType: 'in-person' },
  'dinner-60': { id: 'dinner-60', title: 'Dinner', duration: 60, eventType: 'in-person' },
  'drinks-60': { id: 'drinks-60', title: 'Drinks', duration: 60, eventType: 'in-person' },
  'quick-sync-30': { id: 'quick-sync-30', title: 'Quick Sync', duration: 30, eventType: 'video' },
  'deep-dive-60': { id: 'deep-dive-60', title: 'Deep Dive', duration: 60, eventType: 'video' },
  'live-working-session-60': { id: 'live-working-session-60', title: 'Working Session', duration: 60, eventType: 'video' },
};

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
 * Get a field value from ContactEntry array by fieldType
 */
const getFieldValue = (contactEntries: any[] | undefined, fieldType: string): string => {
  if (!contactEntries) return '';
  const entry = contactEntries.find(e => e.fieldType === fieldType);
  return entry?.value || '';
};

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
 * Format day in smart format (Today, Tomorrow, Day name, or date)
 */
const formatSmartDay = (date: Date): string => {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function SmartScheduleView() {
  const navigation = useNavigation<SmartScheduleViewNavigationProp>();
  const route = useRoute<SmartScheduleViewRouteProp>();
  const { contactUserId } = route.params;
  const { data: session } = useSession();
  const { profile: currentUserProfile, getContact } = useProfile();
  const apiBaseUrl = getApiBaseUrl();

  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'personal' | 'work'>('personal');
  const [suggestedTimes, setSuggestedTimes] = useState<Record<string, TimeSlot | null>>({});
  const [loadingTimes, setLoadingTimes] = useState(false);

  // Determine which chips to use based on section
  const SUGGESTION_CHIPS = section === 'work' ? WORK_SUGGESTION_CHIPS : PERSONAL_SUGGESTION_CHIPS;

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Load contact profile
  useEffect(() => {
    const loadContact = async () => {
      if (!session?.user?.id || !contactUserId) return;

      try {
        // Try to get contact from cache first
        const savedContact = getContact(contactUserId);

        if (savedContact) {
          // For saved contacts, we need to fetch the full profile
          const response = await fetch(`${apiBaseUrl}/api/contacts/${contactUserId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.profile) {
              setContactProfile(data.profile);
              // Use contactType from saved contact if available
              if (savedContact && 'contactType' in savedContact) {
                setSection((savedContact as any).contactType || 'personal');
              }
            }
          }
        } else {
          // Direct fetch if not in cache
          const response = await fetch(`${apiBaseUrl}/api/profile/${contactUserId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.profile) {
              setContactProfile(data.profile);
            }
          }
        }
      } catch (error) {
        console.error('[SmartScheduleView] Error loading contact:', error);
      } finally {
        setLoading(false);
      }
    };

    loadContact();
  }, [session, contactUserId, apiBaseUrl, getContact]);

  // Fetch suggested times
  const fetchSuggestedTimes = useCallback(async () => {
    if (!session?.user?.id || !contactProfile || !currentUserProfile) return;

    setLoadingTimes(true);

    try {
      const eventTemplateIds = SUGGESTION_CHIPS.map(chip => chip.eventId);

      const response = await fetch(`${apiBaseUrl}/api/scheduling/suggested-times`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1Id: session.user.id,
          user2Id: contactProfile.userId,
          calendarType: section,
          eventTemplateIds,
        }),
      });

      if (response.ok) {
        const suggestedTimesResult = await response.json();

        // Map event template IDs back to chip IDs
        const times: Record<string, TimeSlot | null> = {};
        SUGGESTION_CHIPS.forEach(chip => {
          times[chip.id] = suggestedTimesResult[chip.eventId] || null;
        });

        setSuggestedTimes(times);
      }
    } catch (error) {
      console.error('[SmartScheduleView] Error fetching suggested times:', error);
      // Set all to null on error
      const errorTimes: Record<string, TimeSlot | null> = {};
      SUGGESTION_CHIPS.forEach(chip => {
        errorTimes[chip.id] = null;
      });
      setSuggestedTimes(errorTimes);
    } finally {
      setLoadingTimes(false);
    }
  }, [session, contactProfile, currentUserProfile, section, SUGGESTION_CHIPS, apiBaseUrl]);

  // Fetch times when profiles are loaded
  useEffect(() => {
    if (currentUserProfile && contactProfile) {
      fetchSuggestedTimes();
    }
  }, [currentUserProfile, contactProfile, fetchSuggestedTimes]);

  // Handle chip click - open calendar event composer
  const handleChipClick = useCallback((chip: SuggestionChip) => {
    if (!currentUserProfile || !contactProfile || !session?.user) return;

    const eventTemplate = EVENT_TEMPLATES[chip.eventId];
    if (!eventTemplate) return;

    const existingTime = suggestedTimes[chip.id];
    const hasCheckedChip = chip.id in suggestedTimes;

    if (hasCheckedChip) {
      if (existingTime) {
        // Open calendar with event details
        const contactName = getFieldValue(contactProfile.contactEntries, 'name');
        const startDate = new Date(existingTime.start);
        const endDate = new Date(existingTime.end);

        // Format for iOS calendar URL
        const title = encodeURIComponent(`${eventTemplate.title} with ${contactName}`);
        const startISO = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const endISO = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        // Try to open in calendar app
        const calendarUrl = `calshow:${startDate.getTime() / 1000}`;
        Linking.openURL(calendarUrl).catch(() => {
          Alert.alert(
            'Add to Calendar',
            `${eventTemplate.title} with ${contactName}\n${formatTimeSlot(existingTime, eventTemplate.duration)}`,
            [{ text: 'OK' }]
          );
        });
      } else {
        Alert.alert('No Available Time', 'No available time slots found in the next 14 days');
      }
    } else {
      Alert.alert('Loading', 'Please wait for scheduling data to load');
    }
  }, [currentUserProfile, contactProfile, session, suggestedTimes]);

  // Navigate to AI Schedule view
  const handleCustomTimePlace = useCallback(() => {
    navigation.navigate('AISchedule', { contactUserId });
  }, [navigation, contactUserId]);

  // Loading state
  if (loading || !contactProfile) {
    return (
      <View style={styles.container}>
        <PageHeader title="Meet Up" onBack={handleBack} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      </View>
    );
  }

  const contactName = getFieldValue(contactProfile.contactEntries, 'name');

  return (
    <>
      <View style={styles.container}>
        <PageHeader title="Meet Up" onBack={handleBack} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
                ? 'Finding times...'
                : suggestedTime && eventTemplate
                ? formatTimeSlot(suggestedTime, eventTemplate.duration)
                : isUnavailable
                ? 'No times in next 2 weeks'
                : 'Finding times...';

              const title = eventTemplate?.title || 'Meeting';

              return (
                <ItemChip
                  key={chip.id}
                  icon={
                    <View style={styles.chipIcon}>
                      <Text style={styles.chipIconText}>
                        {eventTemplate?.eventType === 'video' ? '📞' : '☕'}
                      </Text>
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
            <Text style={styles.customButtonText}>Find Custom Time & Place</Text>
          </Button>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
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
  chipIconText: {
    fontSize: 20,
  },
  customButton: {
    width: '100%',
  },
  customButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
});

export default SmartScheduleView;
