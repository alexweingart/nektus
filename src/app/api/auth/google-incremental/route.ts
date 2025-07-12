/**
 * Incremental Google OAuth endpoint for Google Contacts permission
 * This handles the initial redirect to Google for additional contacts scope
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { storeIncrementalAuthState } from '@/lib/services/incrementalAuthService';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.warn('⚠️ Incremental auth attempted without authenticated session');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Extract required parameters
    const url = new URL(request.url);
    const returnUrl = url.searchParams.get('returnUrl');
    const contactSaveToken = url.searchParams.get('contactSaveToken');
    const profileId = url.searchParams.get('profileId');

    // Validate required parameters
    if (!returnUrl || !contactSaveToken || !profileId) {
      console.warn('⚠️ Incremental auth missing required parameters:', { returnUrl, contactSaveToken, profileId });
      return NextResponse.json({ 
        error: 'Missing required parameters',
        required: ['returnUrl', 'contactSaveToken', 'profileId']
      }, { status: 400 });
    }

    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('❌ Missing Google OAuth credentials');
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
    }

    // Ensure NEXTAUTH_URL is set (use same logic as auth options)
    let nextAuthUrl = process.env.NEXTAUTH_URL;
    if (!nextAuthUrl) {
      // Try to detect current port from request
      const requestUrl = new URL(request.url);
      const currentPort = requestUrl.port || '3000';
      nextAuthUrl = `http://localhost:${currentPort}`;
      console.log(`⚠️ NEXTAUTH_URL not set, using detected port: ${nextAuthUrl}`);
    }

    // Generate secure state parameter for CSRF protection
    const state = randomBytes(32).toString('hex');
    
    // Store auth state securely with timestamp
    const stateData = {
      userId: session.user.id,
      returnUrl,
      contactSaveToken,
      profileId,
      timestamp: Date.now()
    };
    
    try {
      await storeIncrementalAuthState(state, stateData);
      console.log(`✅ Stored incremental auth state for user ${session.user.id}`);
    } catch (error) {
      console.error('❌ Failed to store incremental auth state:', error);
      return NextResponse.json({ error: 'Failed to initialize auth flow' }, { status: 500 });
    }

    // Build Google OAuth URL for incremental authorization
    const callbackUrl = `${nextAuthUrl}/api/auth/google-incremental/callback`;
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    googleAuthUrl.searchParams.append('client_id', process.env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.append('redirect_uri', callbackUrl);
    googleAuthUrl.searchParams.append('response_type', 'code');
    googleAuthUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/contacts');
    googleAuthUrl.searchParams.append('state', state);
    googleAuthUrl.searchParams.append('access_type', 'offline');
    googleAuthUrl.searchParams.append('include_granted_scopes', 'true'); // Key for incremental auth
    googleAuthUrl.searchParams.append('prompt', 'consent'); // Just consent, no account selection
    
    // Add login hint if available to suggest the correct account
    if (session.user.email) {
      googleAuthUrl.searchParams.append('login_hint', session.user.email);
      console.log(`🔍 Using login_hint: ${session.user.email}`);
    }

    console.log(`🔄 Redirecting user ${session.user.id} to Google for contacts permission`);
    console.log(`📍 Return URL: ${returnUrl}`);
    console.log(`🎯 Profile ID: ${profileId}`);
    console.log(`🔗 Callback URL: ${callbackUrl}`);
    console.log(`🌐 Full Google Auth URL: ${googleAuthUrl.toString()}`);
    
    return NextResponse.redirect(googleAuthUrl.toString());
    
  } catch (error) {
    console.error('❌ Incremental auth endpoint error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 