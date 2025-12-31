/**
 * API endpoint for managing exchange pairs
 * GET: Fetch profile preview for matched pair
 * POST: Accept/reject the exchange
 * Uses Redis for data storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import type { ContactExchangeResponse } from '@/types/contactExchange';
import type { UserProfile } from '@/types/profile';
import { getExchangeMatch } from '@/server/contacts/matching';
import { filterProfileByCategory } from '@/client/profile/filtering';

/**
 * Creates a mock profile for development/testing purposes
 */
function createMockProfile(includeExtendedData = true): UserProfile {
  const baseEntries = [
    {
      fieldType: 'name',
      value: 'John Doe',
      section: 'universal' as const,
      order: -2,
      isVisible: true,
      confirmed: true
    },
    {
      fieldType: 'bio',
      value: 'Software Engineer passionate about technology and innovation.',
      section: 'universal' as const,
      order: -1,
      isVisible: true,
      confirmed: true
    },
    {
      fieldType: 'phone',
      value: '1234567890',
      section: 'universal' as const,
      order: 0,
      isVisible: true,
      confirmed: true
    },
    {
      fieldType: 'email',
      value: 'john.doe@example.com',
      section: 'universal' as const,
      order: 1,
      isVisible: true,
      confirmed: true
    }
  ];

  const extendedEntries = includeExtendedData ? [
    {
      fieldType: 'instagram',
      value: 'johndoe',
      section: 'personal' as const,
      order: 2,
      isVisible: true,
      confirmed: true
    },
    {
      fieldType: 'x',
      value: 'john_doe',
      section: 'personal' as const,
      order: 3,
      isVisible: true,
      confirmed: true
    },
    {
      fieldType: 'linkedin',
      value: 'johndoe',
      section: 'work' as const,
      order: 4,
      isVisible: true,
      confirmed: true
    }
  ] : [];

  return {
    userId: 'mock-user-123',
    profileImage: '',
    backgroundImage: '',
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
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
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

    console.log(`👤 User ${session.user.email} requesting pair data for token: ${token}`);

    // Get match data from Redis
    const matchData = await getExchangeMatch(token);
    if (!matchData) {
      console.log(`❌ No match data found for token: ${token}`);
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    console.log(`📋 Match data found:`, matchData);

    // Determine which user this is and get the other user's profile and sharing category
    const isUserA = matchData.userA.userId === session.user.id; // Compare with user ID
    const otherUserId = isUserA ? matchData.userB.userId : matchData.userA.userId;
    const otherUserSharingCategory = isUserA ? matchData.sharingCategoryB : matchData.sharingCategoryA;
    
    console.log(`🔍 Current user: ${session.user.email} (ID: ${session.user.id}), isUserA: ${isUserA}, otherUserId: ${otherUserId}, otherUserSharingCategory: ${otherUserSharingCategory}`);
    
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
      const otherUserProfile = isUserA ? matchData.userB : matchData.userA;
      
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
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

    // Verify user is part of this exchange (compare user IDs, not emails)
    const isUserA = matchData.userA.userId === session.user.id;
    const isUserB = matchData.userB.userId === session.user.id;
    
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
          console.log(`User ${session.user.email} accepted exchange with ${otherUserId} (sharing: ${otherUserSharingCategory})`);

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
      console.log(`User ${session.user.email} rejected exchange with token ${token}`);
      
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
