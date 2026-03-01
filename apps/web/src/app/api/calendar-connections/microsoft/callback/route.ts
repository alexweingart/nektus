/**
 * Microsoft Calendar OAuth Callback
 * Handles OAuth redirect from Microsoft after user authorizes calendar access
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { encryptCalendarTokens } from '@/client/calendar/providers/tokens';
import { Calendar } from '@/types/profile';
import { WORK_SCHEDULABLE_HOURS, PERSONAL_SCHEDULABLE_HOURS } from '@/shared/constants';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Parse state to get section, returnUrl, and redirectTo
    let stateData: {
      userEmail: string;
      section: 'personal' | 'work';
      returnUrl?: string;
      redirectTo?: string;
      platform?: string;
      appCallbackUrl?: string;
    } | null = null;
    try {
      stateData = state ? JSON.parse(decodeURIComponent(state)) : null;
    } catch (e) {
      console.error('[Microsoft OAuth] Failed to parse state:', state, e);
    }

    // iOS app: handle all responses by redirecting back to the app via custom URL scheme
    if (stateData?.platform === 'ios' && stateData?.appCallbackUrl) {
      if (error) {
        console.error(`[Microsoft OAuth] iOS error: ${error}`);
        const appRedirect = `${stateData.appCallbackUrl}?error=${encodeURIComponent(error)}&provider=microsoft`;
        return new Response(null, { status: 302, headers: { Location: appRedirect } });
      }
      if (code) {
        console.log(`[Microsoft OAuth] iOS redirect: sending code back to app`);
        const appRedirect = `${stateData.appCallbackUrl}?code=${encodeURIComponent(code)}&provider=microsoft`;
        return new Response(null, { status: 302, headers: { Location: appRedirect } });
      }
      console.error(`[Microsoft OAuth] iOS: no code or error in callback`);
      const appRedirect = `${stateData.appCallbackUrl}?error=missing_code&provider=microsoft`;
      return new Response(null, { status: 302, headers: { Location: appRedirect } });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/sign-in?error=unauthorized', request.url));
    }

    const returnUrl = stateData?.returnUrl || '/edit';
    const redirectTo = stateData?.redirectTo || returnUrl;

    if (error) {
      console.error('[Microsoft OAuth] Error:', error);
      // Handle admin consent errors
      if (error === 'admin_consent_required' || error === 'access_denied') {
        return NextResponse.redirect(new URL(`${returnUrl}?error=admin_consent_required`, request.url));
      }
      return NextResponse.redirect(new URL(`${returnUrl}?error=microsoft_oauth_failed`, request.url));
    }

    if (!code || !state || !stateData) {
      console.error('[Microsoft OAuth] Missing code or state');
      return NextResponse.redirect(new URL(`${returnUrl}?error=missing_parameters`, request.url));
    }

    const { section } = stateData;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || request.url.split('/api')[0]}/api/calendar-connections/microsoft/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Microsoft OAuth] Token exchange failed:', tokenResponse.statusText, errorText);
      return NextResponse.redirect(new URL(`${returnUrl}?error=token_exchange_failed`, request.url));
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Microsoft Graph to get their email
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error('[Microsoft OAuth] Failed to get user info:', userInfoResponse.statusText, errorText);
      return NextResponse.redirect(new URL(`${returnUrl}?error=user_info_failed`, request.url));
    }

    const userInfo = await userInfoResponse.json();
    const calendarEmail = userInfo.mail || userInfo.userPrincipalName;

    console.log(`[Microsoft OAuth] Success for ${calendarEmail}`);

    // Get current profile
    const profile = await AdminProfileService.getProfile(session.user.id);
    if (!profile) {
      return NextResponse.redirect(new URL(`${returnUrl}?error=profile_not_found`, request.url));
    }

    // Check if calendar already exists for this section
    const existingCalendar = profile.calendars?.find(cal => cal.section === section);
    if (existingCalendar) {
      return NextResponse.redirect(new URL(`${returnUrl}?error=calendar_already_exists`, request.url));
    }

    // Encrypt tokens
    const encryptedTokens = await encryptCalendarTokens({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || '',
      tokenExpiry: Date.now() + tokenData.expires_in * 1000
    });

    // Create calendar object
    const newCalendar: Calendar = {
      id: `${session.user.id}_${section}_microsoft`,
      userId: session.user.id,
      provider: 'microsoft',
      email: calendarEmail,
      section: section,
      schedulableHours: section === 'work' ? WORK_SCHEDULABLE_HOURS : PERSONAL_SCHEDULABLE_HOURS,
      accessToken: encryptedTokens.accessToken,
      ...(encryptedTokens.refreshToken && { refreshToken: encryptedTokens.refreshToken }),
      tokenExpiry: encryptedTokens.tokenExpiry,
      connectionStatus: 'connected',
      accessMethod: 'oauth',
      calendarWriteScope: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add calendar to profile
    const updatedCalendars = [...(profile.calendars || []), newCalendar];
    await AdminProfileService.updateProfile(session.user.id, {
      calendars: updatedCalendars
    });

    // Invalidate common-times cache so new calendar availability is reflected immediately
    const { invalidateCommonTimesCache } = await import('@/server/calendar/cache-invalidation');
    await invalidateCommonTimesCache(session.user.id);

    console.log(`[Microsoft OAuth] Calendar added for ${session.user.id} (${section})`);

    // Redirect to the final destination (smart-schedule page, or original page if not specified)
    return NextResponse.redirect(new URL(redirectTo, request.url));

  } catch (error) {
    console.error('[Microsoft OAuth] Callback error:', error);
    // Use /edit as fallback if returnUrl is not available
    const fallbackUrl = '/edit';
    return NextResponse.redirect(new URL(`${fallbackUrl}?error=callback_error`, request.url));
  }
}
