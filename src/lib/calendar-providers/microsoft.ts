// Microsoft Graph Provider

import { TimeSlot } from '@/types';

export async function getMicrosoftBusyTimes(
  accessToken: string,
  userEmail: string,
  startTime: string,
  endTime: string
): Promise<TimeSlot[]> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
    });

    if (!response.ok) {
      console.error('Microsoft Graph getSchedule API error:', response.status, await response.text());
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

    console.log(`Microsoft Graph: Found ${busyTimes.length} busy periods`);
    return busyTimes;
  } catch (error) {
    console.error('Error fetching Microsoft busy times:', error);
    return [];
  }
}

export async function refreshMicrosoftToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  try {
    // Note: This uses the client credentials from your existing OAuth setup
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        scope: 'https://graph.microsoft.com/Calendars.Read',
      }),
    });

    if (!response.ok) {
      throw new Error(`Microsoft token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  } catch (error) {
    console.error('Error refreshing Microsoft token:', error);
    throw error;
  }
}

export async function getMicrosoftCalendarList(accessToken: string): Promise<Array<{
  id: string;
  name: string;
  isDefault?: boolean;
}>> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Microsoft Graph calendars API error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.value?.map((calendar: { id: string; name: string; isDefaultCalendar?: boolean }) => ({
      id: calendar.id,
      name: calendar.name,
      isDefault: calendar.isDefaultCalendar,
    })) || [];
  } catch (error) {
    console.error('Error fetching Microsoft calendar list:', error);
    return [];
  }
}

export async function getMicrosoftUserProfile(accessToken: string): Promise<{
  email: string;
  displayName: string;
} | null> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Microsoft Graph profile API error:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      email: data.mail || data.userPrincipalName,
      displayName: data.displayName,
    };
  } catch (error) {
    console.error('Error fetching Microsoft user profile:', error);
    return null;
  }
}