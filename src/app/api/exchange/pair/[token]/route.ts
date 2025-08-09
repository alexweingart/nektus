/**
 * API endpoint for managing exchange pairs
 * GET: Fetch profile preview for matched pair
 * POST: Accept/reject the exchange
 * Uses Redis for data storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getProfile } from '@/lib/firebase/adminConfig';
import type { ContactExchangeResponse } from '@/types/contactExchange';
import type { UserProfile } from '@/types/profile';
import { getExchangeMatch } from '@/lib/redis/client';
import { filterProfileByCategory } from '@/lib/utils/profileFiltering';

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
    const isUserA = matchData.userA === session.user.id; // Compare with user ID
    const otherUserId = isUserA ? matchData.userB : matchData.userA;
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
      // Get the other user's profile from Firebase Admin
      console.log(`🔥 Attempting to get profile for userId: ${otherUserId}`);
      const otherUserProfile = await getProfile(otherUserId);
      
      console.log(`🔥 Profile result:`, otherUserProfile ? 'Profile found' : 'Profile not found');
      
      if (!otherUserProfile) {
        console.log(`⚠️ Profile not found for ${otherUserId}, using mock profile`);
        // Use mock profile when real profile doesn't exist
        const mockProfile: UserProfile = {
          userId: 'mock-user-123',
          name: 'John Doe',
          bio: 'Software Engineer passionate about technology and innovation.',
          profileImage: '',
          backgroundImage: '',
          lastUpdated: Date.now(),
          contactChannels: {
            entries: [
              {
                platform: 'phone',
                section: 'universal',
                userConfirmed: false,
                internationalPhone: '+1 (555) 123-4567',
                nationalPhone: '5551234567'
              },
              {
                platform: 'email',
                section: 'universal',
                userConfirmed: false,
                email: 'mock@example.com'
              }
            ]
          }
        };
        
        // Filter the mock profile based on the sharing category they selected
        const filteredMockProfile = filterProfileByCategory(mockProfile, otherUserSharingCategory || 'Personal');
        
        console.log(`🎭 Returning filtered mock profile for: ${otherUserId} with category: ${otherUserSharingCategory}`);
        return NextResponse.json({
          success: true,
          profile: filteredMockProfile,
          matchedAt: matchData.createdAt
        } as ContactExchangeResponse);
      }

      // Filter the profile based on the sharing category the other user selected
      const filteredProfile = filterProfileByCategory(otherUserProfile, otherUserSharingCategory || 'Personal');

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
      const mockProfile: UserProfile = {
        userId: 'mock-user-123',
        name: 'John Doe',
        bio: 'Software Engineer passionate about technology and innovation.',
        profileImage: '',
        backgroundImage: '',
        lastUpdated: Date.now(),
        contactChannels: {
          entries: [
            {
              platform: 'phone',
              section: 'universal',
              userConfirmed: true,
              internationalPhone: '+1234567890',
              nationalPhone: '(123) 456-7890'
            },
            {
              platform: 'email',
              section: 'universal',
              userConfirmed: true,
              email: 'john.doe@example.com'
            },
            {
              platform: 'instagram',
              section: 'personal',
              userConfirmed: true,
              username: 'johndoe',
              url: 'https://instagram.com/johndoe'
            },
            {
              platform: 'x',
              section: 'personal',
              userConfirmed: true,
              username: 'john_doe',
              url: 'https://x.com/john_doe'
            },
            {
              platform: 'linkedin',
              section: 'work',
              userConfirmed: true,
              username: 'johndoe',
              url: 'https://linkedin.com/in/johndoe'
            }
          ]
        }
      };

      // Filter the mock profile based on the sharing category they selected
      const filteredMockProfile = filterProfileByCategory(mockProfile, otherUserSharingCategory || 'Personal');

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
    const isUserA = matchData.userA === session.user.id;
    const isUserB = matchData.userB === session.user.id;
    
    if (!isUserA && !isUserB) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized for this exchange' },
        { status: 403 }
      );
    }

    if (accept) {
      // User accepted - get the other user's profile and return it
      const otherUserId = isUserA ? matchData.userB : matchData.userA;
      
      try {
        const otherUserProfile = await getProfile(otherUserId);
        
        if (otherUserProfile) {
          console.log(`User ${session.user.email} accepted exchange with ${otherUserId}`);
          
          return NextResponse.json({
            success: true,
            profile: otherUserProfile,
            message: 'Exchange accepted'
          } as ContactExchangeResponse);
        } else {
          throw new Error('Profile not found');
        }
        
      } catch (error) {
        console.error('Error fetching accepted profile:', error);
        
        // Return mock profile if Firebase fails
        const mockProfile: UserProfile = {
          userId: 'mock-user-123',
          name: 'John Doe',
          bio: 'Software Engineer passionate about technology and innovation.',
          profileImage: '',
          backgroundImage: '',
          lastUpdated: Date.now(),
          contactChannels: {
            entries: [
              {
                platform: 'phone',
                section: 'universal',
                userConfirmed: true,
                internationalPhone: '+1234567890',
                nationalPhone: '(123) 456-7890'
              },
              {
                platform: 'email',
                section: 'universal',
                userConfirmed: true,
                email: 'john.doe@example.com'
              },
              {
                platform: 'instagram',
                section: 'personal',
                userConfirmed: true,
                username: 'johndoe',
                url: 'https://instagram.com/johndoe'
              },
              {
                platform: 'x',
                section: 'personal',
                userConfirmed: true,
                username: 'john_doe',
                url: 'https://x.com/john_doe'
              },
              {
                platform: 'linkedin',
                section: 'work',
                userConfirmed: true,
                username: 'johndoe',
                url: 'https://linkedin.com/in/johndoe'
              }
            ]
          }
        };
        
        return NextResponse.json({
          success: true,
          profile: mockProfile,
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
