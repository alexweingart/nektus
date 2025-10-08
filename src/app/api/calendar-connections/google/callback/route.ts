/**
 * Google Calendar OAuth Callback
 * Handles OAuth redirect from Google after user authorizes calendar access
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/lib/firebase/adminProfileService';
import { encryptCalendarTokens } from '@/lib/calendar-providers/tokens';
import { Calendar } from '@/types/profile';
import { WORK_SCHEDULABLE_HOURS, PERSONAL_SCHEDULABLE_HOURS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/sign-in?error=unauthorized', request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('[Google OAuth] Error:', error);
      return NextResponse.redirect(new URL('/edit-profile?error=google_oauth_failed', request.url));
    }

    if (!code || !state) {
      console.error('[Google OAuth] Missing code or state');
      return NextResponse.redirect(new URL('/edit-profile?error=missing_parameters', request.url));
    }

    // Parse state to get section (personal/work)
    const { section } = JSON.parse(decodeURIComponent(state)) as { userEmail: string; section: 'personal' | 'work' };

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || request.url.split('/api')[0]}/api/calendar-connections/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('[Google OAuth] Token exchange failed:', tokenResponse.statusText);
      return NextResponse.redirect(new URL('/edit-profile?error=token_exchange_failed', request.url));
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Google to get their email
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('[Google OAuth] Failed to get user info');
      return NextResponse.redirect(new URL('/edit-profile?error=user_info_failed', request.url));
    }

    const userInfo = await userInfoResponse.json();
    const calendarEmail = userInfo.email;

    console.log(`[Google OAuth] Success for ${calendarEmail}`);

    // Get current profile
    const profile = await AdminProfileService.getProfile(session.user.id);
    if (!profile) {
      return NextResponse.redirect(new URL('/edit-profile?error=profile_not_found', request.url));
    }

    // Check if calendar already exists for this section
    const existingCalendar = profile.calendars?.find(cal => cal.section === section);
    if (existingCalendar) {
      return NextResponse.redirect(new URL('/edit-profile?error=calendar_already_exists', request.url));
    }

    // Encrypt tokens
    const encryptedTokens = await encryptCalendarTokens({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiry: Date.now() + tokenData.expires_in * 1000
    });

    // Create calendar object
    const newCalendar: Calendar = {
      id: `${session.user.id}_${section}_google`,
      userId: session.user.id,
      provider: 'google',
      email: calendarEmail,
      section: section,
      schedulableHours: section === 'work' ? WORK_SCHEDULABLE_HOURS : PERSONAL_SCHEDULABLE_HOURS,
      accessToken: encryptedTokens.accessToken,
      refreshToken: encryptedTokens.refreshToken,
      tokenExpiry: encryptedTokens.tokenExpiry,
      connectionStatus: 'connected',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Add calendar to profile
    const updatedCalendars = [...(profile.calendars || []), newCalendar];
    await AdminProfileService.updateProfile(session.user.id, {
      calendars: updatedCalendars
    });

    console.log(`[Google OAuth] Calendar added for ${session.user.id} (${section})`);

    // Redirect back to edit profile
    return NextResponse.redirect(new URL('/edit-profile?calendar=added', request.url));

  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    return NextResponse.redirect(new URL('/edit-profile?error=callback_error', request.url));
  }
}
