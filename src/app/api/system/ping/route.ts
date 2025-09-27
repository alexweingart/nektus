/**
 * API endpoint for ping and logging functionality
 * - HEAD: Simple ping for RTT measurement
 * - POST: Logging endpoint for client events
 */

import { NextRequest, NextResponse } from 'next/server';

// For HEAD requests (simple ping)
export async function HEAD() {
  return NextResponse.json({ success: true });
}

// For POST requests (logging + IP geolocation caching + cleanup)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Log the received data
    console.log(`[SYSTEM/PING] ${data.event || 'event'}:`,
      data.message || '',
      data.sessionId ? `(session: ${data.sessionId})` : ''
    );

    // Also send to debug logs if it's a motion_debug event
    if (data.event === 'motion_debug') {
      try {
        await fetch(`${request.nextUrl.origin}/api/debug/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch (debugError) {
        console.warn('Failed to send to debug logs:', debugError);
      }
    }
    
    // If this is an exchange start event, clean up user exchanges and pre-cache IP geolocation
    if (data.event === 'exchange_start' && data.sessionId) {
      console.log(`🧹 Exchange start detected - performing cleanup and pre-caching for session ${data.sessionId}`);
      
      // Get user session for cleanup
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/app/api/auth/[...nextauth]/options');
      const session = await getServerSession(authOptions);
      
      if (session?.user?.id) {
        // Clean up old exchanges for this user to prevent stale session matches
        const { cleanupUserExchanges } = await import('@/lib/redis/client');
        await cleanupUserExchanges(session.user.id);
        console.log(`🧹 Cleaned up old exchanges for user ${session.user.id}`);
      } else {
        console.warn(`⚠️ No authenticated user found for exchange_start cleanup`);
      }
      
      // Location lookup moved to hit endpoint only to reduce API usage
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ping log error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}