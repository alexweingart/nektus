/**
 * Microsoft Graph Calendar Provider for iOS
 * Adapted from: apps/web/src/client/calendar/providers/microsoft.ts
 *
 * Changes from web:
 * - Uses backend API for token refresh (no client secrets on mobile)
 */

import { getApiBaseUrl } from '../../auth/firebase';
import type { TimeSlot } from './types';

/**
 * Get busy times from Microsoft Calendar
 */
export async function getMicrosoftBusyTimes(
  accessToken: string,
  userEmail: string,
  startTime: string,
  endTime: string
): Promise<TimeSlot[]> {
  try {
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/calendar/getSchedule',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedules: [userEmail],
          startTime: {
            dateTime: startTime,
            timeZone: 'UTC',
          },
          endTime: {
            dateTime: endTime,
            timeZone: 'UTC',
          },
          availabilityViewInterval: 30, // 30-minute intervals
        }),
      }
    );

    if (!response.ok) {
      console.error(
        '[microsoft] getSchedule API error:',
        response.status,
        await response.text()
      );
      return [];
    }

    const data = await response.json();
    const busyTimes: TimeSlot[] = [];

    // Extract busy times from schedule items
    if (data.value && data.value.length > 0) {
      const scheduleItems = data.value[0].scheduleItems || [];

      for (const item of scheduleItems) {
        // Only include busy periods (not free, tentative, etc.)
        if (item.status === 'Busy' || item.status === 'Tentative') {
          busyTimes.push({
            start: item.start.dateTime,
            end: item.end.dateTime,
          });
        }
      }
    }

    console.log(`[microsoft] Found ${busyTimes.length} busy periods`);
    return busyTimes;
  } catch (error) {
    console.error('[microsoft] Error fetching busy times:', error);
    return [];
  }
}

/**
 * Refresh Microsoft access token using backend API
 * iOS cannot access client secrets directly, so we use the backend
 */
export async function refreshMicrosoftToken(refreshToken: string): Promise<{
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
        provider: 'microsoft',
        refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Microsoft token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    const expiresAt = new Date(data.expiresAt);

    return {
      accessToken: data.accessToken,
      expiresAt,
    };
  } catch (error) {
    console.error('[microsoft] Error refreshing token:', error);
    throw error;
  }
}

/**
 * Get list of user's Microsoft calendars
 */
export async function getMicrosoftCalendarList(
  accessToken: string
): Promise<Array<{
  id: string;
  name: string;
  isDefault?: boolean;
}>> {
  try {
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/calendars',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('[microsoft] calendars API error:', response.status);
      return [];
    }

    const data = await response.json();
    return (
      data.value?.map(
        (calendar: { id: string; name: string; isDefaultCalendar?: boolean }) => ({
          id: calendar.id,
          name: calendar.name,
          isDefault: calendar.isDefaultCalendar,
        })
      ) || []
    );
  } catch (error) {
    console.error('[microsoft] Error fetching calendar list:', error);
    return [];
  }
}

/**
 * Get Microsoft user profile
 */
export async function getMicrosoftUserProfile(
  accessToken: string
): Promise<{
  email: string;
  displayName: string;
} | null> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('[microsoft] profile API error:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      email: data.mail || data.userPrincipalName,
      displayName: data.displayName,
    };
  } catch (error) {
    console.error('[microsoft] Error fetching user profile:', error);
    return null;
  }
}

export default {
  getMicrosoftBusyTimes,
  refreshMicrosoftToken,
  getMicrosoftCalendarList,
  getMicrosoftUserProfile,
};
