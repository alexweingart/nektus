/**
 * EventKit Service - iOS device calendar integration via expo-calendar
 *
 * Lazy-loads expo-calendar to gracefully handle App Clip where the native
 * module is excluded. Provides permission handling and busy time extraction
 * from all calendars synced to the device.
 */

import { Linking, NativeModules } from 'react-native';
import type { TimeSlot } from '@nektus/shared-types';

// Lazy-load expo-calendar (same pattern as expo-web-browser in AddCalendarModal)
let ExpoCalendar: typeof import('expo-calendar') | null = null;
try {
  ExpoCalendar = require('expo-calendar');
  console.log('[EventKit] expo-calendar loaded successfully');
} catch (e) {
  console.log('[EventKit] expo-calendar not available:', e);
  // expo-calendar native module not available (App Clip)
}

/** Check if the EventKit native module is available (not available in App Clip) */
export function isEventKitAvailable(): boolean {
  return ExpoCalendar !== null;
}

/** Request calendar read permission. Returns true if granted. */
export async function requestCalendarPermission(): Promise<boolean> {
  if (!ExpoCalendar) return false;

  const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Read ALL device calendars and return busy time slots for the given range.
 * Filters out events marked as "free" (availability !== 'free').
 */
export async function getDeviceBusyTimes(
  startDate: Date,
  endDate: Date
): Promise<TimeSlot[]> {
  if (!ExpoCalendar) return [];

  // Get all calendars on the device
  const calendars = await ExpoCalendar.getCalendarsAsync(
    ExpoCalendar.EntityTypes.EVENT
  );

  if (calendars.length === 0) return [];

  const calendarIds = calendars.map((cal) => cal.id);

  // Fetch events from all calendars in the date range
  const events = await ExpoCalendar.getEventsAsync(
    calendarIds,
    startDate,
    endDate
  );

  // Filter to busy events (exclude all-day events and free events)
  const busyTimes: TimeSlot[] = [];
  for (const event of events) {
    if (event.allDay) continue;
    if (event.availability === 'free') continue;

    busyTimes.push({
      start: new Date(event.startDate).toISOString(),
      end: new Date(event.endDate).toISOString(),
    });
  }

  return busyTimes;
}

/**
 * Create a calendar event on the device via EventKit.
 * Picks the default writable calendar (primary, or first writable as fallback).
 * Returns the created event ID.
 */
export async function createCalendarEvent(params: {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
}): Promise<string> {
  if (!ExpoCalendar) throw new Error('expo-calendar not available');

  const calendars = await ExpoCalendar.getCalendarsAsync(
    ExpoCalendar.EntityTypes.EVENT
  );

  // Find a writable calendar: prefer primary, then local account default, then first writable
  const writable = calendars.filter(
    (cal) => cal.allowsModifications !== false
  );
  if (writable.length === 0) throw new Error('No writable calendars found');

  const target =
    writable.find((cal) => cal.isPrimary) ||
    writable.find((cal) => cal.source?.isLocalAccount) ||
    writable[0];

  const eventId = await ExpoCalendar.createEventAsync(target.id, {
    title: params.title,
    startDate: params.startDate,
    endDate: params.endDate,
    location: params.location,
    notes: params.notes,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  console.log(`[EventKit] Created event ${eventId} in calendar "${target.title}"`);
  return eventId;
}

/**
 * Present the native iOS event detail view for a created event.
 * Falls back to opening the Calendar app at the event's date if the native viewer is unavailable.
 */
export async function openEventInCalendar(eventId: string, fallbackDate: Date): Promise<void> {
  try {
    await NativeModules.EventKitViewer.presentEvent(eventId);
  } catch (error) {
    console.warn('[EventKit] Native event viewer unavailable, falling back to calshow:', error);
    const nsDateTimestamp = fallbackDate.getTime() / 1000 - 978307200;
    Linking.openURL(`calshow:${nsDateTimestamp}`);
  }
}
