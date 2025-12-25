/**
 * Google OAuth callback for incremental authorization
 * This handles the response from Google after user grants/denies contacts permission
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { 
  getIncrementalAuthState, 
  deleteIncrementalAuthState, 
  storeContactsAccessToken 
} from '@/lib/server/auth/google-incremental';

export async function GET(request: NextRequest) {
  try {
    // Verify user is still authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.warn('⚠️ Incremental auth callback without authenticated session');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=not_authenticated`);
    }

    // Extract OAuth response parameters
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    console.log(`🔄 Incremental auth callback for user ${session.user.id}`, {
      hasCode: !!code,
      hasState: !!state,
      error,
      errorDescription
    });

    // Handle user cancellation or denial
    if (error === 'access_denied') {
      console.log(`❌ User denied Google Contacts permission: ${session.user.id}`);

      // Get the auth state to retrieve the original returnUrl
      const state = url.searchParams.get('state');
      let returnUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

      if (state) {
        try {
          const stateData = await getIncrementalAuthState(state);
          if (stateData && stateData.returnUrl) {
            returnUrl = stateData.returnUrl;
            console.log(`📍 Using stored return URL for denial: ${returnUrl}`);
            // Clean up auth state after denial
            await deleteIncrementalAuthState(state);
          }
        } catch (error) {
          console.warn('⚠️ Failed to retrieve auth state for denial, using fallback URL:', error);
        }
      }

      // Build return URL with denial parameter
      const denialUrl = new URL(returnUrl);
      denialUrl.searchParams.set('incremental_auth', 'denied');

      console.log(`🔙 Redirecting to original page after denial: ${denialUrl.toString()}`);
      return NextResponse.redirect(denialUrl.toString());
    }

    // Handle silent auth failures - retry with consent
    if (error === 'interaction_required' || error === 'consent_required' || error === 'login_required') {
      console.log(`🔄 Silent auth failed (${error}), retrying with consent for user ${session.user.id}`);
      
      // Try to get state data for retry parameters
      let retryParams = {
        returnUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/connect`,
        contactSaveToken: '',
        profileId: ''
      };
      
      if (state) {
        const stateData = await getIncrementalAuthState(state);
        if (stateData) {
          retryParams = {
            returnUrl: stateData.returnUrl,
            contactSaveToken: stateData.contactSaveToken,
            profileId: stateData.profileId
          };
          // Clean up the failed state
          await deleteIncrementalAuthState(state);
        }
      }
      
      // Retry with consent prompt
      const requestUrl = new URL(request.url);
      const currentPort = requestUrl.port || '3000';
      const nextAuthUrl = process.env.NEXTAUTH_URL || `http://localhost:${currentPort}`;

      // Build retry URL with attempt=explicit (Android-friendly)
      const retryUrl = new URL(`${nextAuthUrl}/api/auth/google-incremental`);
      retryUrl.searchParams.set('returnUrl', retryParams.returnUrl);
      retryUrl.searchParams.set('contactSaveToken', retryParams.contactSaveToken);
      retryUrl.searchParams.set('profileId', retryParams.profileId);
      retryUrl.searchParams.set('attempt', 'explicit');
      
      return NextResponse.redirect(retryUrl.toString());
    }

    // Handle other OAuth errors
    if (error) {
      console.error('❌ OAuth error in incremental auth callback:', { error, errorDescription });
      const requestUrl = new URL(request.url);
      const currentPort = requestUrl.port || '3000';
      const nextAuthUrl = process.env.NEXTAUTH_URL || `http://localhost:${currentPort}`;
      return NextResponse.redirect(`${nextAuthUrl}/?error=oauth_error&details=${encodeURIComponent(errorDescription || error)}`);
    }

    // Validate required parameters
    if (!code || !state) {
      console.warn('⚠️ Incremental auth callback missing required parameters:', { code: !!code, state: !!state });
      const requestUrl = new URL(request.url);
      const currentPort = requestUrl.port || '3000';
      const nextAuthUrl = process.env.NEXTAUTH_URL || `http://localhost:${currentPort}`;
      return NextResponse.redirect(`${nextAuthUrl}/?error=invalid_callback`);
    }

    // Retrieve and validate auth state
    const stateData = await getIncrementalAuthState(state);
    if (!stateData) {
      console.warn('⚠️ Invalid or expired auth state:', state);
      const requestUrl = new URL(request.url);
      const currentPort = requestUrl.port || '3000';
      const nextAuthUrl = process.env.NEXTAUTH_URL || `http://localhost:${currentPort}`;
      return NextResponse.redirect(`${nextAuthUrl}/?error=invalid_state`);
    }

    // Verify state belongs to current user
    if (stateData.userId !== session.user.id) {
      console.warn('⚠️ Auth state user mismatch:', { stateUserId: stateData.userId, sessionUserId: session.user.id });
      const requestUrl = new URL(request.url);
      const currentPort = requestUrl.port || '3000';
      const nextAuthUrl = process.env.NEXTAUTH_URL || `http://localhost:${currentPort}`;
      return NextResponse.redirect(`${nextAuthUrl}/?error=user_mismatch`);
    }

    // Exchange authorization code for access token
    console.log(`🔄 Exchanging authorization code for access token: ${session.user.id}`);
    
    // Use consistent port detection for redirect_uri
    const requestUrl = new URL(request.url);
    const currentPort = requestUrl.port || '3000';
    const nextAuthUrl = process.env.NEXTAUTH_URL || `http://localhost:${currentPort}`;
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${nextAuthUrl}/api/auth/google-incremental/callback`
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', tokenData);
      return NextResponse.redirect(`${nextAuthUrl}/?error=token_exchange_failed&details=${encodeURIComponent(tokenData.error || 'Unknown error')}`);
    }

    // Validate token response
    if (!tokenData.access_token) {
      console.error('❌ No access token in response:', tokenData);
      return NextResponse.redirect(`${nextAuthUrl}/?error=no_access_token`);
    }

    // Store the contacts access token securely
    try {
      await storeContactsAccessToken(
        session.user.id, 
        tokenData.access_token, 
        tokenData.refresh_token
      );
      console.log(`✅ Stored contacts access token for user: ${session.user.id}`);
    } catch (error) {
      console.error('❌ Failed to store contacts access token:', error);
      return NextResponse.redirect(`${nextAuthUrl}/?error=token_storage_failed`);
    }

    // Clean up auth state
    await deleteIncrementalAuthState(state);

    // Build return URL with success parameters
    const returnUrl = new URL(stateData.returnUrl);
    returnUrl.searchParams.set('incremental_auth', 'success');
    returnUrl.searchParams.set('contact_save_token', stateData.contactSaveToken);
    returnUrl.searchParams.set('profile_id', stateData.profileId);

    console.log(`✅ Incremental auth successful for user ${session.user.id}, redirecting to: ${returnUrl.toString()}`);
    
    return NextResponse.redirect(returnUrl.toString());
    
  } catch (error) {
    console.error('❌ Incremental auth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=callback_error&details=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
  }
} 