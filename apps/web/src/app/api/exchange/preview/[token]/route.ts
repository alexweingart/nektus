/**
 * API endpoint for preview of exchange (unauthenticated access)
 * Returns limited profile data for users who scan QR code while signed out
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/server/config/redis';
import type { UserProfile } from '@/types/profile';

/**
 * GET /api/exchange/preview/[token]
 * Get limited profile preview for unauthenticated users
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    console.log(`🔍 Preview request for token: ${token}`);

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token required' },
        { status: 400 }
      );
    }

    if (!redis) {
      return NextResponse.json(
        { success: false, message: 'Redis not available' },
        { status: 503 }
      );
    }

    // Get the waiting exchange data
    const matchKey = `exchange_match:${token}`;
    const matchDataStr = await redis.get(matchKey);

    if (!matchDataStr) {
      console.log(`❌ No match data found for token: ${token}`);
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    const matchData = typeof matchDataStr === 'string' ? JSON.parse(matchDataStr) : matchDataStr;

    // Only allow preview for waiting exchanges
    if (matchData.status !== 'waiting' || matchData.userB !== null) {
      console.log(`❌ Not a waiting exchange for token: ${token}`);
      return NextResponse.json(
        { success: false, message: 'This exchange is no longer available for preview' },
        { status: 400 }
      );
    }

    const userAProfile: UserProfile = matchData.userA;
    const sharingCategory = matchData.sharingCategoryA || 'Personal';

    // Create limited profile with only public data
    const limitedProfile: UserProfile = {
      userId: userAProfile.userId,
      profileImage: userAProfile.profileImage || '',
      backgroundImage: userAProfile.backgroundImage || '',
      backgroundColors: userAProfile.backgroundColors,
      lastUpdated: userAProfile.lastUpdated,
      contactEntries: [],
      calendars: []
    };

    // Filter contact entries to only include name and bio (no contact details)
    const allowedFields = ['name', 'bio'];
    const filteredEntries = (userAProfile.contactEntries || [])
      .filter(entry => {
        // Only include visible entries
        if (!entry.isVisible) return false;

        // Filter by sharing category
        if (sharingCategory === 'Personal' && entry.section === 'work') return false;
        if (sharingCategory === 'Work' && entry.section === 'personal') return false;

        // Only allow name and bio
        return allowedFields.includes(entry.fieldType);
      });

    limitedProfile.contactEntries = filteredEntries;

    // Extract social icon types (fieldType only, no values)
    const socialIconTypes = (userAProfile.contactEntries || [])
      .filter(entry => {
        if (!entry.isVisible) return false;
        if (sharingCategory === 'Personal' && entry.section === 'work') return false;
        if (sharingCategory === 'Work' && entry.section === 'personal') return false;

        // Social platforms and contact methods
        const socialFields = [
          'phone', 'email', 'whatsapp',
          'instagram', 'x', 'linkedin', 'facebook', 'tiktok',
          'youtube', 'snapchat', 'threads', 'github', 'telegram'
        ];
        return socialFields.includes(entry.fieldType);
      })
      .map(entry => entry.fieldType);

    // Mark that someone accessed the preview (scanning while signed out)
    // Extend TTL to 5 minutes to give user time to complete OAuth sign-in
    if (!matchData.scanStatus) {
      matchData.scanStatus = 'pending_auth';
      matchData.previewAccessedAt = Date.now();
      await redis.setex(matchKey, 300, JSON.stringify(matchData));
      console.log(`✅ Marked exchange as pending_auth for token: ${token}, extended TTL to 5 minutes`);
    } else {
      // Already marked as pending_auth, just extend TTL
      await redis.setex(matchKey, 300, JSON.stringify(matchData));
    }

    console.log(`✅ Returning preview for token: ${token}, socialIcons: ${socialIconTypes.length}, backgroundColors:`, limitedProfile.backgroundColors);
    return NextResponse.json({
      success: true,
      profile: limitedProfile,
      socialIconTypes,
      sharingCategory
    });

  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
