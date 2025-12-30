/**
 * Google Calendar OAuth Callback
 * Handles OAuth redirect from Google after user authorizes calendar access
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/lib/server/profile/firebase-admin';
import { encryptCalendarTokens } from '@/lib/client/calendar/providers/tokens';
import { Calendar } from '@/types/profile';
import { WORK_SCHEDULABLE_HOURS, PERSONAL_SCHEDULABLE_HOURS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    // Use NEXTAUTH_URL as base for all redirects to ensure consistency
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/sign-in?error=unauthorized', baseUrl));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Parse state to get section, returnUrl, and retry flag
    const stateData = state ? JSON.parse(decodeURIComponent(state)) as {
      userEmail: string;
      section: 'personal' | 'work';
      returnUrl?: string;
      retry?: boolean;
    } : null;

    const returnUrl = stateData?.returnUrl || '/edit';

    if (error) {
      console.error('[Google OAuth] Error:', error);
      return NextResponse.redirect(new URL(`${returnUrl}?error=google_oauth_failed`, baseUrl));
    }

    if (!code || !state || !stateData) {
      console.error('[Google OAuth] Missing code or state');
      return NextResponse.redirect(new URL(`${returnUrl}?error=missing_parameters`, baseUrl));
    }

    const { section, userEmail, retry } = stateData;

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
      return NextResponse.redirect(new URL(`${returnUrl}?error=token_exchange_failed`, baseUrl));
    }

    const tokenData = await tokenResponse.json();

    // Use the email from the state (already validated and passed from the client)
    // No need to fetch from Google since we're using incremental auth with the same client
    const calendarEmail = userEmail;

    console.log(`[Google OAuth] Success for ${calendarEmail}`);

    // Get current profile
    const profile = await AdminProfileService.getProfile(session.user.id);
    if (!profile) {
      return NextResponse.redirect(new URL(`${returnUrl}?error=profile_not_found`, baseUrl));
    }

    // Check if calendar already exists for this section
    const existingCalendar = profile.calendars?.find(cal => cal.section === section);
    if (existingCalendar) {
      return NextResponse.redirect(new URL(`${returnUrl}?error=calendar_already_exists`, baseUrl));
    }

    // Check if we received a refresh token
    if (!tokenData.refresh_token) {
      console.error('[Google OAuth] No refresh token received - this may indicate a re-authorization without consent');

      // If this is already a retry with consent, give up and show error
      if (retry) {
        console.error('[Google OAuth] Still no refresh token after consent retry');
        return NextResponse.redirect(new URL(`${returnUrl}?error=no_refresh_token_after_consent`, baseUrl));
      }

      // First attempt failed - retry with consent to force Google to issue refresh token
      console.log('[Google OAuth] Retrying with prompt=consent to get refresh token');
      const retryParams = new URLSearchParams({
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || request.url.split('/api')[0]}/api/calendar-connections/google/callback`,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        access_type: 'offline',
        prompt: 'consent', // Force consent to get refresh token
        include_granted_scopes: 'true', // Keep existing permissions
        login_hint: userEmail, // Suggest the correct account
        state: encodeURIComponent(JSON.stringify({
          userEmail,
          section,
          returnUrl,
          retry: true // Mark this as a retry
        }))
      });

      return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${retryParams.toString()}`);
    }

    // Encrypt tokens
    const encryptedTokens = await encryptCalendarTokens({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiry: Date.now() + tokenData.expires_in * 1000
    });

    console.log(`[Google OAuth] Encrypted tokens - has refreshToken: ${!!encryptedTokens.refreshToken}, refreshToken length: ${encryptedTokens.refreshToken?.length || 0}`);

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
      accessMethod: 'oauth',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add calendar to profile
    const updatedCalendars = [...(profile.calendars || []), newCalendar];
    await AdminProfileService.updateProfile(session.user.id, {
      calendars: updatedCalendars
    });

    console.log(`[Google OAuth] Calendar added for ${session.user.id} (${section})`);

    // Redirect back to the return URL (or /edit by default)
    return NextResponse.redirect(new URL(`${returnUrl}?calendar=added`, baseUrl));

  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    // Use /edit as fallback if returnUrl is not available
    const fallbackUrl = '/edit';
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(new URL(`${fallbackUrl}?error=callback_error`, baseUrl));
  }
}
