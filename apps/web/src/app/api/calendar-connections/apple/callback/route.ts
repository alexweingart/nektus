import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { testAppleConnection } from '@/client/calendar/providers/apple';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { encryptCalendarTokens } from '@/client/calendar/providers/tokens';
import { Calendar } from '@/types/profile';
import { WORK_SCHEDULABLE_HOURS, PERSONAL_SCHEDULABLE_HOURS } from '@/shared/constants';

// Force Node.js runtime for tsdav library
export const runtime = 'nodejs';

// Apple CalDAV uses manual credentials submission instead of OAuth
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userEmail, appleId, appSpecificPassword, section } = await request.json();

    if (!userEmail || !appleId || !appSpecificPassword || !section) {
      return NextResponse.json(
        { error: 'Missing required parameters: userEmail, appleId, appSpecificPassword, section' },
        { status: 400 }
      );
    }

    // Test the connection first
    const connectionTest = await testAppleConnection(appleId, appSpecificPassword);
    if (!connectionTest) {
      return NextResponse.json(
        { error: 'Failed to connect to Apple CalDAV. Please check your credentials.' },
        { status: 401 }
      );
    }

    console.log(`[Apple CalDAV] Connection verified for ${appleId}`);

    // Get current profile
    const profile = await AdminProfileService.getProfile(session.user.id);
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if calendar already exists for this section
    const existingCalendar = profile.calendars?.find(cal => cal.section === section);
    if (existingCalendar) {
      return NextResponse.json(
        { error: 'Calendar already exists for this section' },
        { status: 400 }
      );
    }

    // Encrypt the app-specific password for storage
    const encryptedTokens = await encryptCalendarTokens({
      accessToken: appSpecificPassword, // Store encrypted app-specific password
      refreshToken: appleId, // Store Apple ID
      tokenExpiry: 0 // Apple credentials don't expire
    });

    // Create calendar object
    const newCalendar: Calendar = {
      id: `${session.user.id}_${section}_apple`,
      userId: session.user.id,
      provider: 'apple',
      email: appleId,
      section: section,
      schedulableHours: section === 'work' ? WORK_SCHEDULABLE_HOURS : PERSONAL_SCHEDULABLE_HOURS,
      accessToken: encryptedTokens.accessToken, // Encrypted app-specific password
      refreshToken: encryptedTokens.refreshToken, // Encrypted Apple ID
      tokenExpiry: 0,
      connectionStatus: 'connected',
      accessMethod: 'caldav',
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

    console.log(`[Apple CalDAV] Calendar added for ${session.user.id} (${section})`);

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Apple Calendar connected successfully',
      provider: 'apple'
    });

  } catch (error) {
    console.error('[Apple CalDAV] Setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup Apple Calendar connection', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
