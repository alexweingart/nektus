/**
 * Server-side calendar event creation via provider APIs.
 * Handles Google, Microsoft, and Apple CalDAV event creation + invite orchestration.
 */

import { refreshGoogleToken } from '@/client/calendar/providers/google';
import { refreshMicrosoftToken } from '@/client/calendar/providers/microsoft';
import { adminUpdateCalendarTokens } from '@/server/calendar/firebase-admin';
import { sendEventNotification } from '@/server/email/send-notification';
import { getFirebaseAdmin } from '@/server/config/firebase';
import type { Calendar, UserProfile } from '@/types';
import { getFieldValue } from '@nektus/shared-client';

// ============================================================================
// Types
// ============================================================================

export interface CalendarEventParams {
  title: string;
  description: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  timeZone: string;
  attendeeEmail?: string;
}

export interface CreateEventResult {
  eventId: string;
  eventUrl: string;
}

export interface CreateScheduledEventParams {
  organizerId: string;
  organizerProfile: UserProfile;
  attendeeId: string;
  attendeeProfile?: UserProfile;
  eventTitle: string;
  eventDescription: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  locationAddress?: string;
  timeZone: string;
  calendarSection: 'personal' | 'work';
  travelBuffer?: { beforeMinutes: number; afterMinutes: number };
}

export interface CreateScheduledEventResult {
  calendarEventId: string;
  calendarEventUrl: string;
  inviteCode: string;
  addedToRecipient: boolean;
  notificationSent: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

export function isRelayEmail(email: string): boolean {
  return email.endsWith('@privaterelay.appleid.com');
}

/**
 * Get a valid access token for a calendar, refreshing if needed.
 */
async function getValidAccessToken(
  calendar: Calendar,
  userId: string
): Promise<string | null> {
  const { accessToken, refreshToken, tokenExpiry, provider } = calendar;

  if (!accessToken) return null;

  // Check if token is expired (5-minute buffer)
  const isExpired = tokenExpiry && Date.now() >= (tokenExpiry - 5 * 60 * 1000);

  if (!isExpired) return accessToken;

  if (!refreshToken) {
    console.error(`[create-event] No refresh token for ${provider} calendar, cannot refresh`);
    return null;
  }

  try {
    if (provider === 'google') {
      const refreshed = await refreshGoogleToken(refreshToken);
      await adminUpdateCalendarTokens(userId, 'google', refreshed.accessToken, refreshed.expiresAt);
      return refreshed.accessToken;
    } else if (provider === 'microsoft') {
      const refreshed = await refreshMicrosoftToken(refreshToken);
      await adminUpdateCalendarTokens(userId, 'microsoft', refreshed.accessToken, refreshed.expiresAt);
      return refreshed.accessToken;
    } else if (provider === 'apple') {
      // CalDAV doesn't use OAuth tokens — accessToken is the app-specific password
      return accessToken;
    }
  } catch (err) {
    console.error(`[create-event] Token refresh failed for ${provider}:`, err);
  }

  return null;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================================================
// Provider API Wrappers
// ============================================================================

export async function createGoogleCalendarEvent(
  accessToken: string,
  params: CalendarEventParams,
  sendUpdates: 'all' | 'none' = 'none'
): Promise<CreateEventResult> {
  const body: Record<string, unknown> = {
    summary: params.title,
    description: params.description,
    location: params.location || '',
    start: { dateTime: params.startTime.toISOString(), timeZone: params.timeZone },
    end: { dateTime: params.endTime.toISOString(), timeZone: params.timeZone },
  };

  if (params.attendeeEmail && sendUpdates === 'all') {
    body.attendees = [{ email: params.attendeeEmail }];
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${sendUpdates}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Calendar API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    eventId: data.id,
    eventUrl: data.htmlLink,
  };
}

export async function createMicrosoftCalendarEvent(
  accessToken: string,
  params: CalendarEventParams,
  sendNotifications: boolean = false
): Promise<CreateEventResult> {
  const body: Record<string, unknown> = {
    subject: params.title,
    body: { contentType: 'text', content: params.description },
    start: { dateTime: params.startTime.toISOString(), timeZone: params.timeZone },
    end: { dateTime: params.endTime.toISOString(), timeZone: params.timeZone },
    location: { displayName: params.location || '' },
    isReminderOn: true,
  };

  if (params.attendeeEmail && sendNotifications) {
    body.attendees = [{
      emailAddress: { address: params.attendeeEmail, name: '' },
      type: 'required',
    }];
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft Graph API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    eventId: data.id,
    eventUrl: data.webLink,
  };
}

export async function createAppleCalDavEvent(
  appleId: string,
  appSpecificPassword: string,
  params: CalendarEventParams
): Promise<CreateEventResult> {
  const { DAVClient } = await import('tsdav');

  const client = new DAVClient({
    serverUrl: 'https://caldav.icloud.com',
    credentials: { username: appleId, password: appSpecificPassword },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  await client.login();
  const calendars = await client.fetchCalendars();

  // Use first writable calendar
  const target = calendars[0]; // Use first available calendar
  if (!target) throw new Error('No writable Apple calendar found');

  const uid = `${Date.now()}-${Math.random().toString(36).substring(2)}@nekt.us`;
  const dtstart = formatIcsDateTime(params.startTime);
  const dtend = formatIcsDateTime(params.endTime);

  const vcalendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nekt//Calendar//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstart}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${params.title}`,
    params.description ? `DESCRIPTION:${params.description.replace(/\n/g, '\\n')}` : '',
    params.location ? `LOCATION:${params.location}` : '',
    `ORGANIZER;CN=${appleId}:mailto:${appleId}`,
    params.attendeeEmail ? `ATTENDEE;CN=${params.attendeeEmail};RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${params.attendeeEmail}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  await client.createCalendarObject({
    calendar: target,
    filename: `${uid}.ics`,
    iCalString: vcalendar,
  });

  return {
    eventId: uid,
    eventUrl: '', // CalDAV doesn't provide web URLs
  };
}

function formatIcsDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// ============================================================================
// Update Event (for invite page PATCH flow)
// ============================================================================

export async function updateGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
  attendeeEmail: string
): Promise<void> {
  // First GET the event to get current attendees
  const getResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!getResponse.ok) {
    throw new Error(`Failed to get event: ${getResponse.status}`);
  }

  const eventData = await getResponse.json();
  const attendees = eventData.attendees || [];
  attendees.push({ email: attendeeEmail });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ attendees }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google PATCH error ${response.status}: ${text}`);
  }
}

export async function updateMicrosoftCalendarEvent(
  accessToken: string,
  eventId: string,
  attendeeEmail: string
): Promise<void> {
  // GET current event for existing attendees
  const getResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!getResponse.ok) {
    throw new Error(`Failed to get event: ${getResponse.status}`);
  }

  const eventData = await getResponse.json();
  const attendees = eventData.attendees || [];
  attendees.push({
    emailAddress: { address: attendeeEmail, name: '' },
    type: 'required',
  });

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ attendees }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft PATCH error ${response.status}: ${text}`);
  }
}

export async function updateAppleCalDavEvent(
  appleId: string,
  appSpecificPassword: string,
  eventId: string,
  attendeeEmail: string
): Promise<void> {
  const { DAVClient } = await import('tsdav');

  const client = new DAVClient({
    serverUrl: 'https://caldav.icloud.com',
    credentials: { username: appleId, password: appSpecificPassword },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  await client.login();
  const calendars = await client.fetchCalendars();

  // Search all calendars for the event
  for (const calendar of calendars) {
    const objects = await client.fetchCalendarObjects({ calendar });
    const match = objects.find(obj => obj.data?.includes(eventId));
    if (!match || !match.data) continue;

    // Add ATTENDEE line before END:VEVENT
    const attendeeLine = `ATTENDEE;CN=${attendeeEmail};RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${attendeeEmail}`;
    const updatedData = match.data.replace(
      'END:VEVENT',
      `${attendeeLine}\r\nEND:VEVENT`
    );

    await client.updateCalendarObject({
      calendarObject: { ...match, data: updatedData },
    });
    return;
  }

  throw new Error('CalDAV event not found');
}

// ============================================================================
// Orchestration: createScheduledEvent
// ============================================================================

export async function createScheduledEvent(
  params: CreateScheduledEventParams
): Promise<CreateScheduledEventResult> {
  const {
    organizerId,
    organizerProfile,
    attendeeId,
    attendeeProfile,
    eventTitle,
    eventDescription,
    startTime,
    endTime,
    location,
    locationAddress,
    timeZone,
    calendarSection,
    travelBuffer,
  } = params;

  // Find organizer's calendar for the relevant section
  const calendar = organizerProfile.calendars?.find(c => c.section === calendarSection);
  if (!calendar) {
    throw new Error('No calendar connected for this section');
  }

  if (!calendar.calendarWriteScope) {
    throw new Error('RECONNECT_REQUIRED');
  }

  // Determine Path A vs B
  const attendeeEmail = attendeeProfile
    ? (getFieldValue(attendeeProfile.contactEntries, 'email') || attendeeProfile.authEmail || '')
    : '';
  const isPathA = !!(attendeeEmail && !isRelayEmail(attendeeEmail));

  // Get valid access token
  const accessToken = await getValidAccessToken(calendar, organizerId);
  if (!accessToken) {
    throw new Error('Failed to get valid calendar access token');
  }

  // Create main event on organizer's calendar
  const eventParams: CalendarEventParams = {
    title: eventTitle,
    description: eventDescription,
    location: location || undefined,
    startTime,
    endTime,
    timeZone,
    attendeeEmail: isPathA ? attendeeEmail : undefined,
  };

  let result: CreateEventResult;
  const provider = calendar.provider;

  if (provider === 'google') {
    result = await createGoogleCalendarEvent(
      accessToken,
      eventParams,
      isPathA ? 'all' : 'none'
    );
  } else if (provider === 'microsoft') {
    result = await createMicrosoftCalendarEvent(
      accessToken,
      eventParams,
      isPathA
    );
  } else if (provider === 'apple') {
    // CalDAV: accessToken = appSpecificPassword, refreshToken = appleId
    result = await createAppleCalDavEvent(
      calendar.refreshToken || '',
      accessToken,
      eventParams
    );
  } else {
    throw new Error(`Unsupported calendar provider: ${provider}`);
  }

  // Create travel buffer blocks as separate events
  if (travelBuffer && (travelBuffer.beforeMinutes > 0 || travelBuffer.afterMinutes > 0)) {
    const placeName = location?.split(',')[0] || 'venue';

    try {
      // Before travel block
      if (travelBuffer.beforeMinutes > 0) {
        const beforeParams: CalendarEventParams = {
          title: `Travel to ${placeName}`,
          description: `Travel time for ${eventTitle}`,
          startTime: new Date(startTime.getTime() - travelBuffer.beforeMinutes * 60 * 1000),
          endTime: startTime,
          timeZone,
        };

        if (provider === 'google') {
          await createGoogleCalendarEvent(accessToken, beforeParams, 'none');
        } else if (provider === 'microsoft') {
          await createMicrosoftCalendarEvent(accessToken, beforeParams, false);
        } else if (provider === 'apple') {
          await createAppleCalDavEvent(calendar.refreshToken || '', accessToken, beforeParams);
        }
      }

      // After travel block
      if (travelBuffer.afterMinutes > 0) {
        const afterParams: CalendarEventParams = {
          title: `Travel from ${placeName}`,
          description: `Travel time for ${eventTitle}`,
          startTime: endTime,
          endTime: new Date(endTime.getTime() + travelBuffer.afterMinutes * 60 * 1000),
          timeZone,
        };

        if (provider === 'google') {
          await createGoogleCalendarEvent(accessToken, afterParams, 'none');
        } else if (provider === 'microsoft') {
          await createMicrosoftCalendarEvent(accessToken, afterParams, false);
        } else if (provider === 'apple') {
          await createAppleCalDavEvent(calendar.refreshToken || '', accessToken, afterParams);
        }
      }
    } catch (err) {
      // Travel buffer creation failure shouldn't block main event
      console.error('[create-event] Travel buffer creation failed:', err);
    }

    // Path A: also create travel blocks on attendee's calendar if connected
    if (isPathA && attendeeProfile?.calendars) {
      const attendeeCal = attendeeProfile.calendars.find(c => c.section === calendarSection);
      if (attendeeCal?.calendarWriteScope) {
        try {
          const attendeeToken = await getValidAccessToken(attendeeCal, attendeeId);
          if (attendeeToken) {
            await createTravelBlocks(attendeeCal.provider, attendeeToken, attendeeCal, {
              eventTitle, placeName, startTime, endTime, travelBuffer, timeZone,
            });
          }
        } catch (err) {
          console.error('[create-event] Attendee travel buffer creation failed:', err);
        }
      }
    }
  }

  // Generate invite code and persist to Firestore
  const inviteCode = generateInviteCode();
  const organizerName = getFieldValue(organizerProfile.contactEntries, 'name') || 'Someone';

  try {
    const { db } = await getFirebaseAdmin();
    await db.collection('invites').doc(inviteCode).set({
      calendarEventId: result.eventId,
      calendarProvider: provider,
      organizerId,
      attendeeId,
      eventDetails: {
        title: eventTitle,
        description: eventDescription,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        location: location || '',
        locationAddress: locationAddress || '',
        timeZone,
      },
      addedToRecipient: isPathA,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[create-event] Failed to save invite to Firestore:', err);
  }

  // Path B: send notification email to relay address
  let notificationSent = false;
  if (!isPathA && attendeeEmail) {
    try {
      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone,
      };
      const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone,
      };

      const dateString = startTime.toLocaleDateString('en-US', dateOptions);
      const startTimeStr = startTime.toLocaleTimeString('en-US', timeOptions);
      const endTimeStr = endTime.toLocaleTimeString('en-US', timeOptions);

      const emailResult = await sendEventNotification({
        toEmail: attendeeEmail,
        organizerName,
        organizerShortCode: organizerProfile.shortCode,
        eventTitle,
        dateString,
        timeString: startTimeStr,
        locationName: location?.split(',')[0],
        inviteCode,
      });

      notificationSent = emailResult.success;
    } catch (err) {
      console.error('[create-event] Notification email failed:', err);
    }
  }

  console.log(`[create-event] Event created: ${result.eventId} (${isPathA ? 'Path A' : 'Path B'}), invite: ${inviteCode}`);

  return {
    calendarEventId: result.eventId,
    calendarEventUrl: result.eventUrl,
    inviteCode,
    addedToRecipient: isPathA,
    notificationSent,
  };
}

/**
 * Helper to create travel buffer blocks for a specific calendar.
 */
async function createTravelBlocks(
  provider: string,
  accessToken: string,
  calendar: Calendar,
  opts: {
    eventTitle: string;
    placeName: string;
    startTime: Date;
    endTime: Date;
    travelBuffer: { beforeMinutes: number; afterMinutes: number };
    timeZone: string;
  }
) {
  const { eventTitle, placeName, startTime, endTime, travelBuffer, timeZone } = opts;

  if (travelBuffer.beforeMinutes > 0) {
    const beforeParams: CalendarEventParams = {
      title: `Travel to ${placeName}`,
      description: `Travel time for ${eventTitle}`,
      startTime: new Date(startTime.getTime() - travelBuffer.beforeMinutes * 60 * 1000),
      endTime: startTime,
      timeZone,
    };

    if (provider === 'google') {
      await createGoogleCalendarEvent(accessToken, beforeParams, 'none');
    } else if (provider === 'microsoft') {
      await createMicrosoftCalendarEvent(accessToken, beforeParams, false);
    } else if (provider === 'apple') {
      await createAppleCalDavEvent(calendar.refreshToken || '', accessToken, beforeParams);
    }
  }

  if (travelBuffer.afterMinutes > 0) {
    const afterParams: CalendarEventParams = {
      title: `Travel from ${placeName}`,
      description: `Travel time for ${eventTitle}`,
      startTime: endTime,
      endTime: new Date(endTime.getTime() + travelBuffer.afterMinutes * 60 * 1000),
      timeZone,
    };

    if (provider === 'google') {
      await createGoogleCalendarEvent(accessToken, afterParams, 'none');
    } else if (provider === 'microsoft') {
      await createMicrosoftCalendarEvent(accessToken, afterParams, false);
    } else if (provider === 'apple') {
      await createAppleCalDavEvent(calendar.refreshToken || '', accessToken, afterParams);
    }
  }
}
