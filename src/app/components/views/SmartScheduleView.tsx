'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getEventTemplate, getEventTimeFromSlotWithBuffer } from '@/lib/events/event-templates';
import { getSuggestedTimes } from '@/lib/events/scheduling-utils';
import { createCompleteCalendarEvent, generateIcsContent, downloadICSFile } from '@/lib/events/event-utils';
import { fetchPlacesForChips } from '@/lib/places/place-utils';
import type { UserProfile, TimeSlot } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import type { Place } from '@/types/places';
import { ItemChip } from '@/app/components/ui/modules/ItemChip';
import { Button } from '@/app/components/ui/buttons/Button';
import { getFieldValue } from '@/lib/utils/profileTransforms';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';
import { useProfile } from '@/app/context/ProfileContext';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import { auth } from '@/lib/firebase/clientConfig';

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

export default function SmartScheduleView() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { profile: currentUserProfile } = useProfile();
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'personal' | 'work'>('personal');

  // Get 'from' query parameter to determine where to navigate back to
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const fromParam = searchParams.get('from');

  // Determine which chips to use based on section
  const SUGGESTION_CHIPS = section === 'work' ? WORK_SUGGESTION_CHIPS : PERSONAL_SUGGESTION_CHIPS;

  // State
  const [suggestedTimes, setSuggestedTimes] = useState<Record<string, TimeSlot | null>>({});
  const [chipPlaces, setChipPlaces] = useState<Record<string, Place | null>>({});
  const [loadingTimes, setLoadingTimes] = useState(false);

  // Handle background crossfade when entering from HistoryView
  useEffect(() => {
    const isEnteringFromHistory = sessionStorage.getItem('entering-from-history-to-schedule');
    const historyBackground = sessionStorage.getItem('history-background-url');

    if (isEnteringFromHistory === 'true') {
      console.log('🎯 SmartScheduleView: Detected entrance from HistoryView, setting up background crossfade');

      // Clear the flag
      sessionStorage.removeItem('entering-from-history-to-schedule');

      // If we have a history background and contact background, set up crossfade
      if (historyBackground && contactProfile?.backgroundImage) {
        console.log('🎯 SmartScheduleView: Setting up background crossfade');

        // Create style for history background that will fade out
        const historyBgStyle = document.createElement('style');
        historyBgStyle.id = 'history-background-fadeout';
        historyBgStyle.textContent = `
          body::after {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url('${historyBackground}');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            z-index: 10000;
            opacity: 1;
            transition: opacity 300ms ease-out;
            pointer-events: none;
          }
          body.fade-out-history-bg::after {
            opacity: 0;
          }
        `;
        document.head.appendChild(historyBgStyle);

        // Trigger fade out
        requestAnimationFrame(() => {
          document.body.classList.add('fade-out-history-bg');
        });

        // Clean up after animation
        setTimeout(() => {
          document.body.classList.remove('fade-out-history-bg');
          const style = document.getElementById('history-background-fadeout');
          if (style) {
            style.remove();
          }
          sessionStorage.removeItem('history-background-url');
        }, 300);
      } else {
        sessionStorage.removeItem('history-background-url');
      }
    }
  }, [contactProfile?.backgroundImage]);

  // Load contact profile
  useEffect(() => {
    async function loadContact() {
      if (!session?.user?.id || !params.userId) return;

      try {
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
        console.error('Error loading contact:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    loadContact();
  }, [session, params.userId, router]);

  // Fetch suggested times
  const fetchSuggestedTimes = useCallback(async () => {
    if (!session?.user?.id || !contactProfile || !currentUserProfile || !auth?.currentUser) return;

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
      }, auth.currentUser);

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
    const currentUserName = getFieldValue(currentUserProfile.contactEntries, 'name');

    // Get current user's calendar for this section
    const currentUserCalendar = currentUserProfile.calendars?.find(cal => cal.section === section);

    if (!currentUserCalendar) {
      alert('Please add a calendar for this profile type in your settings');
      return;
    }

    // Get contact's calendar email if they have one, otherwise use their profile email
    const contactCalendar = contactProfile.calendars?.find(cal => cal.section === section);
    const contactEmail = contactCalendar?.email || getFieldValue(contactProfile.contactEntries, 'email');

    const eventName = getEventName(eventTemplate.intent, contactName, currentUserName, eventTemplate.eventType);
    const eventDescription = getEventDescription(
      eventTemplate.intent,
      contactName,
      eventTemplate,
      actualMeetingStart,
      actualMeetingEnd,
      'Google Meet',
      currentUserName,
      place?.name,
      currentUserProfile.userId  // Pass current user's ID for profile link
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

    // Create calendar URLs using contact's email
    const contactForCalendar = { email: contactEmail };
    const displayName = getFieldValue(currentUserProfile.contactEntries, 'name') || undefined;
    const { formattedTitle, calendar_urls } = createCompleteCalendarEvent(
      event,
      contactForCalendar,  // Contact's email (calendar or profile)
      { displayName }
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
        attendees: [contactEmail]  // Use contact's email
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
    _intent: string,
    contactName: string,
    eventTemplate?: EventTemplate,
    actualStart?: Date,
    actualEnd?: Date,
    videoPlatform?: string,
    organizerName?: string,
    placeName?: string,
    currentUserId?: string
  ): string => {
    let description = '';

    if (eventTemplate?.eventType === 'in-person' && eventTemplate?.travelBuffer && actualStart && actualEnd) {
      const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
      const startTime = actualStart.toLocaleTimeString('en-US', timeOptions);
      const endTime = actualEnd.toLocaleTimeString('en-US', timeOptions);
      const beforeBuffer = eventTemplate.travelBuffer.beforeMinutes;
      const afterBuffer = eventTemplate.travelBuffer.afterMinutes;
      const place = placeName || 'the venue';

      description = `Meeting time: ${startTime} - ${endTime}\nIncludes ${beforeBuffer} min of travel time to ${place} and ${afterBuffer} min back`;
    } else if (eventTemplate?.eventType === 'video') {
      const platform = videoPlatform || 'platform TBD';
      if (platform === 'Google Meet' || platform === 'Microsoft Teams') {
        description = `Video call on ${platform}`;
      } else {
        const organizer = organizerName || 'organizer';
        description = `Video call on ${platform} - ${organizer} to send video link or phone #`;
      }
    } else {
      description = `Meeting with ${contactName}`;
    }

    // Add Nekt branding footer
    const profileUrl = currentUserId ? `https://nekt.us/${currentUserId}` : 'https://nekt.us';
    description += `\n\nScheduled via Nekt (nekt.us). You can check out my profile here: ${profileUrl}`;

    return description;
  };

  // Loading state
  if (loading || !contactProfile) {
    return null;
  }

  const contactName = getFieldValue(contactProfile.contactEntries, 'name');

  return (
    <div className="min-h-dvh relative z-[1001]">
      {/* Header */}
      <div className="px-6 pt-2">
        <div className="max-w-[var(--max-content-width,448px)] mx-auto">
          <PageHeader
            onBack={() => {
              // Navigate back to history if user came from there, otherwise go to contact profile
              if (fromParam === 'history') {
                // Mark that we're returning to history for crossfade animation
                sessionStorage.setItem('returning-to-history', 'true');

                // Store contact background for crossfade
                if (contactProfile?.backgroundImage) {
                  sessionStorage.setItem('contact-background-url', contactProfile.backgroundImage);
                }

                router.push('/history');
              } else {
                router.push(`/contact/${params.userId}`);
              }
            }}
            title="Meet Up"
          />
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

              // Helper function to format day string
              const formatSmartDay = (date: Date): string => {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

                if (inputDate.getTime() === today.getTime()) {
                  return 'Today';
                }

                if (inputDate.getTime() === tomorrow.getTime()) {
                  return 'Tomorrow';
                }

                const daysDiff = Math.floor((inputDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysDiff > 0 && daysDiff <= 7) {
                  return date.toLocaleDateString('en-US', { weekday: 'long' });
                }

                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              };

              // Build subtitle with time information like CalConnect
              const subtitle = loadingTimes
                ? 'Finding times...'
                : suggestedTime && eventTemplate
                ? (() => {
                    const slotStart = new Date(suggestedTime.start);
                    const eventTimes = getEventTimeFromSlotWithBuffer(
                      slotStart,
                      eventTemplate.duration,
                      eventTemplate.travelBuffer
                    );
                    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
                    const startTime = eventTimes.start.toLocaleTimeString('en-US', timeOptions);
                    const dayString = formatSmartDay(eventTimes.start);
                    return `${dayString} • ${startTime} (${eventTemplate.duration} min)`;
                  })()
                : isUnavailable
                ? 'No times in next 2 weeks'
                : 'Finding times...';

              // Format title - for in-person events with place, use "@Location" format
              const title = eventTemplate?.eventType === 'in-person' && place
                ? `${eventTemplate.title} @${place.name}`
                : eventTemplate?.title || 'Meeting';

              return (
                <ItemChip
                  key={chip.id}
                  icon={
                    <img src={`/icons/${chip.icon}.svg`} className="w-6 h-6 text-white" alt="" style={{ filter: 'brightness(0) invert(1)' }} />
                  }
                  title={title}
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
            size="xl"
            className="w-full"
            onClick={() => {
              // Preserve the 'from' parameter when navigating to AI schedule
              const queryString = fromParam ? `?from=${fromParam}` : '';
              router.push(`/contact/${params.userId}/ai-schedule${queryString}`);
            }}
          >
            Find Custom Time & Place
          </Button>
        </div>
      </div>
    </div>
  );
}
