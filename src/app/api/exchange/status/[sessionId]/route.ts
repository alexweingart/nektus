/**
 * API endpoint for checking exchange status via polling
 * Replaces SSE-based real-time notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { findExchangeMatchBySession } from '@/lib/redis/client';

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

    // Check if this session has a match
    const matchResult = await findExchangeMatchBySession(sessionId);
    
    if (matchResult) {
      console.log(`✅ Found match for session ${sessionId}: token=${matchResult.token}, youAre=${matchResult.youAre}`);
      
      return NextResponse.json({
        success: true,
        hasMatch: true,
        match: {
          token: matchResult.token,
          youAre: matchResult.youAre,
          matchData: matchResult.matchData
        }
      });
    }

    console.log(`❌ No match found for session ${sessionId}`);
    
    return NextResponse.json({
      success: true,
      hasMatch: false,
      match: null
    });

  } catch (error) {
    console.error('Exchange status check error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
