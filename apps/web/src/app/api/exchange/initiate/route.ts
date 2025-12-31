/**
 * API endpoint for initiating contact exchange (QR code fallback)
 * Generates token and creates waiting MatchData before bump/scan occurs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redis } from '@/server/config/redis';
import { getProfile } from '@/server/config/firebase';

/**
 * Generate a secure random token for exchange
 */
function generateExchangeToken(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function POST(request: NextRequest) {
  console.log(`🎯 === INITIATE ENDPOINT CALLED ===`);

  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { sessionId, sharingCategory } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'Missing required field: sessionId' },
        { status: 400 }
      );
    }

    // Get user's profile from Firebase
    const userProfile = await getProfile(session.user.id);
    if (!userProfile) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 }
      );
    }

    // Generate token
    const token = generateExchangeToken();
    console.log(`🔑 Generated token: ${token} for user ${session.user.id}`);

    // Create waiting MatchData
    const matchData = {
      sessionA: sessionId,
      sessionB: null,
      userA: userProfile,
      userB: null,
      timestamp: Date.now(),
      status: 'waiting',
      sharingCategoryA: sharingCategory || 'All',
      sharingCategoryB: null
    };

    if (!redis) {
      console.error('❌ Redis not available');
      return NextResponse.json(
        { success: false, message: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    // Store in Redis with 30-second TTL
    await redis.setex(`exchange_match:${token}`, 30, JSON.stringify(matchData));
    console.log(`✅ Stored waiting exchange for token: ${token}`);

    // Store reverse mapping for polling
    await redis.setex(`exchange_session:${sessionId}`, 30, token);
    console.log(`✅ Stored session mapping: ${sessionId} → ${token}`);

    return NextResponse.json({
      success: true,
      token
    });

  } catch (error) {
    console.error('❌ Initiate endpoint error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
