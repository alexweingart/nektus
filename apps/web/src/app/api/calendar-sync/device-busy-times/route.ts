import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/server/config/firebase';

/**
 * POST /api/calendar-sync/device-busy-times
 *
 * Receives EventKit busy times from the iOS app and stores them
 * in the user's Firestore profile for cross-user scheduling.
 *
 * Called by CalendarSyncModule.swift (foreground + background sync).
 */
export async function POST(request: NextRequest) {
  try {
    const { auth, db } = await getFirebaseAdmin();
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await auth.verifyIdToken(token);
    const userId = decoded.uid;

    const { busyTimes, windowStart, windowEnd, updatedAt } = await request.json();

    if (!Array.isArray(busyTimes)) {
      return NextResponse.json({ error: 'busyTimes must be an array' }, { status: 400 });
    }

    await db.collection('profiles').doc(userId).update({
      deviceBusyTimes: {
        slots: busyTimes,
        windowStart,
        windowEnd,
        updatedAt,
      }
    });

    console.log(`✅ [CalendarSync] Saved ${busyTimes.length} device busy times for user ${userId}`);
    return NextResponse.json({ success: true, count: busyTimes.length });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isAuthError = message.includes('auth') || message.includes('token') || message.includes('Firebase ID token');
    console.error('[CalendarSync] Error:', message);
    return NextResponse.json(
      { error: 'Failed to sync busy times' },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
