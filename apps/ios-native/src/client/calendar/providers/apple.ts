/**
 * Apple Calendar Provider for iOS
 * Adapted from: apps/web/src/client/calendar/providers/apple.ts
 *
 * Uses backend CalDAV API for iCloud calendar read/write.
 */

import { getApiBaseUrl } from '../../auth/firebase';
import { Linking } from 'react-native';
import type { TimeSlot, CalendarEvent } from './types';

// Notification time in minutes before event
const NOTIFICATION_MINUTES = 10;

/**
 * Get busy times from Apple Calendar via backend CalDAV
 */
export async function getAppleBusyTimes(
  appleId: string,
  appSpecificPassword: string,
  startTime: string,
  endTime: string
): Promise<TimeSlot[]> {
  try {
    console.log(`[apple] Fetching busy times for ${appleId}`);

    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/calendar/apple/busy-times`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appleId,
        appSpecificPassword,
        startTime,
        endTime,
      }),
    });

    if (!response.ok) {
      console.error('[apple] Busy times API error:', response.status);
      return [];
    }

    const data = await response.json();
    console.log(`[apple] Found ${data.busyTimes?.length || 0} busy periods`);
    return data.busyTimes || [];
  } catch (error) {
    console.error('[apple] Error fetching busy times:', error);
    return [];
  }
}

/**
 * Test Apple iCloud connection
 */
export async function testAppleConnection(
  appleId: string,
  appSpecificPassword: string
): Promise<boolean> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/calendar/apple/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appleId,
        appSpecificPassword,
      }),
    });

    if (!response.ok) {
      console.error('[apple] Connection test failed:', response.status);
      return false;
    }

    const data = await response.json();
    console.log(`[apple] Connection test successful: ${data.success}`);
    return data.success;
  } catch (error) {
    console.error('[apple] Connection test error:', error);
    return false;
  }
}

/**
 * Get list of Apple calendars
 */
export async function getAppleCalendarList(
  appleId: string,
  appSpecificPassword: string
): Promise<Array<{
  url: string;
  displayName: string;
}>> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/calendar/apple/calendars`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appleId,
        appSpecificPassword,
      }),
    });

    if (!response.ok) {
      console.error('[apple] Calendar list API error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.calendars || [];
  } catch (error) {
    console.error('[apple] Error fetching calendar list:', error);
    return [];
  }
}

/**
 * Format date for iCalendar format
 */
function formatDateForICal(isoDate: string): string {
  return new Date(isoDate)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Generate ICS file content for Apple Calendar
 */
export function generateAppleCalendarFile(event: CalendarEvent): string {
  const startFormatted = formatDateForICal(event.start);
  const endFormatted = formatDateForICal(event.end);
  const uid = `${Date.now()}@nektus.app`;
  const now = formatDateForICal(new Date().toISOString());

  let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nektus//Nektus Event//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTART:${startFormatted}
DTEND:${endFormatted}
SUMMARY:${event.title}`;

  if (event.description) {
    // Escape special characters for iCal format
    const escapedDescription = event.description
      .replace(/[,;\\]/g, '\\$&')
      .replace(/\n/g, '\\n');
    icsContent += `\nDESCRIPTION:${escapedDescription}`;
  }

  if (event.location) {
    icsContent += `\nLOCATION:${event.location}`;
  }

  if (event.attendees && event.attendees.length > 0) {
    for (const attendee of event.attendees) {
      icsContent += `\nATTENDEE:mailto:${attendee}`;
    }
  }

  // Add VALARM for notification
  icsContent += `\nBEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Event reminder
TRIGGER:-PT${NOTIFICATION_MINUTES}M
END:VALARM`;

  icsContent += `\nSTATUS:CONFIRMED
SEQUENCE:0
CREATED:${now}
LAST-MODIFIED:${now}
DTSTAMP:${now}
END:VEVENT
END:VCALENDAR`;

  return icsContent;
}

/**
 * Open an ICS file in the native calendar app
 * Creates a data URL and opens it with the system handler
 */
export async function openCalendarEvent(event: CalendarEvent): Promise<boolean> {
  try {
    const icsContent = generateAppleCalendarFile(event);

    // Create a data URL for the ICS content
    const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

    // Check if we can open the URL
    const canOpen = await Linking.canOpenURL(dataUrl);
    if (canOpen) {
      await Linking.openURL(dataUrl);
      return true;
    }

    // Fallback: try webcal scheme
    const webcalUrl = `webcal://data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
    const canOpenWebcal = await Linking.canOpenURL(webcalUrl);
    if (canOpenWebcal) {
      await Linking.openURL(webcalUrl);
      return true;
    }

    console.warn('[apple] Cannot open calendar event');
    return false;
  } catch (error) {
    console.error('[apple] Error opening calendar event:', error);
    return false;
  }
}

export default {
  getAppleBusyTimes,
  testAppleConnection,
  getAppleCalendarList,
  generateAppleCalendarFile,
  openCalendarEvent,
};
