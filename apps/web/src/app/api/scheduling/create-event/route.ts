import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/server/config/firebase';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { createScheduledEvent } from '@/server/calendar/create-event';

function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '');
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { auth } = await getFirebaseAdmin();
    const authHeader = request.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const {
      attendeeId,
      eventTitle,
      eventDescription,
      startTime,
      endTime,
      location,
      locationAddress,
      timeZone,
      calendarSection,
      travelBuffer,
    } = body;

    if (!attendeeId || !eventTitle || !startTime || !endTime || !timeZone || !calendarSection) {
      return NextResponse.json(
        { error: 'Missing required fields: attendeeId, eventTitle, startTime, endTime, timeZone, calendarSection' },
        { status: 400 }
      );
    }

    // Load profiles
    const [organizerProfile, attendeeProfile] = await Promise.all([
      AdminProfileService.getProfile(userId),
      AdminProfileService.getProfile(attendeeId),
    ]);

    if (!organizerProfile) {
      return NextResponse.json({ error: 'Organizer profile not found' }, { status: 404 });
    }

    const result = await createScheduledEvent({
      organizerId: userId,
      organizerProfile,
      attendeeId,
      attendeeProfile: attendeeProfile || undefined,
      eventTitle,
      eventDescription: eventDescription || '',
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location,
      locationAddress,
      timeZone,
      calendarSection,
      travelBuffer,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[create-event API] Error:', error);

    const message = error instanceof Error ? error.message : 'Failed to create event';

    if (message === 'RECONNECT_REQUIRED') {
      return NextResponse.json(
        { error: 'RECONNECT_REQUIRED', message: 'Calendar needs to be reconnected with write permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
