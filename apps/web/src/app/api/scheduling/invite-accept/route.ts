import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/server/config/firebase';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { updateGoogleCalendarEvent, updateMicrosoftCalendarEvent } from '@/server/calendar/create-event';
import { refreshGoogleToken } from '@/client/calendar/providers/google';
import { refreshMicrosoftToken } from '@/client/calendar/providers/microsoft';
import { adminUpdateCalendarTokens } from '@/server/calendar/firebase-admin';

function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '');
}

export async function POST(request: NextRequest) {
  try {
    const { auth, db } = await getFirebaseAdmin();
    const authHeader = request.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await auth.verifyIdToken(token);

    const { inviteCode, attendeeEmail } = await request.json();

    if (!inviteCode || !attendeeEmail) {
      return NextResponse.json({ error: 'Missing inviteCode or attendeeEmail' }, { status: 400 });
    }

    // Load invite data
    const inviteDoc = await db.collection('invites').doc(inviteCode).get();
    if (!inviteDoc.exists) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const invite = inviteDoc.data()!;
    const { calendarEventId, calendarProvider, organizerId } = invite;

    // Load organizer profile to get calendar tokens
    const organizerProfile = await AdminProfileService.getProfile(organizerId);
    if (!organizerProfile) {
      return NextResponse.json({ error: 'Organizer profile not found' }, { status: 404 });
    }

    // Find the organizer's calendar
    const calendar = organizerProfile.calendars?.find(c => c.provider === calendarProvider);
    if (!calendar) {
      return NextResponse.json({ error: 'Organizer calendar not found' }, { status: 404 });
    }

    // Refresh token if needed
    let accessToken = calendar.accessToken;
    if (calendar.tokenExpiry && Date.now() >= (calendar.tokenExpiry - 5 * 60 * 1000)) {
      if (calendarProvider === 'google' && calendar.refreshToken) {
        const refreshed = await refreshGoogleToken(calendar.refreshToken);
        await adminUpdateCalendarTokens(organizerId, 'google', refreshed.accessToken, refreshed.expiresAt);
        accessToken = refreshed.accessToken;
      } else if (calendarProvider === 'microsoft' && calendar.refreshToken) {
        const refreshed = await refreshMicrosoftToken(calendar.refreshToken);
        await adminUpdateCalendarTokens(organizerId, 'microsoft', refreshed.accessToken, refreshed.expiresAt);
        accessToken = refreshed.accessToken;
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'No valid access token' }, { status: 500 });
    }

    // PATCH the organizer's event to add attendee
    if (calendarProvider === 'google') {
      await updateGoogleCalendarEvent(accessToken, calendarEventId, attendeeEmail);
    } else if (calendarProvider === 'microsoft') {
      await updateMicrosoftCalendarEvent(accessToken, calendarEventId, attendeeEmail);
    } else {
      return NextResponse.json({ error: 'Cannot PATCH CalDAV events remotely' }, { status: 400 });
    }

    // Update invite record
    await db.collection('invites').doc(inviteCode).update({
      addedToRecipient: true,
      attendeeEmail,
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[invite-accept] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to accept invite' },
      { status: 500 }
    );
  }
}
