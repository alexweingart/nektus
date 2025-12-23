import { getCurrentTimeInUserTimezone } from './time-utils';
import { getEventTimeFromSlotWithBuffer } from './event-templates';
import { getFieldValue } from '../utils/profileTransforms';
import type { Event, SchedulableHours, EventTemplate, UserProfile, TimeSlot } from '@/types';
import type { Place } from '@/types/places';

export interface CalendarEvent {
  title: string;
  description?: string;
  location: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
}

export interface CalendarUrls {
  google: string;
  outlook: string;
  apple: string;
}

/**
 * Generate calendar URLs for all major platforms
 */
export function generateCalendarUrls(event: CalendarEvent): CalendarUrls {
  return {
    google: generateGoogleCalendarUrl(event),
    outlook: generateOutlookCalendarUrl(event),
    apple: generateIcsUrl(event),
  };
}

/**
 * Generate Google Calendar URL
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const baseUrl = 'https://calendar.google.com/calendar/render';

  const startFormatted = formatDateTimeForGoogle(event.startTime);
  const endFormatted = formatDateTimeForGoogle(event.endTime);

  console.log('Google Calendar URL generation:');
  console.log('  Start time (Date):', event.startTime);
  console.log('  Start formatted:', startFormatted);
  console.log('  End time (Date):', event.endTime);
  console.log('  End formatted:', endFormatted);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startFormatted}/${endFormatted}`,
    location: event.location,
    details: event.description || '',
  });

  if (event.attendees && event.attendees.length > 0) {
    params.append('add', event.attendees.join(','));
  }

  const url = `${baseUrl}?${params.toString()}`;
  console.log('  Final URL:', url);

  return url;
}

/**
 * Generate Outlook/Office365 calendar URL
 */
export function generateOutlookCalendarUrl(event: CalendarEvent): string {
  const baseUrl = 'https://outlook.live.com/calendar/0/deeplink/compose';

  const params = new URLSearchParams({
    subject: event.title,
    startdt: event.startTime.toISOString(),
    enddt: event.endTime.toISOString(),
    location: event.location,
    body: event.description || '',
    path: '/calendar/action/compose',
    rru: 'addevent',
  });

  if (event.attendees && event.attendees.length > 0) {
    params.append('to', event.attendees.join(';'));
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate ICS file content for Apple Calendar and other calendar apps
 */
export function generateIcsContent(event: CalendarEvent, userTimezone?: string): string {
  const now = userTimezone ?
    getCurrentTimeInUserTimezone(userTimezone) :
    new Date();
  const uid = generateUid();

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CalConnect//CalConnect//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDateTimeForIcs(now)}`,
    `DTSTART:${formatDateTimeForIcs(event.startTime)}`,
    `DTEND:${formatDateTimeForIcs(event.endTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeIcsText(event.description)}` : '',
    `LOCATION:${escapeIcsText(event.location)}`,
  ];

  // Add attendees if present
  if (event.attendees && event.attendees.length > 0) {
    for (const attendee of event.attendees) {
      icsLines.push(`ATTENDEE:mailto:${attendee}`);
    }
  }

  icsLines.push(
    'STATUS:TENTATIVE',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  const icsContent = icsLines.filter(line => line !== '').join('\r\n');

  return icsContent;
}

/**
 * Generate data URL for ICS file download
 */
export function generateIcsUrl(event: CalendarEvent): string {
  const icsContent = generateIcsContent(event);
  const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

  return dataUrl;
}

/**
 * Download ICS file to user's device
 */
export function downloadICSFile(icsContent: string, filename: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format datetime for Google Calendar and ICS files (YYYYMMDDTHHMMSSZ format)
 */
function formatDateTimeForGoogle(date: Date): string {
  // Use local timezone instead of UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

// Alias for ICS format (same as Google format)
const formatDateTimeForIcs = formatDateTimeForGoogle;

/**
 * Escape text for ICS format
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Generate unique ID for calendar events
 */
function generateUid(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2);
  return `${timestamp}-${randomStr}@calconnect.app`;
}

/**
 * Unified function to create complete calendar event with formatted title and URLs
 * Takes a complete Event object with times already calculated
 */
export function createCompleteCalendarEvent(
  event: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    eventType: 'video' | 'in-person';
    travelBuffer?: { beforeMinutes: number; afterMinutes: number };
    preferredPlaces?: Place[];
  },
  otherUser: { email: string },
  _currentUser?: { displayName?: string },
  timezone?: string
): {
  formattedTitle: string;
  description: string;
  calendar_urls: CalendarUrls;
} {
  // 1. Format title with "• Starts at" for in-person events with travel buffer
  let formattedTitle = event.title;
  if (event.eventType === 'in-person' && event.travelBuffer) {
    // Calculate actual meeting start (after travel buffer)
    const actualMeetingStart = new Date(event.startTime.getTime() + event.travelBuffer.beforeMinutes * 60 * 1000);
    // Use local timezone if no timezone specified
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      ...(timezone && { timeZone: timezone })
    };
    const startTimeString = actualMeetingStart.toLocaleTimeString('en-US', timeOptions);
    formattedTitle += ` • Starts at ${startTimeString}`;
  }

  // 2. Use existing description or create a basic one
  const description = event.description || 'Meeting scheduled via CalConnect';

  // 3. Format location (use place name if available, otherwise location string)
  const location = event.location || '';
  const place = event.preferredPlaces?.[0];
  const formattedLocation = place ? place.name : location;

  // 4. Create calendar event object
  const calendarEvent: CalendarEvent = {
    title: formattedTitle,
    description,
    startTime: event.startTime,
    endTime: event.endTime,
    location: formattedLocation,
    attendees: [otherUser.email]
  };

  // 5. Generate all calendar URLs
  const calendar_urls = generateCalendarUrls(calendarEvent);

  return {
    formattedTitle,
    description,
    calendar_urls
  };
}

/**
 * Calculate calendar block times with travel buffers
 * Returns times for calendar blocking (actual event time + travel buffers)
 */
export function calculateCalendarBlockTimes(
  eventStartTime: Date,
  eventEndTime: Date,
  travelBuffer?: { beforeMinutes: number; afterMinutes: number }
): { calendarBlockStart: Date; calendarBlockEnd: Date } {
  const calendarBlockStart = new Date(eventStartTime);
  if (travelBuffer?.beforeMinutes) {
    calendarBlockStart.setMinutes(calendarBlockStart.getMinutes() - travelBuffer.beforeMinutes);
  }

  const calendarBlockEnd = new Date(eventEndTime);
  if (travelBuffer?.afterMinutes) {
    calendarBlockEnd.setMinutes(calendarBlockEnd.getMinutes() + travelBuffer.afterMinutes);
  }

  return { calendarBlockStart, calendarBlockEnd };
}

/**
 * Apply default travel buffer to in-person events if not already set
 */
export function applyDefaultTravelBuffer(eventTemplate: Partial<Event>): Partial<Event> {
  if (eventTemplate.eventType === 'in-person' && !eventTemplate.travelBuffer) {
    return {
      ...eventTemplate,
      travelBuffer: {
        beforeMinutes: 30,
        afterMinutes: 30
      }
    };
  }
  return eventTemplate;
}

/**
 * Create description with travel buffer information for in-person events
 */
export function createTravelBufferDescription(
  originalDescription: string,
  eventResult: { place?: Place; startTime?: string },
  eventTemplate: Partial<Event>,
  timezone?: string
): string {
  if (eventTemplate.eventType !== 'in-person' || !eventTemplate.travelBuffer || !eventResult.startTime) {
    return originalDescription;
  }

  // eventResult.startTime is ALREADY the correct event start time (buffer applied during slot generation)
  const actualStart = new Date(eventResult.startTime);
  const actualEnd = new Date(actualStart.getTime() + (eventTemplate.duration || 60) * 60 * 1000);

  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone || 'UTC' };
  const startTimeStr = actualStart.toLocaleTimeString('en-US', timeOptions);
  const endTimeStr = actualEnd.toLocaleTimeString('en-US', timeOptions);
  const placeName = eventResult.place?.name || 'the venue';

  return `Meeting time: ${startTimeStr} - ${endTimeStr}\nIncludes ${eventTemplate.travelBuffer.beforeMinutes} min of travel time to ${placeName} and ${eventTemplate.travelBuffer.afterMinutes} min back`;
}

/**
 * Build final event object with all required fields
 * Used by AI scheduling to construct the complete Event object
 */
export function buildFinalEvent(
  organizerId: string,
  attendeeId: string,
  eventResult: { title: string; startTime: string; endTime: string; place?: Place },
  template: Partial<Event>,
  finalDescription: string,
  locationString: string,
  calendar_urls: { google: string; outlook: string; apple: string }
): Event {
  const finalEvent: Event = {
    id: `temp-${Date.now()}`,
    organizerId,
    attendeeId,
    title: eventResult.title,
    description: finalDescription,
    duration: template.duration || 60,
    eventType: template.eventType || 'video',
    intent: template.intent || 'custom',
    startTime: new Date(eventResult.startTime),
    endTime: new Date(eventResult.endTime),
    location: locationString,
    travelBuffer: template.travelBuffer,
    calendar_urls: {
      google: calendar_urls.google,
      outlook: calendar_urls.outlook,
      apple: calendar_urls.apple,
    },
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date(),
    preferredPlaces: eventResult.place ? [eventResult.place] : undefined,
  };

  return finalEvent;
}

/**
 * Determine which alternatives to show based on user constraints and validity
 *
 * Logic:
 * - If time is invalid (conflict): ALWAYS show time alternatives + warning
 * - If both date/time AND place constrained + valid: show nothing
 * - If date/time constrained + valid: show place alternatives
 * - If place constrained + valid: show time alternatives
 * - If neither constrained: show place alternatives (default)
 */
export function determineAlternativesToShow(
  template: Partial<Event> & {
    preferredSchedulableDates?: { startDate: string; endDate: string; description?: string };
    preferredSchedulableHours?: Partial<SchedulableHours>;
    hasExplicitTimeRequest?: boolean;
    intentSpecificity?: string;
    intent?: string;
  },
  hasValidTime: boolean,
  editResult?: {
    timePreference?: 'earlier' | 'later' | 'specific';
    newPlaceType?: string;
    newPlaceIndex?: number;
  }
): {
  showAlternativePlaces: boolean;
  showAlternativeTimes: boolean;
  includeConflictWarning: boolean;
  reason: string;
} {
  // Detect date/time constraints (EXPLICIT ONLY - user actually specified a time)
  // Don't count preferredSchedulableHours (implicit from activity type like "dinner")
  const hasDateTimeConstraint = !!(
    template.preferredSchedulableDates ||
    template.hasExplicitTimeRequest ||
    editResult?.timePreference
  );

  // Detect place constraints (NARROW - only explicit venue requests)
  const hasPlaceConstraint = !!(
    template.intentSpecificity === 'specific_place' ||
    editResult?.newPlaceType ||
    editResult?.newPlaceIndex ||
    (template.intent && /at .+? (park|cafe|restaurant|gym|court)/i.test(template.intent) && !/at a /i.test(template.intent))
  );

  console.log(`📊 Alternative determination:`, {
    hasDateTimeConstraint,
    hasPlaceConstraint,
    hasValidTime,
    dateInfo: template.preferredSchedulableDates?.description,
    placeInfo: template.intentSpecificity
  });

  // Rule 1: If time is invalid (conflict), ALWAYS show time alternatives + warning
  if (!hasValidTime) {
    return {
      showAlternativePlaces: false,
      showAlternativeTimes: true,
      includeConflictWarning: true,
      reason: 'conflict-show-time-alternatives'
    };
  }

  // Rule 2: Both date/time AND place specified + valid → show nothing
  if (hasDateTimeConstraint && hasPlaceConstraint) {
    return {
      showAlternativePlaces: false,
      showAlternativeTimes: false,
      includeConflictWarning: false,
      reason: 'both-specified-valid'
    };
  }

  // Rule 3: Date/time specified + valid → show place alternatives
  if (hasDateTimeConstraint) {
    return {
      showAlternativePlaces: true,
      showAlternativeTimes: false,
      includeConflictWarning: false,
      reason: 'time-fixed-show-places'
    };
  }

  // Rule 4: Place specified + valid → show time alternatives
  if (hasPlaceConstraint) {
    return {
      showAlternativePlaces: false,
      showAlternativeTimes: true,
      includeConflictWarning: false,
      reason: 'place-fixed-show-times'
    };
  }

  // Rule 5: Default (neither specified) → show place alternatives
  return {
    showAlternativePlaces: true,
    showAlternativeTimes: false,
    includeConflictWarning: false,
    reason: 'default-show-places'
  };
}

// Legacy function names for backward compatibility
export const formatDateForGoogle = formatDateTimeForGoogle;
export const generateICSContent = generateIcsContent;

/**
 * Format event name based on intent and event type
 */
export function formatEventName(
  intent: string,
  contactName: string,
  userName?: string,
  eventType?: string
): string {
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
}

/**
 * Generate event description with travel buffer information and Nekt branding
 */
export function generateEventDescription(
  contactName: string,
  eventTemplate?: EventTemplate,
  actualStart?: Date,
  actualEnd?: Date,
  videoPlatform?: string,
  organizerName?: string,
  placeName?: string,
  currentUserId?: string
): string {
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
}

/**
 * Compose and open a calendar event or download ICS file
 */
export async function composeAndOpenCalendarEvent(params: {
  slot: TimeSlot;
  eventTemplate: EventTemplate;
  place: Place | null;
  currentUserProfile: UserProfile;
  contactProfile: UserProfile;
  section: 'personal' | 'work';
  currentUserId: string;
}): Promise<void> {
  const { slot, eventTemplate, place, currentUserProfile, contactProfile, section, currentUserId } = params;

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
  const contactName = getFieldValue(contactProfile.contactEntries, 'name');

  // Get current user's calendar for this section
  const currentUserCalendar = currentUserProfile.calendars?.find(cal => cal.section === section);

  if (!currentUserCalendar) {
    alert('Please add a calendar for this profile type in your settings');
    return;
  }

  // Get contact's calendar email if they have one, otherwise use their profile email
  const contactCalendar = contactProfile.calendars?.find(cal => cal.section === section);
  const contactEmail = contactCalendar?.email || getFieldValue(contactProfile.contactEntries, 'email');

  const eventName = formatEventName(eventTemplate.intent, contactName, currentUserName, eventTemplate.eventType);
  const eventDescription = generateEventDescription(
    contactName,
    eventTemplate,
    actualMeetingStart,
    actualMeetingEnd,
    'Google Meet',
    currentUserName,
    place?.name,
    currentUserId
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
    contactForCalendar,
    { displayName }
  );

  // Determine preferred provider from user's calendars
  let preferredProvider = 'google';
  if (currentUserCalendar) {
    preferredProvider = currentUserCalendar.provider;
  }

  // Open calendar or download ICS
  if (preferredProvider === 'apple') {
    const calendarEvent = {
      title: formattedTitle,
      description: event.description,
      location: event.location || '',
      startTime: event.startTime,
      endTime: event.endTime,
      attendees: [contactEmail]
    };
    const icsContent = generateIcsContent(calendarEvent);
    const filename = `${formattedTitle.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    downloadICSFile(icsContent, filename);
  } else {
    const calendarUrl = preferredProvider === 'microsoft' ? calendar_urls.outlook : calendar_urls.google;
    window.open(calendarUrl, '_blank');
  }
}