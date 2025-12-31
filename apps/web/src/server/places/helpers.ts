import type { UserProfile, Event } from '@/types';
import type { Place } from '@/types/places';
import { findBestLocationForCalendarType, buildFullAddress } from '@/server/location/location';
import { getEventTemplate } from '@/server/calendar/event-templates';

/**
 * Check if a place is open at a specific time
 */
export function isPlaceOpenAt(place: Place, dateTime: Date): boolean {
  if (!place.opening_hours?.periods || place.opening_hours.periods.length === 0) {
    // If no opening hours data, assume it's open (don't exclude it)
    return true;
  }

  const dayOfWeek = dateTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = dateTime.getHours();
  const minute = dateTime.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  // Check if the place has a period that covers this day and time
  for (const period of place.opening_hours.periods) {
    if (period.open.day === dayOfWeek) {
      const openTime = period.open.hour * 60 + period.open.minute;

      // If no close time, assume open 24 hours
      if (!period.close) {
        return timeInMinutes >= openTime;
      }

      const closeTime = period.close.hour * 60 + period.close.minute;

      // Handle cases where closing time is past midnight
      if (closeTime < openTime) {
        // Example: open 22:00, close 02:00 next day
        return timeInMinutes >= openTime || timeInMinutes < closeTime;
      } else {
        // Normal case: open 09:00, close 22:00
        return timeInMinutes >= openTime && timeInMinutes < closeTime;
      }
    }
  }

  return false;
}

export interface FetchPlacesForEventsParams {
  currentUser: UserProfile;
  targetUser: UserProfile;
  calendarType: 'personal' | 'work';
  events: Event[] | Event;
  datetime?: Date;
}

interface MeetingTypeGroup {
  meetingType: 'coffee' | 'lunch' | 'dinner' | 'drinks';
  eventIds: string[];
  duration: number;
}

/**
 * Fetch place suggestions for one or multiple events
 * Consolidates logic from smart-schedule and chat-schedule
 * Groups events by meeting type to avoid duplicate API calls
 */
export async function fetchPlacesForEvents(
  params: FetchPlacesForEventsParams
): Promise<Record<string, Place | null>> {
  const { currentUser, targetUser, calendarType, events, datetime } = params;

  // Normalize to array
  const eventsArray = Array.isArray(events) ? events : [events];

  // Find best locations for both users based on calendar type
  const currentUserLocation = findBestLocationForCalendarType(currentUser.locations || [], calendarType);
  const targetUserLocation = findBestLocationForCalendarType(targetUser.locations || [], calendarType);

  // Build full addresses
  let userAAddress = buildFullAddress(currentUserLocation);
  let userBAddress = buildFullAddress(targetUserLocation);

  // Require at least one valid address
  if (!userAAddress && !userBAddress) {
    console.warn('No valid addresses found for either user');
    return {};
  }

  // For single address, use it for both (places API will find nearby venues)
  if (!userAAddress && userBAddress) {
    userAAddress = userBAddress;
  } else if (userAAddress && !userBAddress) {
    userBAddress = userAAddress;
  }

  // Group events by meeting type to avoid duplicate API calls
  const eventsByMeetingType = new Map<string, MeetingTypeGroup>();

  for (const event of eventsArray) {
    // Skip non-in-person events
    if (event.eventType !== 'in-person') {
      continue;
    }

    // Determine meeting type from event intent
    let meetingType: 'coffee' | 'lunch' | 'dinner' | 'drinks' | null = null;
    if (event.intent === 'coffee') meetingType = 'coffee';
    else if (event.intent === 'lunch') meetingType = 'lunch';
    else if (event.intent === 'dinner') meetingType = 'dinner';
    else if (event.intent === 'drinks') meetingType = 'drinks';
    else if (event.intent === 'live_working_session') meetingType = 'coffee'; // Use coffee for working sessions

    if (!meetingType) {
      continue;
    }

    // Add to group
    if (!eventsByMeetingType.has(meetingType)) {
      eventsByMeetingType.set(meetingType, {
        meetingType,
        eventIds: [],
        duration: event.duration
      });
    }
    eventsByMeetingType.get(meetingType)!.eventIds.push(event.id);
  }

  // If no in-person events, return empty
  if (eventsByMeetingType.size === 0) {
    return {};
  }

  // Fetch places for each unique meeting type
  const placesByMeetingType: Record<string, Place[]> = {};

  for (const [meetingType, group] of eventsByMeetingType.entries()) {
    // Use provided datetime or default to tomorrow at noon
    const sampleDateTime = datetime || (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      return tomorrow;
    })();

    try {
      const response = await fetch('/api/scheduling/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userA_address: userAAddress,
          userB_address: userBAddress,
          meeting_type: meetingType,
          datetime: sampleDateTime.toISOString(),
          duration: group.duration
        })
      });

      if (response.ok) {
        const data = await response.json();
        const suggestions = data[meetingType as keyof typeof data];
        placesByMeetingType[meetingType] = suggestions || [];
      } else {
        console.error(`Failed to fetch places for ${meetingType}:`, response.status, response.statusText);
        placesByMeetingType[meetingType] = [];
      }
    } catch (error) {
      console.error(`Error fetching places for ${meetingType}:`, error);
      placesByMeetingType[meetingType] = [];
    }
  }

  // Distribute different places to events of the same meeting type to avoid duplicates
  const result: Record<string, Place | null> = {};

  for (const [meetingType, group] of eventsByMeetingType.entries()) {
    const availablePlaces = placesByMeetingType[meetingType] || [];

    group.eventIds.forEach((eventId, index) => {
      // Use different place for each event, cycling through available places
      if (availablePlaces.length > 0) {
        const placeIndex = index % availablePlaces.length;
        result[eventId] = availablePlaces[placeIndex];
      } else {
        result[eventId] = null;
      }
    });
  }

  return result;
}

/**
 * Fetch places for suggestion chips (smart-schedule specific)
 * Wrapper around fetchPlacesForEvents that works with chip structure
 */
export async function fetchPlacesForChips(
  currentUser: UserProfile,
  targetUser: UserProfile,
  calendarType: 'personal' | 'work',
  chipIds: string[],
  chipEventIds: string[],
  datetime?: Date
): Promise<Record<string, Place | null>> {
  // Convert chip event IDs to event templates
  const events: Event[] = chipEventIds
    .map(eventId => getEventTemplate(eventId))
    .filter((template): template is Event => template !== null);

  // Fetch places for all events
  const placesByEventId = await fetchPlacesForEvents({
    currentUser,
    targetUser,
    calendarType,
    events,
    datetime
  });

  // Map event IDs back to chip IDs
  const result: Record<string, Place | null> = {};
  chipIds.forEach((chipId, index) => {
    const eventId = chipEventIds[index];
    result[chipId] = placesByEventId[eventId] || null;
  });

  return result;
}
