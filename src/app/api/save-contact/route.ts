/**
 * API endpoint for saving contacts after successful exchange
 * POST: Save contact to both Firebase and Google Contacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getProfile, getFirebaseAdmin } from '@/lib/firebase/adminConfig';
import { saveToGoogleContacts } from '@/lib/services/server/googleContactsService';
import { getExchangeMatch } from '@/lib/redis/client';
import { getContactsAccessToken } from '@/lib/services/server/serverIncrementalAuthService';
import type { ContactSaveResult } from '@/types/contactExchange';
import type { UserProfile } from '@/types/profile';

/**
 * Get Google Contacts access token - try incremental auth first, fallback to session
 */
async function getGoogleContactsToken(session: { accessToken?: string }, userId: string): Promise<string | null> {
  console.log('🔍 Token retrieval: Getting Google Contacts token for user:', userId);
  
  // First try incremental auth token (has contacts permission)
  const incrementalToken = await getContactsAccessToken(userId);
  console.log('🔍 Token retrieval: Incremental token result:', incrementalToken ? 'Found' : 'Not found');
  
  if (incrementalToken) {
    console.log('✅ Token retrieval: Using incremental auth token for Google Contacts');
    return incrementalToken;
  }
  
  // Fallback to session token (if user originally granted contacts permission)
  console.log('🔍 Token retrieval: Session access token:', session.accessToken ? 'Found' : 'Not found');
  
  if (session.accessToken) {
    console.log('ℹ️ Token retrieval: Using session token for Google Contacts (fallback)');
    return session.accessToken;
  }
  
  console.log('❌ Token retrieval: No Google Contacts access token available');
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { 
      token, 
      skipGoogleContacts = false, 
      skipFirebase = false,
      googleOnly = false 
    } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Exchange token required' },
        { status: 400 }
      );
    }

    console.log(`💾 Saving contact for user ${session.user.id} with token: ${token}`, {
      skipGoogleContacts,
      skipFirebase,
      googleOnly
    });

    // For Google-only requests, we still need to get the profile but skip exchange verification
    // (since the exchange was already processed during the Firebase save)
    let contactProfile;
    
    if (googleOnly) {
      // For Google-only saves, we expect the profile to be stored in session state or passed directly
      // For now, we'll still verify the exchange but won't require it to be active
      const matchData = await getExchangeMatch(token);
      if (matchData) {
        const isUserA = matchData.userA.userId === session.user.id;
        const isUserB = matchData.userB.userId === session.user.id;
        
        if (isUserA || isUserB) {
          const otherUserId = isUserA ? matchData.userB.userId : matchData.userA.userId;
          const rawProfile = await getProfile(otherUserId);
          contactProfile = rawProfile as unknown as UserProfile;
        }
      }
      
      if (!contactProfile) {
        return NextResponse.json(
          { success: false, message: 'Contact profile not found for Google-only save' },
          { status: 404 }
        );
      }
    } else {
      // Standard flow - verify exchange and get profile
      const matchData = await getExchangeMatch(token);
      if (!matchData) {
        return NextResponse.json(
          { success: false, message: 'Invalid or expired exchange token' },
          { status: 404 }
        );
      }

      // Verify user is part of this exchange
      const isUserA = matchData.userA.userId === session.user.id;
      const isUserB = matchData.userB.userId === session.user.id;
      
      if (!isUserA && !isUserB) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized for this exchange' },
          { status: 403 }
        );
      }

      // Get the other user's profile
      const otherUserId = isUserA ? matchData.userB.userId : matchData.userA.userId;
      const rawProfile = await getProfile(otherUserId);
      contactProfile = rawProfile as unknown as UserProfile;
      
      if (!contactProfile) {
        return NextResponse.json(
          { success: false, message: 'Contact profile not found' },
          { status: 404 }
        );
      }
    }

    // Prepare the result object
    const result: ContactSaveResult = {
      success: false,
      firebase: { success: false },
      google: { success: false },
      contact: contactProfile as UserProfile
    };

    // Save to Firebase using Admin SDK (unless skipped or Google-only mode)
    if (!skipFirebase && !googleOnly) {
      try {
        const { db } = await getFirebaseAdmin();
        
        const savedContact = {
          ...contactProfile,
          addedAt: Date.now(),
          matchToken: token
        };
        
        // Use the contact's userId as the document ID to prevent duplicates
        const contactRef = db.collection('profiles').doc(session.user.id).collection('contacts').doc((contactProfile as UserProfile).userId);
        await contactRef.set(savedContact);
        
        result.firebase.success = true;
        console.log('✅ Contact saved to Firebase using Admin SDK');
      } catch (error) {
        result.firebase.error = error instanceof Error ? error.message : 'Firebase save failed';
        console.error('❌ Firebase save failed:', error);
      }
    } else if (skipFirebase) {
      result.firebase.success = true;
      result.firebase.error = 'Firebase save skipped';
      console.log('ℹ️ Skipping Firebase save - explicitly disabled');
    } else if (googleOnly) {
      // For Google-only mode, assume Firebase was already successful
      result.firebase.success = true;
      result.firebase.error = 'Firebase save not needed (Google-only mode)';
      console.log('ℹ️ Skipping Firebase save - Google-only mode');
    }

    // Save to Google Contacts (if not skipping and either Firebase succeeded or Google-only mode)
    if (!skipGoogleContacts && (result.firebase.success || googleOnly)) {
      console.log('🔍 Google save: Attempting Google Contacts save...');
      const googleToken = await getGoogleContactsToken(session, session.user.id);
      
      if (googleToken) {
        console.log('🔍 Google save: Found Google token, calling saveToGoogleContacts...');
        try {
          const googleResult = await saveToGoogleContacts(googleToken, contactProfile as UserProfile);
          result.google.success = googleResult.success;
          result.google.contactId = googleResult.contactId;
          result.google.error = googleResult.error;
          
          console.log('🔍 Google save: Google Contacts API result:', JSON.stringify(googleResult));
          
          if (googleResult.success) {
            console.log('✅ Contact saved to Google Contacts');
          } else {
            console.warn('⚠️ Google Contacts save failed:', googleResult.error);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Google Contacts save failed';
          result.google.error = errorMessage;
          console.error('❌ Google Contacts save failed:', error);
          console.log('🔍 Google save: Exception error message set to:', errorMessage);
        }
      } else {
        console.log('🔍 Google save: No Google token found, setting error message...');
        result.google.error = 'No Google Contacts access token available';
        console.log('🔍 Google save: Error message set to:', result.google.error);
        console.warn('⚠️ Skipping Google Contacts save - no access token');
      }
    } else if (skipGoogleContacts) {
      result.google.error = 'Google Contacts save skipped';
      console.log('ℹ️ Skipping Google Contacts save - explicitly disabled');
    }

    // Overall success logic depends on mode
    if (googleOnly) {
      // For Google-only mode, success depends on Google Contacts save
      result.success = result.google.success;
    } else {
      // For standard mode, success if at least Firebase succeeded
      result.success = result.firebase.success;
    }

    const statusCode = result.success ? 200 : 500;
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('❌ Contact save endpoint error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        firebase: { success: false, error: 'Server error' },
        google: { success: false, error: 'Server error' }
      } as ContactSaveResult,
      { status: 500 }
    );
  }
}
