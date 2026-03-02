/**
 * API endpoint for managing exchange pairs
 * GET: Fetch profile preview for matched pair
 * POST: Accept/reject the exchange
 * Uses Redis for data storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/auth/get-authenticated-user';
import type { ContactExchangeResponse } from '@/types/contactExchange';
import type { UserProfile } from '@/types/profile';
import { getExchangeMatch } from '@/server/contacts/matching';
import { filterProfileByCategory } from '@/client/profile/filtering';
import { redis } from '@/server/config/redis';
import { getProfile } from '@/server/config/firebase';

/**
 * Creates a mock profile for development/testing purposes
 */
function createMockProfile(includeExtendedData = true): UserProfile {
  const baseEntries = [
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
    },
    {
      fieldType: 'phone',
      value: '+1234567890',
      section: 'personal' as const,
      order: 2,
      isVisible: true,
      confirmed: true
    },
    {
      fieldType: 'email',
      value: 'demo@example.com',
      section: 'personal' as const,
      order: 3,
      isVisible: true,
      confirmed: true
    }
  ];

  const extendedEntries = includeExtendedData ? [
    {
      fieldType: 'instagram',
      value: 'democontact',
      section: 'personal' as const,
      order: 4,
      isVisible: true,
      confirmed: true
    },
    {
      fieldType: 'x',
      value: 'democontact',
      section: 'personal' as const,
      order: 5,
      isVisible: true,
      confirmed: true
    }
  ] : [];

  return {
    userId: 'mock-user-123',
    shortCode: 'mocktest',
    profileImage: 'https://www.nekt.us/demo-robot-avatar.png',
    backgroundImage: '',
    backgroundColors: ['#FF6F61', '#FFB6C1', '#FF1493'],
    lastUpdated: Date.now(),
    contactEntries: [...baseEntries, ...extendedEntries]
  };
}

/**
 * GET /api/exchange/pair/[token]
 * Get the matched user's profile (filtered by their sharing category)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await context.params;
    console.log(`🔍 Pair GET request for token: ${token}`);

    // Authenticate user (supports both NextAuth sessions and Firebase Bearer tokens)
    const user = await getAuthenticatedUser(request);
    if (!user) {
      console.log(`❌ Authentication required for token: ${token}`);
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!token) {
      console.log(`❌ Token required`);
      return NextResponse.json(
        { success: false, message: 'Token required' },
        { status: 400 }
      );
    }

    console.log(`👤 User ${user.id} (${user.source}) requesting pair data for token: ${token}`);

    // Permanent demo token for App Clip testing — bypasses Redis entirely
    if (token === 'demo') {
      const mockProfile = createMockProfile();
      return NextResponse.json({
        success: true,
        profile: mockProfile,
        matchedAt: Date.now()
      } as ContactExchangeResponse);
    }

    // Get match data from Redis
    let matchData = await getExchangeMatch(token);

    // Check if this is a waiting exchange (QR scan scenario)
    if (matchData && matchData.status === 'waiting' && matchData.userB === null && redis) {
      console.log(`🔍 Found waiting exchange, checking if this is User B scanning...`);
      const matchKey = `exchange_match:${token}`;

      // This is a QR scan - User B is creating the match
      const waitingMatch = matchData;

      // IMPORTANT: Check if current user is User A (original QR shower)
      // If so, they should NOT create the match - they're just viewing their own QR result
      const isUserA = waitingMatch.userA.userId === user.id;

      if (isUserA) {
        console.log(`⚠️ User A (${user.id}) is viewing their own waiting exchange - not creating match`);
        // Return waiting status - no match yet
        return NextResponse.json(
          { success: false, message: 'Waiting for someone to scan your QR code' },
          { status: 404 }
        );
      }

      console.log(`🔓 QR scan detected! User B (${user.id}) is creating match`);

      // Re-fetch match data to check for race condition (another scanner may have completed first)
      const freshMatchDataStr = await redis.get(matchKey);
      if (freshMatchDataStr) {
        const freshMatchData = typeof freshMatchDataStr === 'string' ? JSON.parse(freshMatchDataStr) : freshMatchDataStr;
        if (freshMatchData.status !== 'waiting' || freshMatchData.userB !== null) {
          console.log(`⚠️ Race condition detected - exchange already completed by another scanner`);
          return NextResponse.json(
            { success: false, message: 'This QR code was already scanned by someone else', code: 'ALREADY_SCANNED' },
            { status: 409 }
          );
        }
      }

      // Scanner is creating the match - get scanner's profile
      const scannerProfile = await getProfile(user.id);
      if (!scannerProfile) {
        console.error(`❌ Scanner profile not found for user: ${user.id}`);
        return NextResponse.json(
          { success: false, message: 'Scanner profile not found' },
          { status: 404 }
        );
      }

      // Note: Previously stripped all googleusercontent.com profile images,
      // but this incorrectly removed real Google profile photos.
      // The avatar generation pipeline handles users without photos separately.

      const scannerSharingCategory = 'All'; // Default for QR scan

      // Update the match with scanner's data
      waitingMatch.sessionB = `scan_${Date.now()}`;
      waitingMatch.userB = scannerProfile as unknown as UserProfile;
      waitingMatch.sharingCategoryB = scannerSharingCategory;
      waitingMatch.status = 'matched';
      waitingMatch.scanStatus = 'completed'; // Mark scan as completed (signed-in user)

      // Save updated match
      await redis.setex(matchKey, 600, JSON.stringify(waitingMatch));
      console.log(`✅ Updated match in Redis for token: ${token}`);

      // Update session mapping for original user's polling to discover match
      await redis.setex(
        `exchange_session:${waitingMatch.sessionA}`,
        600,
        token
      );
      console.log(`✅ Updated session mapping for original user to discover match`);

      // Use updated match data
      matchData = waitingMatch;
    }

    if (!matchData) {
      console.log(`❌ No match data found for token: ${token}`);
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    console.log(`📋 Match data found:`, matchData);

    // Check if match is complete (userB exists)
    if (!matchData.userB) {
      console.log(`❌ Match not yet complete (waiting for scan) for token: ${token}`);
      return NextResponse.json(
        { success: false, message: 'Exchange not yet complete' },
        { status: 400 }
      );
    }

    // Determine which user this is and get the other user's profile and sharing category
    const isUserA2 = matchData.userA.userId === user.id; // Compare with user ID
    const otherUserId = isUserA2 ? matchData.userB.userId : matchData.userA.userId;
    const otherUserSharingCategory = isUserA2 ? matchData.sharingCategoryB : matchData.sharingCategoryA;

    console.log(`🔍 Current user: ${user.id} (${user.source}), isUserA: ${isUserA2}, otherUserId: ${otherUserId}, otherUserSharingCategory: ${otherUserSharingCategory}`);
    
    if (!otherUserId) {
      console.log(`❌ Other user not found in match data for token: ${token}`);
      return NextResponse.json(
        { success: false, message: 'Other user not found' },
        { status: 404 }
      );
    }

    try {
      // Get the other user's profile from the match data (already available)
      console.log(`🔥 Getting profile for userId: ${otherUserId}`);
      const otherUserProfile = isUserA2 ? matchData.userB : matchData.userA;
      
      console.log(`🔥 Profile result:`, otherUserProfile ? 'Profile found' : 'Profile not found');
      
      if (!otherUserProfile) {
        console.log(`⚠️ Profile not found for ${otherUserId}, using mock profile`);
        // Use mock profile when real profile doesn't exist
        const mockProfile = createMockProfile(false);
        
        // Filter the mock profile based on the sharing category they selected
        const category = (otherUserSharingCategory === 'All' || !otherUserSharingCategory) ? 'Personal' : otherUserSharingCategory as 'Personal' | 'Work';
        const filteredMockProfile = filterProfileByCategory(mockProfile, category);
        
        console.log(`🎭 Returning filtered mock profile for: ${otherUserId} with category: ${otherUserSharingCategory}`);
        return NextResponse.json({
          success: true,
          profile: filteredMockProfile,
          matchedAt: matchData.timestamp
        } as ContactExchangeResponse);
      }

      // Filter the profile based on the sharing category the other user selected
      const category2 = (otherUserSharingCategory === 'All' || !otherUserSharingCategory) ? 'Personal' : otherUserSharingCategory as 'Personal' | 'Work';
      const filteredProfile = filterProfileByCategory(otherUserProfile, category2);

      console.log(`✅ Successfully returning filtered profile for: ${otherUserId} with category: ${otherUserSharingCategory}`);
      return NextResponse.json({
        success: true,
        profile: filteredProfile,
        matchedAt: matchData.timestamp
      } as ContactExchangeResponse);

    } catch (error) {
      console.error(`❌ Error fetching profile for ${otherUserId}:`, error);
      
      console.log(`🎭 Returning mock profile due to Firebase error for: ${otherUserId}`);
      // Return a mock profile if Firebase fails (for development)
      const mockProfile = createMockProfile();

      // Filter the mock profile based on the sharing category they selected
      const category3 = (otherUserSharingCategory === 'All' || !otherUserSharingCategory) ? 'Personal' : otherUserSharingCategory as 'Personal' | 'Work';
      const filteredMockProfile = filterProfileByCategory(mockProfile, category3);

      return NextResponse.json({
        success: true,
        profile: filteredMockProfile,
        matchedAt: matchData.timestamp,
        note: 'Using mock profile due to Firebase error'
      } as ContactExchangeResponse);
    }

  } catch (error) {
    console.error('Exchange pair GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/exchange/pair/[token]
 * Accept or reject the exchange
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await context.params;

    // Authenticate user (supports both NextAuth sessions and Firebase Bearer tokens)
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { accept } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token required' },
        { status: 400 }
      );
    }

    // Get match data from Redis
    const matchData = await getExchangeMatch(token);
    if (!matchData) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Check if match is complete
    if (!matchData.userB) {
      return NextResponse.json(
        { success: false, message: 'Exchange not yet complete' },
        { status: 400 }
      );
    }

    // Verify user is part of this exchange (compare user IDs)
    const isUserA = matchData.userA.userId === user.id;
    const isUserB = matchData.userB.userId === user.id;

    if (!isUserA && !isUserB) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized for this exchange' },
        { status: 403 }
      );
    }

    if (accept) {
      // User accepted - get the other user's profile and return it
      const otherUserProfile = isUserA ? matchData.userB : matchData.userA;
      const otherUserId = otherUserProfile.userId;
      const otherUserSharingCategory = isUserA ? matchData.sharingCategoryB : matchData.sharingCategoryA;

      try {

        if (otherUserProfile) {
          console.log(`User ${user.id} accepted exchange with ${otherUserId} (sharing: ${otherUserSharingCategory})`);

          // Filter the profile based on the sharing category the other user selected
          const category = (otherUserSharingCategory === 'All' || !otherUserSharingCategory) ? 'Personal' : otherUserSharingCategory as 'Personal' | 'Work';
          const filteredProfile = filterProfileByCategory(otherUserProfile, category);

          return NextResponse.json({
            success: true,
            profile: filteredProfile,
            message: 'Exchange accepted'
          } as ContactExchangeResponse);
        } else {
          throw new Error('Profile not found');
        }

      } catch (error) {
        console.error('Error fetching accepted profile:', error);

        // Return mock profile if Firebase fails
        const mockProfile = createMockProfile();

        // Filter the mock profile based on the sharing category they selected
        const category = (otherUserSharingCategory === 'All' || !otherUserSharingCategory) ? 'Personal' : otherUserSharingCategory as 'Personal' | 'Work';
        const filteredMockProfile = filterProfileByCategory(mockProfile, category);

        return NextResponse.json({
          success: true,
          profile: filteredMockProfile,
          message: 'Exchange accepted (using mock profile)'
        } as ContactExchangeResponse);
      }

    } else {
      // User rejected
      console.log(`User ${user.id} rejected exchange with token ${token}`);
      
      return NextResponse.json({
        success: true,
        message: 'Exchange rejected'
      } as ContactExchangeResponse);
    }

  } catch (error) {
    console.error('Exchange pair POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
