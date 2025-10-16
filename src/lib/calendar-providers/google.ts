// Google Calendar Provider

import { TimeSlot } from '@/types';

export async function getGoogleBusyTimes(
  accessToken: string,
  startTime: string,
  endTime: string,
  calendars: string[] = ['primary']
): Promise<TimeSlot[]> {
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: startTime,
        timeMax: endTime,
        items: calendars.map(id => ({ id })),
        timeZone: 'UTC',
      }),
    });

    if (!response.ok) {
      console.error('Google freeBusy API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    const busyTimes: TimeSlot[] = [];

    // Extract busy times from all calendars
    for (const calendar of calendars) {
      const calendarData = data.calendars?.[calendar];
      if (calendarData?.busy) {
        for (const busyPeriod of calendarData.busy) {
          busyTimes.push({
            start: busyPeriod.start,
            end: busyPeriod.end,
          });
        }
      }
    }

    console.log(`Google Calendar: Found ${busyTimes.length} busy periods`);

    // Log first 5 busy times for debugging (with timezone info)
    if (busyTimes.length > 0) {
      console.log('📅 Sample busy times (first 5):');
      busyTimes.slice(0, 5).forEach((slot, idx) => {
        const start = new Date(slot.start);
        const end = new Date(slot.end);
        console.log(`  ${idx + 1}. ${start.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' })} - ${end.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeStyle: 'short' })}`);
      });
    }

    return busyTimes;
  } catch (error) {
    console.error('Error fetching Google busy times:', error);
    return [];
  }
}

export async function refreshGoogleToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  } catch (error) {
    console.error('Error refreshing Google token:', error);
    throw error;
  }
}

interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
  description?: string;
  eventType?: 'video' | 'in-person';
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const url = new URL('https://calendar.google.com/calendar/render');

  url.searchParams.append('action', 'TEMPLATE');
  url.searchParams.append('text', event.title);

  // Convert ISO dates to Google Calendar format (YYYYMMDDTHHMMSSZ)
  const formatDateForGoogle = (isoDate: string) => {
    return new Date(isoDate).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const startFormatted = formatDateForGoogle(event.start);
  const endFormatted = formatDateForGoogle(event.end);
  url.searchParams.append('dates', `${startFormatted}/${endFormatted}`);

  if (event.location) {
    url.searchParams.append('location', event.location);
  }

  if (event.attendees && event.attendees.length > 0) {
    url.searchParams.append('add', event.attendees.join(','));
  }

  // Add standard reminder guidance to description since Google Calendar web deep-link can't set reminders
  let description = event.description || '';

  const reminderText = '📅 Reminder: Set a 10-minute reminder for this event.';
  description = description ? `${description}\n\n${reminderText}` : reminderText;

  if (description) {
    url.searchParams.append('details', description);
  }

  return url.toString();
}

export async function getGoogleCalendarList(accessToken: string): Promise<Array<{
  id: string;
  summary: string;
  primary?: boolean;
}>> {
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Google calendar list API error:', response.status);
      return [];
    }

    const data = await response.json();
    // Filter to only show "My calendars" (calendars the user owns)
    return data.items?.filter((item: { accessRole: string }) =>
      item.accessRole === 'owner'
    ).map((item: { id: string; summary: string; primary?: boolean }) => ({
      id: item.id,
      summary: item.summary,
      primary: item.primary,
    })) || [];
  } catch (error) {
    console.error('Error fetching Google calendar list:', error);
    return [];
  }
}