'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getEventTemplate, getEventTimeFromSlotWithBuffer } from '@/lib/events/event-templates';
import { getSuggestedTimes } from '@/lib/events/scheduling-utils';
import { createCompleteCalendarEvent, generateIcsContent, downloadICSFile } from '@/lib/events/event-utils';
import { fetchPlacesForChips } from '@/lib/places/place-utils';
import type { UserProfile, Calendar } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import type { Place } from '@/types/places';
import { ItemChip } from '@/app/components/ui/ItemChip';
import { Button } from '@/app/components/ui/buttons/Button';
import { FaArrowLeft } from 'react-icons/fa';
import { getFieldValue } from '@/lib/utils/profileTransforms';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';

// Suggestion chip type
interface SuggestionChip {
  id: string;
  eventId: string;
  icon: string;
}

// Event template type (simplified from full Event type)
interface EventTemplate {
  id: string;
  title: string;
  duration: number;
  eventType: 'video' | 'in-person';
  intent: string;
  travelBuffer?: {
    beforeMinutes: number;
    afterMinutes: number;
  };
}

// Time slot type
interface TimeSlot {
  start: string;
  end: string;
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

export default function SmartSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'personal' | 'work'>('personal');

  // Determine which chips to use based on section
  const SUGGESTION_CHIPS = section === 'work' ? WORK_SUGGESTION_CHIPS : PERSONAL_SUGGESTION_CHIPS;

  // State
  const [suggestedTimes, setSuggestedTimes] = useState<Record<string, TimeSlot | null>>({});
  const [chipPlaces, setChipPlaces] = useState<Record<string, Place | null>>({});
  const [loadingTimes, setLoadingTimes] = useState(false);

  // Load profiles
  useEffect(() => {
    async function loadProfiles() {
      if (!session?.user?.id || !params.userId) return;

      try {
        // Load current user profile
        const userResponse = await fetch(`/api/profile/${session.user.id}`);
        if (!userResponse.ok) throw new Error('Failed to load user profile');
        const userProf = await userResponse.json();
        setCurrentUserProfile(userProf);

        // Load saved contact to get the section and profile data
        const contacts = await ClientProfileService.getContacts(session.user.id);
        const savedContact = contacts.find((c: SavedContact) => c.userId === params.userId);

        if (!savedContact) {
          console.error('Contact not found in saved contacts');
          router.push('/');
          return;
        }

        // Set section from saved contact
        setSection(savedContact.contactType);
        setContactProfile(savedContact);
      } catch (error) {
        console.error('Error loading profiles:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    loadProfiles();
  }, [session, params.userId, router]);

  // Fetch suggested times
  const fetchSuggestedTimes = useCallback(async () => {
    if (!session?.user?.id || !contactProfile || !currentUserProfile) return;

    setLoadingTimes(true);

    try {
      const eventTemplateIds = SUGGESTION_CHIPS.map(chip => chip.eventId);

      const suggestedTimesResult = await getSuggestedTimes({
        user1Id: session.user.id,
        user2Id: contactProfile.userId,
        calendarType: section,
        eventTemplateIds,
        preFetchData: null,
        isPreFetching: false
      });

      // Map event template IDs back to chip IDs
      const times: Record<string, TimeSlot | null> = {};
      SUGGESTION_CHIPS.forEach(chip => {
        times[chip.id] = suggestedTimesResult[chip.eventId] || null;
      });

      setSuggestedTimes(times);
    } catch (error) {
      console.error('Error fetching suggested times:', error);
      // Set all to null on error
      const errorTimes: Record<string, TimeSlot | null> = {};
      SUGGESTION_CHIPS.forEach(chip => {
        errorTimes[chip.id] = null;
      });
      setSuggestedTimes(errorTimes);
    } finally {
      setLoadingTimes(false);
    }
  }, [session, contactProfile, currentUserProfile, section, SUGGESTION_CHIPS]);

  // Fetch places for in-person meetings
  const fetchPlaces = useCallback(async () => {
    if (!currentUserProfile || !contactProfile) return;

    // Only fetch places for in-person events with available time slots
    const inPersonChips = SUGGESTION_CHIPS.filter(chip => {
      const eventTemplate = getEventTemplate(chip.eventId);
      const isInPerson = eventTemplate?.eventType === 'in-person';
      const timeSlot = suggestedTimes[chip.id];
      const hasAvailableTime = timeSlot !== null && timeSlot !== undefined;

      return isInPerson && hasAvailableTime;
    });

    if (inPersonChips.length === 0) {
      return;
    }

    try {
      const places = await fetchPlacesForChips(
        currentUserProfile,
        contactProfile,
        section,
        inPersonChips.map(chip => chip.id),
        inPersonChips.map(chip => chip.eventId)
      );

      setChipPlaces(places);
    } catch (error) {
      console.error('Error fetching places:', error);
    }
  }, [currentUserProfile, contactProfile, section, suggestedTimes, SUGGESTION_CHIPS]);

  // Effects
  useEffect(() => {
    if (currentUserProfile && contactProfile) {
      fetchSuggestedTimes();
    }
  }, [currentUserProfile, contactProfile, fetchSuggestedTimes]);

  useEffect(() => {
    if (Object.keys(suggestedTimes).length > 0) {
      fetchPlaces();
    }
  }, [suggestedTimes, fetchPlaces]);

  // Handle chip click
  const handleChipClick = async (chip: SuggestionChip) => {
    if (!currentUserProfile || !contactProfile) return;

    const eventTemplate = getEventTemplate(chip.eventId);
    if (!eventTemplate) return;

    const existingTime = suggestedTimes[chip.id];
    const hasCheckedChip = chip.id in suggestedTimes;

    if (hasCheckedChip) {
      if (existingTime) {
        openCalendarCompose(existingTime, eventTemplate, chipPlaces[chip.id] || null);
      } else {
        alert('No available time slots found in the next 14 days');
      }
    } else {
      alert('Please wait for scheduling data to load');
    }
  };

  // Open calendar compose
  const openCalendarCompose = async (slot: TimeSlot, eventTemplate: EventTemplate, place: Place | null) => {
    if (!currentUserProfile || !contactProfile || !session?.user) return;

    // Calculate actual meeting times
    const slotStartDate = new Date(slot.start);
    const { start: actualMeetingStart, end: actualMeetingEnd } = getEventTimeFromSlotWithBuffer(
      slotStartDate,
      eventTemplate.duration,
      eventTemplate.travelBuffer
    );

    // Calendar event includes buffer time
    const beforeBuffer = eventTemplate.travelBuffer?.beforeMinutes || 0;
    const afterBuffer = eventTemplate.travelBuffer?.afterMinutes || 0;
    const startDate = new Date(actualMeetingStart.getTime() - beforeBuffer * 60 * 1000);
    const endDate = new Date(actualMeetingEnd.getTime() + afterBuffer * 60 * 1000);

    // Create event details
    const contactName = getFieldValue(contactProfile.contactEntries, 'name');
    const currentUserName = getFieldValue(currentUserProfile.contactEntries, 'name');

    // Get calendar emails (not profile emails) for attendees
    const contactCalendar = contactProfile.calendars?.find(cal => cal.section === section);
    const currentUserCalendar = currentUserProfile.calendars?.find(cal => cal.section === section);

    if (!contactCalendar || !currentUserCalendar) {
      alert('Both users need calendars set up for this profile type');
      return;
    }

    const eventName = getEventName(eventTemplate.intent, contactName, currentUserName, eventTemplate.eventType);
    const eventDescription = getEventDescription(
      eventTemplate.intent,
      contactName,
      eventTemplate,
      actualMeetingStart,
      actualMeetingEnd,
      'Google Meet',
      currentUserName,
      place?.name
    );

    const event = {
      title: eventName,
      description: eventDescription,
      startTime: startDate,
      endTime: endDate,
      location: (eventTemplate.eventType === 'in-person' && place) ? place.name : undefined,
      eventType: eventTemplate.eventType,
      travelBuffer: eventTemplate.travelBuffer,
      preferredPlaces: place ? [place] : undefined
    };

    // Create calendar URLs using calendar emails (not profile emails)
    const { formattedTitle, calendar_urls } = createCompleteCalendarEvent(
      event,
      { email: contactCalendar.email },  // Contact's calendar email for this section
      currentUserProfile
    );

    // Determine preferred provider from user's calendars
    let preferredProvider = 'google';
    const userCalendar = currentUserProfile.calendars?.find(cal => cal.section === section);
    if (userCalendar) {
      preferredProvider = userCalendar.provider;
    }

    // Open calendar or download ICS
    if (preferredProvider === 'apple') {
      const calendarEvent = {
        title: formattedTitle,
        description: event.description,
        location: event.location || '',
        startTime: event.startTime,
        endTime: event.endTime,
        attendees: [contactCalendar.email]  // Use calendar email, not profile email
      };
      const icsContent = generateIcsContent(calendarEvent);
      const filename = `${formattedTitle.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
      downloadICSFile(icsContent, filename);
    } else {
      const calendarUrl = preferredProvider === 'microsoft' ? calendar_urls.outlook : calendar_urls.google;
      window.open(calendarUrl, '_blank');
    }
  };

  // Helper functions
  const getEventName = (intent: string, contactName: string, userName?: string, eventType?: string): string => {
    if (eventType === 'video') {
      return `${contactName} / ${userName || 'User'} 1-1`;
    }

    switch (intent) {
      case 'coffee': return 'Coffee';
      case 'lunch': return 'Lunch';
      case 'dinner': return 'Dinner';
      case 'drinks': return 'Drinks';
      case 'live_working_session': return 'Live Working Session';
      case 'quick_sync': return 'Quick Sync';
      case 'deep_dive': return 'Deep Dive';
      default: return 'Meeting';
    }
  };

  const getEventDescription = (
    intent: string,
    contactName: string,
    eventTemplate?: EventTemplate,
    actualStart?: Date,
    actualEnd?: Date,
    videoPlatform?: string,
    organizerName?: string,
    placeName?: string
  ): string => {
    if (eventTemplate?.eventType === 'in-person' && eventTemplate?.travelBuffer && actualStart && actualEnd) {
      const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
      const startTime = actualStart.toLocaleTimeString('en-US', timeOptions);
      const endTime = actualEnd.toLocaleTimeString('en-US', timeOptions);
      const beforeBuffer = eventTemplate.travelBuffer.beforeMinutes;
      const afterBuffer = eventTemplate.travelBuffer.afterMinutes;
      const place = placeName || 'the venue';

      return `Meeting time: ${startTime} - ${endTime}\nIncludes ${beforeBuffer} min of travel time to ${place} and ${afterBuffer} min back`;
    } else if (eventTemplate?.eventType === 'video') {
      const platform = videoPlatform || 'platform TBD';
      if (platform === 'Google Meet' || platform === 'Microsoft Teams') {
        return `Video call on ${platform}`;
      } else {
        const organizer = organizerName || 'organizer';
        return `Video call on ${platform} - ${organizer} to send video link or phone #`;
      }
    }

    return `Meeting with ${contactName}`;
  };

  // Loading state
  if (loading || !contactProfile) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="animate-pulse text-white">Loading...</div>
      </div>
    );
  }

  const contactName = getFieldValue(contactProfile.contactEntries, 'name');

  return (
    <div className="min-h-dvh bg-gradient-to-br from-gray-900 to-black">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="max-w-[var(--max-content-width,448px)] mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-4"
          >
            <FaArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <h1 className="text-white text-2xl font-bold">
            Schedule with {contactName}
          </h1>
          <p className="text-white/60 text-sm mt-1">
            {section === 'work' ? 'Work' : 'Personal'} Calendar
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-6">
        <div className="max-w-[var(--max-content-width,448px)] mx-auto">
          {/* Suggestion Chips */}
          <div className="space-y-3 mb-6">
            {SUGGESTION_CHIPS.map((chip) => {
              const hasCheckedChip = chip.id in suggestedTimes;
              const suggestedTime = suggestedTimes[chip.id];
              const isUnavailable = hasCheckedChip && !suggestedTime;
              const eventTemplate = getEventTemplate(chip.eventId);
              const place = chipPlaces[chip.id];

              // Build subtitle
              const subtitle = loadingTimes
                ? 'Checking availability...'
                : eventTemplate?.eventType === 'video'
                ? 'Video Call'
                : place
                ? `${place.name} • ${(place.distance_from_midpoint_km * 0.621371).toFixed(1)} mi`
                : suggestedTime
                ? 'Finding venue...'
                : 'No availability';

              return (
                <ItemChip
                  key={chip.id}
                  icon={
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                      <img src={`/icons/${chip.icon}.svg`} className="w-5 h-5" alt="" />
                    </div>
                  }
                  title={`${eventTemplate?.title || 'Meeting'} ${eventTemplate?.duration || 30}m`}
                  subtitle={subtitle}
                  onClick={() => !isUnavailable && !loadingTimes && handleChipClick(chip)}
                  truncateTitle={true}
                  className={isUnavailable ? 'opacity-50 pointer-events-none' : ''}
                />
              );
            })}
          </div>

          {/* Custom Time & Place Button */}
          <Button
            variant="white"
            className="w-full"
            onClick={() => router.push(`/contact/${params.userId}/ai-schedule`)}
          >
            Find Custom Time & Place
          </Button>
        </div>
      </div>
    </div>
  );
}
