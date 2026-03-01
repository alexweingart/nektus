/**
 * Mobile Calendar OAuth Exchange
 * Handles calendar connection from iOS app using Firebase Bearer token auth
 * (same pattern as /api/contacts/route.ts)
 *
 * Supports:
 * - Google Calendar: exchanges auth code for tokens
 * - Microsoft Calendar: exchanges auth code for tokens
 * - Apple Calendar: tests CalDAV credentials and saves
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/server/config/firebase';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { encryptCalendarTokens } from '@/client/calendar/providers/tokens';
import { Calendar } from '@/types/profile';
import { WORK_SCHEDULABLE_HOURS, PERSONAL_SCHEDULABLE_HOURS } from '@/shared/constants';

// Force Node.js runtime for tsdav library (Apple CalDAV)
export const runtime = 'nodejs';

/**
 * Verify Firebase Bearer token and return user ID
 */
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const { auth } = await getFirebaseAdmin();
    const idToken = authHeader.replace('Bearer ', '');

    if (!idToken || idToken === 'null' || idToken === 'undefined') {
      return null;
    }

    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    console.error('[mobile-token] Bearer token verification failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, userEmail } = body;
    const section = body.section as 'personal' | 'work';

    if (!provider || !section) {
      return NextResponse.json(
        { error: 'Missing required parameters: provider, section' },
        { status: 400 }
      );
    }

    // Get current profile
    const profile = await AdminProfileService.getProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if calendar already exists for this section
    const existingCalendar = profile.calendars?.find(cal => cal.section === section);
    if (existingCalendar) {
      return NextResponse.json(
        { error: 'Calendar already exists for this section' },
        { status: 400 }
      );
    }

    let newCalendar: Calendar;

    if (provider === 'apple') {
      // Apple CalDAV flow
      const { appleId, appSpecificPassword } = body;
      if (!appleId || !appSpecificPassword) {
        return NextResponse.json(
          { error: 'Missing required parameters: appleId, appSpecificPassword' },
          { status: 400 }
        );
      }

      const { testAppleConnection } = await import('@/client/calendar/providers/apple');
      const connectionTest = await testAppleConnection(appleId, appSpecificPassword);
      if (!connectionTest) {
        return NextResponse.json(
          { error: 'Failed to connect to Apple CalDAV. Please check your credentials.' },
          { status: 401 }
        );
      }

      console.log(`[mobile-token] Apple CalDAV connection verified for ${appleId}`);

      const encryptedTokens = await encryptCalendarTokens({
        accessToken: appSpecificPassword,
        refreshToken: appleId,
        tokenExpiry: 0,
      });

      newCalendar = {
        id: `${userId}_${section}_apple`,
        userId,
        provider: 'apple',
        email: appleId,
        section,
        schedulableHours: section === 'work' ? WORK_SCHEDULABLE_HOURS : PERSONAL_SCHEDULABLE_HOURS,
        accessToken: encryptedTokens.accessToken,
        refreshToken: encryptedTokens.refreshToken,
        tokenExpiry: 0,
        connectionStatus: 'connected',
        accessMethod: 'caldav',
        calendarWriteScope: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else if (provider === 'google' || provider === 'microsoft') {
      // OAuth code exchange flow
      const { code, redirectUri } = body;
      if (!code || !redirectUri) {
        return NextResponse.json(
          { error: 'Missing required parameters: code, redirectUri' },
          { status: 400 }
        );
      }

      let tokenData: { access_token: string; refresh_token?: string; expires_in: number };
      let calendarEmail = userEmail || '';

      if (provider === 'google') {
        // Support iOS native OAuth (uses iOS client ID, no client_secret needed)
        const useIosClientId = body.useIosClientId === 'true';
        const googleClientId = useIosClientId
          ? process.env.GOOGLE_IOS_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID!
          : process.env.GOOGLE_CALENDAR_CLIENT_ID!;

        const tokenParams: Record<string, string> = {
          code,
          client_id: googleClientId,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        };
        // Web client requires client_secret; iOS client does not
        if (!useIosClientId) {
          tokenParams.client_secret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!;
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(tokenParams),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('[mobile-token] Google token exchange failed:', errorText);
          return NextResponse.json(
            { error: 'Google token exchange failed' },
            { status: 400 }
          );
        }

        tokenData = await tokenResponse.json();

        if (!tokenData.refresh_token) {
          console.warn('[mobile-token] Google: no refresh token received (re-authorization). Calendar will work until token expires.');
        }

        // Get user email from Calendar API (primary calendar ID = email)
        const calResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (calResponse.ok) {
          const calData = await calResponse.json();
          console.log('[mobile-token] Google calendars/primary response:', JSON.stringify({ id: calData.id, summary: calData.summary }));
          calendarEmail = calData.id || calendarEmail;
        } else {
          const errorText = await calResponse.text();
          console.error('[mobile-token] Google calendars/primary failed:', calResponse.status, errorText.substring(0, 200));
        }
      } else {
        // Microsoft
        const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('[mobile-token] Microsoft token exchange failed:', errorText);
          return NextResponse.json(
            { error: 'Microsoft token exchange failed' },
            { status: 400 }
          );
        }

        tokenData = await tokenResponse.json();

        // Get user email from Microsoft Graph
        const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          calendarEmail = userInfo.mail || userInfo.userPrincipalName || userEmail;
        }
      }

      const encryptedTokens = await encryptCalendarTokens({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        tokenExpiry: Date.now() + tokenData.expires_in * 1000,
      });

      newCalendar = {
        id: `${userId}_${section}_${provider}`,
        userId,
        provider,
        email: calendarEmail,
        section,
        schedulableHours: section === 'work' ? WORK_SCHEDULABLE_HOURS : PERSONAL_SCHEDULABLE_HOURS,
        accessToken: encryptedTokens.accessToken,
        ...(encryptedTokens.refreshToken && { refreshToken: encryptedTokens.refreshToken }),
        tokenExpiry: encryptedTokens.tokenExpiry,
        connectionStatus: 'connected',
        accessMethod: 'oauth',
        calendarWriteScope: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      return NextResponse.json(
        { error: 'Invalid provider. Must be google, microsoft, or apple.' },
        { status: 400 }
      );
    }

    // Save calendar to profile
    const updatedCalendars = [...(profile.calendars || []), newCalendar];
    await AdminProfileService.updateProfile(userId, { calendars: updatedCalendars });

    // Invalidate common-times cache so new calendar availability is reflected immediately
    const { invalidateCommonTimesCache } = await import('@/server/calendar/cache-invalidation');
    await invalidateCommonTimesCache(userId);

    console.log(`[mobile-token] Calendar added for ${userId} (${provider}/${section})`);

    return NextResponse.json({
      success: true,
      message: `${provider} calendar connected successfully`,
      provider,
    });
  } catch (error) {
    console.error('[mobile-token] Error:', error);
    return NextResponse.json(
      { error: 'Failed to connect calendar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
