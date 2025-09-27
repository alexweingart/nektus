/**
 * API endpoint for receiving contact exchange "hits" (bumps/taps)
 * Uses Redis for scalable matching and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import type { ContactExchangeRequest, ContactExchangeResponse } from '@/types/contactExchange';
import type { UserProfile } from '@/types/profile';
import { 
  atomicExchangeAndMatch,
  storeExchangeMatch
} from '@/lib/redis/client';
import { getRedisTime } from '@/lib/services/server/redisTimeService';
import { getProfile } from '@/lib/firebase/adminConfig';

function getClientIP(request: NextRequest): string {
  // Get IP address for matching
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return '127.0.0.1';
}


function generateExchangeToken(): string {
  // Generate a secure random token
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function POST(request: NextRequest) {
  console.log(`🎯 === HIT ENDPOINT CALLED ===`);
  try {
    // Get client IP for location matching
    const clientIP = getClientIP(request);
    
    // Get session for user authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }


    // Parse request
    const exchangeRequest: ContactExchangeRequest = await request.json();
    const tReceived = await getRedisTime(); // Redis consistent time
    
    // Validate required fields
    if (!exchangeRequest.session || !exchangeRequest.ts) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate timing deltas for diagnostics
    const now = await getRedisTime();
    const clientTimestamp = exchangeRequest.ts;
    const timeDiff = Math.abs(now - clientTimestamp);
    const clockSkew = now - clientTimestamp; // positive = client clock is behind server
    
    // Calculate network delay estimate (if RTT is provided from client)
    const networkDelay = exchangeRequest.rtt ? exchangeRequest.rtt / 2 : undefined;
    
    console.log(`📊 TIMING BREAKDOWN:
      - Server receive time: ${tReceived}
      - Client timestamp (sync'd): ${clientTimestamp}
      - Clock skew: ${clockSkew}ms (positive = client behind)
      - Time diff: ${timeDiff}ms
      - Network delay estimate: ${networkDelay ? `${networkDelay.toFixed(1)}ms` : 'N/A'}
      - Client RTT: ${exchangeRequest.rtt || 'N/A'}ms`);
    
    // Validate timestamp (not too old, not in future)
    if (timeDiff > 10000) { // 10 seconds tolerance
      console.warn(`❌ Timestamp rejected: ${timeDiff}ms difference`);
      return NextResponse.json(
        { success: false, message: 'Request timestamp is invalid' },
        { status: 400 }
      );
    }

    // Get IP location data (should be cached from ping endpoint)
    const { getIPLocation } = await import('@/lib/services/server/ipGeolocationService');
    const locationData = await getIPLocation(clientIP);
    
    console.log(`📍 Location data for ${clientIP} (cached: ${locationData.cached ? 'yes' : 'no'}):`, {
      city: locationData.city,
      state: locationData.state,
      isVPN: locationData.isVPN,
      confidence: locationData.confidence
    });

    // Get user profile from Firebase
    const userProfile = await getProfile(session.user.id);
    if (!userProfile) {
      return NextResponse.json(
        { success: false, message: 'User profile not found' },
        { status: 404 }
      );
    }

    // Prepare exchange data
    const exchangeData = {
      userId: session.user.id,
      profile: userProfile as unknown as UserProfile,
      timestamp: exchangeRequest.ts,
      location: locationData,
      rtt: exchangeRequest.rtt,
      mag: exchangeRequest.mag,
      vector: exchangeRequest.vector,
      sessionId: exchangeRequest.session,
      sharingCategory: exchangeRequest.sharingCategory || 'All'
    };

    console.log(`📨 Hit from ${session.user.email} (session: ${exchangeRequest.session}):`, {
      timestamp: exchangeRequest.ts,
      magnitude: exchangeRequest.mag,
      location: `${locationData.city || 'unknown'}, ${locationData.state || 'unknown'}`,
      isVPN: locationData.isVPN,
      confidence: locationData.confidence,
      hasVector: !!exchangeRequest.vector,
      sharingCategory: exchangeData.sharingCategory,
      hitNumber: exchangeRequest.hitNumber || 'unknown'
    });

    // Use atomic exchange and match operation to prevent race conditions
    console.log(`🔍 Atomically storing and checking for matches for session ${exchangeRequest.session}`);
    const matchResult = await atomicExchangeAndMatch(
      exchangeRequest.session,
      exchangeData,
      locationData, // Pass location data for geographic matching
      exchangeRequest.ts, // pass timestamp for time-based matching
      30 // TTL seconds
    );
    console.log(`🔍 Atomic operation result:`, matchResult);

    if (matchResult) {
      // We found a match!
      const { sessionId: matchedSessionId, matchData } = matchResult;
      console.log(`🎉 Match found between ${exchangeRequest.session} and ${matchedSessionId}`);
      
      // Generate exchange token
      const exchangeToken = generateExchangeToken();
      console.log(`🔑 Generated exchange token: ${exchangeToken}`);
      
      // Store the match in Redis with both users' sharing categories
      await storeExchangeMatch(
        exchangeToken,
        exchangeRequest.session,
        matchedSessionId,
        userProfile as unknown as UserProfile, // Current user's profile
        matchData.profile, // Matched user's profile
        exchangeData.sharingCategory, // Current user's sharing category
        matchData.sharingCategory || 'All' // Matched user's sharing category
      );
      console.log(`💾 Stored exchange match in Redis with sharing categories`);
      
      // Note: Clients will discover the match via polling instead of SSE
      console.log(`🎉 Match created - clients will discover via polling`);
      
      return NextResponse.json({
        success: true,
        matched: true,
        token: exchangeToken,
        youAre: 'A'
      } as ContactExchangeResponse);
      
    } else {
      // No match found - exchange was stored atomically and remains pending
      console.log(`⏳ No match found, exchange ${exchangeRequest.session} stored and waiting for match`);
      
      
      return NextResponse.json({
        success: true,
        matched: false,
        message: 'Exchange registered, waiting for match'
      } as ContactExchangeResponse);
    }

  } catch (error) {
    console.error('Exchange hit error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
