/**
 * Calendar Connection API - Delete calendar
 * Handles deletion of calendar connections by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/lib/firebase/adminProfileService';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { calendarId } = await params;

    // Get current profile
    const profile = await AdminProfileService.getProfile(session.user.id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Find the calendar to delete
    const calendar = profile.calendars?.find(cal => cal.id === calendarId);
    if (!calendar) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    // Optional: Revoke OAuth tokens with the provider
    // Note: This is best-effort - we don't block deletion if revocation fails
    if (calendar.accessToken && calendar.provider === 'google') {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${calendar.accessToken}`, {
          method: 'POST',
        });
        console.log(`[Calendar API] Revoked Google OAuth token for ${calendarId}`);
      } catch (revokeError) {
        console.warn(`[Calendar API] Failed to revoke Google token:`, revokeError);
      }
    }

    // Note: Microsoft doesn't provide a simple revoke endpoint for individual tokens
    // Users need to revoke via account.live.com/consent/Manage

    // Remove calendar from profile (this also removes encrypted tokens)
    const updatedCalendars = profile.calendars?.filter(cal => cal.id !== calendarId) || [];
    await AdminProfileService.updateProfile(session.user.id, {
      calendars: updatedCalendars
    });

    console.log(`[Calendar API] Deleted calendar ${calendarId} for user ${session.user.id}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Calendar API] Delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
