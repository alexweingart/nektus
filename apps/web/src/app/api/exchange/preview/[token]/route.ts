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

    // Permanent demo token for App Clip testing — bypasses Redis entirely
    if (token === 'demo') {
      const demoProfile: UserProfile = {
        userId: 'mock-user-123',
        shortCode: 'mocktest',
        profileImage: 'https://www.nekt.us/demo-robot-avatar.png',
        backgroundImage: '',
        backgroundColors: ['#FF6F61', '#FFB6C1', '#FF1493'],
        lastUpdated: Date.now(),
        contactEntries: [
          {
            fieldType: 'name',
            value: 'Demo Contact',
            section: 'personal' as const,
            order: 0,
            isVisible: true,
            confirmed: true
          },
          {
            fieldType: 'bio',
            value: 'This is a test contact for animation preview. In real usage, you\'ll see the actual contact\'s profile here after a successful bump exchange!',
            section: 'personal' as const,
            order: 1,
            isVisible: true,
            confirmed: true
          }
        ]
      };

      // Add social entries (without values) so AnonContactView can render icons
      demoProfile.contactEntries.push(
        { fieldType: 'phone', value: '', section: 'personal' as const, order: 2, isVisible: true, confirmed: true, icon: '/icons/default/phone.svg' },
        { fieldType: 'email', value: '', section: 'personal' as const, order: 3, isVisible: true, confirmed: true, icon: '/icons/default/email.svg' },
        { fieldType: 'instagram', value: '', section: 'personal' as const, order: 4, isVisible: true, confirmed: true, icon: '/icons/default/instagram.svg' },
        { fieldType: 'x', value: '', section: 'personal' as const, order: 5, isVisible: true, confirmed: true, icon: '/icons/default/x.svg' },
        { fieldType: 'linkedin', value: '', section: 'personal' as const, order: 6, isVisible: true, confirmed: true, icon: '/icons/default/linkedin.svg' },
      );

      return NextResponse.json({
        success: true,
        profile: demoProfile,
        sharingCategory: 'All'
      });
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
      console.log(`❌ Not a waiting exchange for token: ${token} (already scanned)`);
      return NextResponse.json(
        { success: false, message: 'This QR code was already scanned by someone else', code: 'ALREADY_SCANNED' },
        { status: 409 }
      );
    }

    const userAProfile: UserProfile = matchData.userA;
    const sharingCategory = matchData.sharingCategoryA || 'Personal';

    // Create limited profile with only public data
    const limitedProfile: UserProfile = {
      userId: userAProfile.userId,
      shortCode: userAProfile.shortCode,
      profileImage: userAProfile.profileImage || '',
      backgroundImage: userAProfile.backgroundImage || '',
      backgroundColors: userAProfile.backgroundColors,
      lastUpdated: userAProfile.lastUpdated,
      contactEntries: [],
      calendars: []
    };

    // Include all visible entries: name/bio keep values, others are stripped
    const nameFields = ['name', 'bio'];
    const filteredEntries = (userAProfile.contactEntries || [])
      .filter(entry => {
        if (!entry.isVisible) return false;
        if (sharingCategory === 'Personal' && entry.section === 'work') return false;
        if (sharingCategory === 'Work' && entry.section === 'personal') return false;
        return true;
      })
      .map(entry => {
        if (nameFields.includes(entry.fieldType)) return entry;
        // Strip value from non-name/bio entries (don't leak contact details in preview)
        const { value, ...rest } = entry;
        return { ...rest, value: '' };
      });

    limitedProfile.contactEntries = filteredEntries;

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

    console.log(`✅ Returning preview for token: ${token}, entries: ${filteredEntries.length}, backgroundColors:`, limitedProfile.backgroundColors);
    return NextResponse.json({
      success: true,
      profile: limitedProfile,
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
