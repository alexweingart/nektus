/**
 * EventKit helper utilities shared across scheduling views.
 */

import type { UserProfile } from '@nektus/shared-types';
import { isEventKitAvailable, getDeviceBusyTimes } from './eventkit-service';

/**
 * If the current user has an EventKit calendar,
 * read device busy times and return them for the scheduling API call.
 */
export async function getEventKitBusyTimesForProfile(
  profile: UserProfile | null
): Promise<{ user1BusyTimes: { start: string; end: string }[] } | {}> {
  if (!isEventKitAvailable() || !profile) return {};

  const calendar = profile.calendars?.find(
    (cal) => cal.accessMethod === 'eventkit'
  );
  if (!calendar) return {};

  try {
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const busyTimes = await getDeviceBusyTimes(now, twoWeeksOut);
    return { user1BusyTimes: busyTimes };
  } catch (error) {
    console.warn('[EventKit] Failed to get busy times (permission not granted?):', error);
    return {};
  }
}
