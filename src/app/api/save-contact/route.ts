/**
 * API endpoint for saving contacts after successful exchange
 * POST: Save contact to both Firebase and Google Contacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getProfile, getFirebaseAdmin } from '@/lib/firebase/adminConfig';
import { saveToGoogleContacts } from '@/lib/services/googleContactsService';
import { getExchangeMatch } from '@/lib/redis/client';
import { getContactsAccessToken } from '@/lib/services/incrementalAuthService';
import type { ContactSaveResult } from '@/types/contactExchange';

/**
 * Get Google Contacts access token - try incremental auth first, fallback to session
 */
async function getGoogleContactsToken(session: any, userId: string): Promise<string | null> {
  // First try incremental auth token (has contacts permission)
  const incrementalToken = await getContactsAccessToken(userId);
  if (incrementalToken) {
    console.log('✅ Using incremental auth token for Google Contacts');
    return incrementalToken;
  }
  
  // Fallback to session token (if user originally granted contacts permission)
  if (session.accessToken) {
    console.log('ℹ️ Using session token for Google Contacts (fallback)');
    return session.accessToken;
  }
  
  console.log('❌ No Google Contacts access token available');
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
        const isUserA = matchData.userA === session.user.id;
        const isUserB = matchData.userB === session.user.id;
        
        if (isUserA || isUserB) {
          const otherUserId = isUserA ? matchData.userB : matchData.userA;
          contactProfile = await getProfile(otherUserId);
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
      const isUserA = matchData.userA === session.user.id;
      const isUserB = matchData.userB === session.user.id;
      
      if (!isUserA && !isUserB) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized for this exchange' },
          { status: 403 }
        );
      }

      // Get the other user's profile
      const otherUserId = isUserA ? matchData.userB : matchData.userA;
      contactProfile = await getProfile(otherUserId);
      
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
      contact: contactProfile
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
        const contactRef = db.collection('profiles').doc(session.user.id).collection('contacts').doc(contactProfile.userId);
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
      const googleToken = await getGoogleContactsToken(session, session.user.id);
      
      if (googleToken) {
        try {
          const googleResult = await saveToGoogleContacts(googleToken, contactProfile);
          result.google.success = googleResult.success;
          result.google.contactId = googleResult.contactId;
          result.google.error = googleResult.error;
          
          if (googleResult.success) {
            console.log('✅ Contact saved to Google Contacts');
          } else {
            console.warn('⚠️ Google Contacts save failed:', googleResult.error);
          }
        } catch (error) {
          result.google.error = error instanceof Error ? error.message : 'Google Contacts save failed';
          console.error('❌ Google Contacts save failed:', error);
        }
      } else {
        result.google.error = 'No Google Contacts access token available';
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
