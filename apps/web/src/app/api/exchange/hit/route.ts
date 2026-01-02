/**
 * API endpoint for receiving contact exchange "hits" (bumps/taps)
 * Uses Redis for scalable matching and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/auth/getAuthenticatedUser';
import type { ContactExchangeRequest, ContactExchangeResponse } from '@/types/contactExchange';
import type { UserProfile } from '@/types/profile';
import {
  atomicExchangeAndMatch,
  storeExchangeMatch,
  cleanupUserExchanges
} from '@/server/contacts/matching';
import { getRedisTime } from '@/server/contacts/redis-time';
import { getProfile } from '@/server/config/firebase';

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

    // Authenticate user (supports both NextAuth sessions and Firebase Bearer tokens)
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }
    console.log(`✅ Hit authenticated via ${user.source}: ${user.id}`);

    // Clean up old exchanges for this user to prevent stale session matches
    // This happens once per hit, ensuring fresh exchange state
    try {
      await cleanupUserExchanges(user.id);
      console.log(`🧹 Cleaned up old exchanges for user ${user.id}`);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup old exchanges:', cleanupError);
      // Continue anyway - cleanup failure shouldn't block exchange
    }

    // Parse request
    const exchangeRequest: ContactExchangeRequest = await request.json();
    const tReceived = await getRedisTime(); // Redis consistent time
    
    // Validate required fields
    if (!exchangeRequest.session) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Log timing information for diagnostics
    console.log(`📊 TIMING BREAKDOWN:
      - Server receive time: ${tReceived}
      - Client timestamp (for reference): ${exchangeRequest.ts || 'N/A'}`)

    // Get IP location data (should be cached from ping endpoint)
    const { getIPLocation } = await import('@/server/location/ip-geolocation');
    const locationData = await getIPLocation(clientIP);
    
    console.log(`📍 Location data for ${clientIP} (cached: ${locationData.cached ? 'yes' : 'no'}):`, {
      city: locationData.city,
      state: locationData.state,
      isVPN: locationData.isVPN,
      confidence: locationData.confidence
    });

    // Get user profile from Firebase
    const userProfile = await getProfile(user.id);
    if (!userProfile) {
      return NextResponse.json(
        { success: false, message: 'User profile not found' },
        { status: 404 }
      );
    }

    // Prepare exchange data with server timestamp
    const exchangeData = {
      userId: user.id,
      profile: userProfile as unknown as UserProfile,
      timestamp: exchangeRequest.ts || tReceived, // Use client timestamp if provided, otherwise server timestamp
      serverTimestamp: tReceived, // Add server receive timestamp for matching
      location: locationData,
      mag: exchangeRequest.mag,
      vector: exchangeRequest.vector,
      sessionId: exchangeRequest.session,
      sharingCategory: exchangeRequest.sharingCategory || 'All'
    };

    console.log(`📨 Hit from ${user.id} (session: ${exchangeRequest.session}):`, {
      serverTimestamp: tReceived,
      clientTimestamp: exchangeRequest.ts || 'N/A',
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
      tReceived, // Pass server timestamp for time-based matching
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
