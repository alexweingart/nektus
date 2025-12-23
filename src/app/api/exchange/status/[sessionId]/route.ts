/**
 * API endpoint for checking exchange status via polling
 * Replaces SSE-based real-time notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getExchangeMatch } from '@/lib/server/contacts/matching';
import { redis } from '@/lib/config/redis';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Get session for user authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { sessionId } = await context.params;
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'Session ID required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Polling for match status: session=${sessionId}, user=${session.user.email}`);

    // Check if this session has a match by looking up the token
    if (!redis) {
      return NextResponse.json(
        { success: false, message: 'Redis not available' },
        { status: 503 }
      );
    }

    const sessionMatch = await redis.get(`exchange_session:${sessionId}`);
    
    if (!sessionMatch) {
      console.log(`❌ No match found for session ${sessionId}`);
      return NextResponse.json({
        success: true,
        hasMatch: false,
        match: null
      });
    }
    
    // Parse session data to get token
    let sessionData;
    if (typeof sessionMatch === 'string') {
      sessionData = JSON.parse(sessionMatch);
    } else {
      sessionData = sessionMatch;
    }
    
    const { token, youAre } = sessionData;
    
    if (!token) {
      console.log(`❌ No token found for session ${sessionId}`);
      return NextResponse.json({
        success: true,
        hasMatch: false,
        match: null
      });
    }
    
    // Get the match data using the unified function
    const matchData = await getExchangeMatch(token);
    
    if (!matchData) {
      console.log(`❌ No match data found for token ${token}`);
      return NextResponse.json({
        success: true,
        hasMatch: false,
        match: null
      });
    }
    
    console.log(`✅ Found match for session ${sessionId}: token=${token}, youAre=${youAre}`);
    
    return NextResponse.json({
      success: true,
      hasMatch: true,
      match: {
        token,
        youAre,
        matchData
      }
    });

  } catch (error) {
    console.error('Exchange status check error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
