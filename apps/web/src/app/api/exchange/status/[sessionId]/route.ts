/**
 * API endpoint for checking exchange status via polling
 * Replaces SSE-based real-time notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/auth/getAuthenticatedUser';
import { getExchangeMatch } from '@/server/contacts/matching';
import { redis } from '@/server/config/redis';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Authenticate user (supports both NextAuth sessions and Firebase Bearer tokens)
    const user = await getAuthenticatedUser(request);
    if (!user) {
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

    console.log(`🔍 Polling for match status: session=${sessionId}, user=${user.id} (${user.source})`);

    // Check if this session has a match by looking up the token
    if (!redis) {
      return NextResponse.json(
        { success: false, message: 'Redis not available' },
        { status: 503 }
      );
    }

    // First check for QR scan matches (waiting exchange that got scanned)
    const sessionMapKey = `exchange_session:${sessionId}`;
    const mappedToken = await redis.get(sessionMapKey);

    if (mappedToken) {
      console.log(`🔍 Found session mapping to token: ${mappedToken}`);
      const matchKey = `exchange_match:${mappedToken}`;
      const matchDataStr = await redis.get(matchKey);

      if (matchDataStr) {
        const match = typeof matchDataStr === 'string' ? JSON.parse(matchDataStr) : matchDataStr;
        console.log(`📋 Found match data with status: ${match.status}, scanStatus: ${match.scanStatus}`);

        // Check for QR scan with different states
        if (match.scanStatus === 'pending_auth') {
          // Someone scanned but hasn't signed in yet
          console.log(`⏳ QR scanned, waiting for User B to complete sign-in`);
          return NextResponse.json({
            success: true,
            hasMatch: false,
            scanStatus: 'pending_auth', // User B is signing in
            match: null
          });
        }

        if (match.status === 'matched' && match.userB !== null && match.scanStatus === 'completed') {
          console.log(`✅ QR scan match completed!`);
          return NextResponse.json({
            success: true,
            hasMatch: true,
            scanStatus: 'completed',
            match: {
              token: mappedToken as string,
              youAre: 'A' as const,  // Original user (QR code shower) is always A
              matchData: match
            }
          });
        }

        // If still waiting (no scan, no bump match), return no match
        if (match.status === 'waiting') {
          console.log(`⏳ Still waiting for bump or scan`);
          return NextResponse.json({
            success: true,
            hasMatch: false,
            match: null
          });
        }
      }
    }

    // Check for regular bump matches
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
              const { getRedisTime } = await import('@/server/contacts/redis-time');
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
                const { storeExchangeMatch } = await import('@/server/contacts/matching');

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
    let token: string;
    let youAre: 'A' | 'B' = 'A'; // Default to A

    if (typeof sessionMatch === 'string') {
      // Check if it's a plain token string or JSON
      if (sessionMatch.startsWith('{')) {
        // It's JSON with {token, youAre}
        const sessionData = JSON.parse(sessionMatch);
        token = sessionData.token;
        youAre = sessionData.youAre || 'A';
      } else {
        // It's a plain token string (QR scan case)
        token = sessionMatch;
        youAre = 'A'; // Original user is always A in QR scan
      }
    } else {
      // Already an object
      const matchObj = sessionMatch as { token: string; youAre?: 'A' | 'B' };
      token = matchObj.token;
      youAre = matchObj.youAre || 'A';
    }
    
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
