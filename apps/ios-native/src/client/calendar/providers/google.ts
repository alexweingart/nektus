/**
 * Google Calendar Provider for iOS
 * Adapted from: apps/web/src/client/calendar/providers/google.ts
 *
 * Changes from web:
 * - Uses getApiBaseUrl() for token refresh endpoint
 * - No process.env access (uses API for token refresh)
 */

import { getApiBaseUrl } from '../../auth/firebase';
import type { TimeSlot } from './types';

export type { TimeSlot };

/**
 * Get busy times from Google Calendar
 */
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
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: startTime,
        timeMax: endTime,
        items: calendars.map((id) => ({ id })),
        timeZone: 'UTC',
      }),
    });

    if (!response.ok) {
      console.error('[google] freeBusy API error:', response.status, await response.text());
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

    console.log(`[google] Found ${busyTimes.length} busy periods`);

    return busyTimes;
  } catch (error) {
    console.error('[google] Error fetching busy times:', error);
    return [];
  }
}

/**
 * Refresh Google access token using backend API
 * iOS cannot access client secrets directly, so we use the backend
 */
export async function refreshGoogleToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/calendar/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'google',
        refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    const expiresAt = new Date(data.expiresAt);

    return {
      accessToken: data.accessToken,
      expiresAt,
    };
  } catch (error) {
    console.error('[google] Error refreshing token:', error);
    throw error;
  }
}

/**
 * Get list of user's Google calendars
 */
export async function getGoogleCalendarList(
  accessToken: string
): Promise<Array<{
  id: string;
  summary: string;
  primary?: boolean;
}>> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('[google] Calendar list API error:', response.status);
      return [];
    }

    const data = await response.json();
    // Filter to only show "My calendars" (calendars the user owns)
    return (
      data.items
        ?.filter((item: { accessRole: string }) => item.accessRole === 'owner')
        .map((item: { id: string; summary: string; primary?: boolean }) => ({
          id: item.id,
          summary: item.summary,
          primary: item.primary,
        })) || []
    );
  } catch (error) {
    console.error('[google] Error fetching calendar list:', error);
    return [];
  }
}

export default {
  getGoogleBusyTimes,
  refreshGoogleToken,
  getGoogleCalendarList,
};
