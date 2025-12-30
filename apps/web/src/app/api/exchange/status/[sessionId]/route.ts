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
      // No confirmed match yet - check for pending match that's ready to promote
      console.log(`🔍 No confirmed match, checking for pending match for session ${sessionId}`);

      const pendingExchangeData = await redis.get(`pending_exchange:${sessionId}`);
      if (pendingExchangeData) {
        const exchangeData = typeof pendingExchangeData === 'string' ? JSON.parse(pendingExchangeData) : pendingExchangeData;

        if (exchangeData.pendingMatchWith && exchangeData.pendingMatchCreatedAt) {
          console.log(`🕐 Found pending match: ${sessionId} ↔ ${exchangeData.pendingMatchWith}`);

          // Check if other exchange still exists and has matching pending
          const otherExchangeData = await redis.get(`pending_exchange:${exchangeData.pendingMatchWith}`);
          if (otherExchangeData) {
            const otherData = typeof otherExchangeData === 'string' ? JSON.parse(otherExchangeData) : otherExchangeData;

            // Verify both still point to each other (not cancelled)
            if (otherData.pendingMatchWith === sessionId) {
              // Check if 1.5s has elapsed from pendingMatchCreatedAt
              const { getRedisTime } = await import('@/lib/server/contacts/redis-time');
              const currentServerTime = await getRedisTime();
              const elapsed = currentServerTime - exchangeData.pendingMatchCreatedAt;

              console.log(`⏰ Pending match age: ${elapsed}ms (threshold: 1500ms)`);

              if (elapsed >= 1500) {
                // Promote to confirmed match!
                console.log(`✅ Promoting pending match to confirmed match`);

                // Generate token
                const token = Array.from({ length: 32 }, () =>
                  Math.random().toString(36)[2] || '0'
                ).join('');

                // Import storeExchangeMatch
                const { storeExchangeMatch } = await import('@/lib/server/contacts/matching');

                // Store the match
                await storeExchangeMatch(
                  token,
                  sessionId,
                  exchangeData.pendingMatchWith,
                  exchangeData.profile,
                  otherData.profile,
                  exchangeData.sharingCategory,
                  otherData.sharingCategory
                );

                // Clean up both pending exchanges
                await redis.del(`pending_exchange:${sessionId}`);
                await redis.del(`pending_exchange:${exchangeData.pendingMatchWith}`);
                await redis.srem('geo_bucket:global', sessionId);
                await redis.srem('geo_bucket:global', exchangeData.pendingMatchWith);

                console.log(`🎉 Pending match promoted: ${sessionId} ↔ ${exchangeData.pendingMatchWith}, token: ${token}`);

                // Get the full match data
                const matchData = await getExchangeMatch(token);

                return NextResponse.json({
                  success: true,
                  hasMatch: true,
                  match: {
                    token,
                    youAre: 'A', // First to poll gets 'A'
                    matchData
                  }
                });
              } else {
                console.log(`⏳ Pending match not ready yet (${1500 - elapsed}ms remaining)`);
              }
            } else {
              console.log(`❌ Pending match cancelled (other exchange no longer points back)`);
            }
          } else {
            console.log(`❌ Pending match partner no longer exists`);
          }
        }
      }

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
