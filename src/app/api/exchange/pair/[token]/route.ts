/**
 * API endpoint for managing exchange pairs
 * GET: Fetch profile preview for matched pair
 * POST: Accept/reject the exchange
 * Uses Redis for match data storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { ProfileService } from '@/lib/firebase/profileService';
import type { ContactExchangeResponse } from '@/types/contactExchange';
import type { UserProfile } from '@/types/profile';
import { getExchangeMatch } from '@/lib/redis/client';

/**
 * GET /api/exchange/pair/[token]
 * Fetch the profile preview for a matched exchange
 */
export async function GET(
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

    // Determine which user this is and get the other user's profile
    const isUserA = matchData.userA === session.user.email;
    const otherUserEmail = isUserA ? matchData.userB : matchData.userA;
    
    if (!otherUserEmail) {
      return NextResponse.json(
        { success: false, message: 'Other user not found' },
        { status: 404 }
      );
    }

    try {
      // Get the other user's profile from Firebase
      const otherUserProfile = await ProfileService.getProfile(otherUserEmail);
      
      if (!otherUserProfile) {
        return NextResponse.json(
          { success: false, message: 'Other user profile not found' },
          { status: 404 }
        );
      }

      // Return the profile (with sensitive data filtered)
      const publicProfile: UserProfile = {
        userId: otherUserProfile.userId,
        name: otherUserProfile.name,
        bio: otherUserProfile.bio,
        profileImage: otherUserProfile.profileImage,
        backgroundImage: otherUserProfile.backgroundImage,
        lastUpdated: otherUserProfile.lastUpdated,
        contactChannels: otherUserProfile.contactChannels
      };

      return NextResponse.json({
        success: true,
        profile: publicProfile,
        matchedAt: matchData.timestamp
      } as ContactExchangeResponse);

    } catch (error) {
      console.error('Error fetching profile:', error);
      
      // Return a mock profile if Firebase fails (for development)
      const mockProfile: UserProfile = {
        userId: 'mock-user-123',
        name: 'John Doe',
        bio: 'Software Engineer passionate about technology and innovation.',
        profileImage: '',
        backgroundImage: '',
        lastUpdated: Date.now(),
        contactChannels: {
          phoneInfo: {
            internationalPhone: '+1234567890',
            nationalPhone: '(123) 456-7890',
            userConfirmed: true
          },
          email: {
            email: 'john.doe@example.com',
            userConfirmed: true
          },
          facebook: { username: '', url: '', userConfirmed: false },
          instagram: { username: 'johndoe', url: 'https://instagram.com/johndoe', userConfirmed: true },
          x: { username: 'john_doe', url: 'https://x.com/john_doe', userConfirmed: true },
          linkedin: { username: 'johndoe', url: 'https://linkedin.com/in/johndoe', userConfirmed: true },
          snapchat: { username: '', url: '', userConfirmed: false },
          whatsapp: { username: '', url: '', userConfirmed: false },
          telegram: { username: '', url: '', userConfirmed: false },
          wechat: { username: '', url: '', userConfirmed: false }
        }
      };

      return NextResponse.json({
        success: true,
        profile: mockProfile,
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

    // Verify user is part of this exchange
    const isUserA = matchData.userA === session.user.email;
    const isUserB = matchData.userB === session.user.email;
    
    if (!isUserA && !isUserB) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized for this exchange' },
        { status: 403 }
      );
    }

    if (accept) {
      // User accepted - get the other user's profile and return it
      const otherUserEmail = isUserA ? matchData.userB : matchData.userA;
      
      try {
        const otherUserProfile = await ProfileService.getProfile(otherUserEmail);
        
        if (otherUserProfile) {
          // TODO: Notify the other user via real-time connection
          console.log(`User ${session.user.email} accepted exchange with ${otherUserEmail}`);
          
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
            phoneInfo: {
              internationalPhone: '+1234567890',
              nationalPhone: '(123) 456-7890',
              userConfirmed: true
            },
            email: {
              email: 'john.doe@example.com',
              userConfirmed: true
            },
            facebook: { username: '', url: '', userConfirmed: false },
            instagram: { username: 'johndoe', url: 'https://instagram.com/johndoe', userConfirmed: true },
            x: { username: 'john_doe', url: 'https://x.com/john_doe', userConfirmed: true },
            linkedin: { username: 'johndoe', url: 'https://linkedin.com/in/johndoe', userConfirmed: true },
            snapchat: { username: '', url: '', userConfirmed: false },
            whatsapp: { username: '', url: '', userConfirmed: false },
            telegram: { username: '', url: '', userConfirmed: false },
            wechat: { username: '', url: '', userConfirmed: false }
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
      // TODO: Notify the other user via real-time connection
      console.log(`User ${session.user.email} rejected exchange`);
      
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
