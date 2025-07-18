import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { 
  getIncrementalAuthState, 
  deleteIncrementalAuthState, 
  storeContactsAccessToken 
} from '@/lib/services/server/serverIncrementalAuthService';

/**
 * Popup callback route for Google incremental auth
 * This route runs in a popup window, handles the full OAuth flow, and sends results to the parent
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is still authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createPopupResponse(false, 'not_authenticated', 'User not authenticated');
    }

    // Extract OAuth response parameters
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    console.log(`🔄 Popup callback for user ${session.user.id}`, {
      hasCode: !!code,
      hasState: !!state,
      error,
      errorDescription
    });

    // Handle user cancellation or denial
    if (error === 'access_denied') {
      console.log(`❌ User denied Google Contacts permission in popup: ${session.user.id}`);
      return createPopupResponse(false, 'access_denied', 'User denied permission');
    }

    // Handle other OAuth errors
    if (error) {
      console.error('❌ OAuth error in popup callback:', { error, errorDescription });
      return createPopupResponse(false, error, errorDescription || error);
    }

    // Validate required parameters
    if (!code || !state) {
      console.warn('⚠️ Popup callback missing required parameters:', { code: !!code, state: !!state });
      return createPopupResponse(false, 'invalid_callback', 'Missing required parameters');
    }

    // Retrieve and validate auth state
    const stateData = await getIncrementalAuthState(state);
    if (!stateData) {
      console.warn('⚠️ Invalid or expired auth state in popup:', state);
      return createPopupResponse(false, 'invalid_state', 'Invalid or expired auth state');
    }

    // Verify state belongs to current user
    if (stateData.userId !== session.user.id) {
      console.warn('⚠️ Auth state user mismatch in popup:', { stateUserId: stateData.userId, sessionUserId: session.user.id });
      return createPopupResponse(false, 'user_mismatch', 'Auth state user mismatch');
    }

    // Exchange authorization code for access token
    console.log(`🔄 Exchanging authorization code for access token in popup: ${session.user.id}`);
    
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
        redirect_uri: `${nextAuthUrl}/api/auth/google-incremental/popup-callback`
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed in popup:', tokenData);
      return createPopupResponse(false, 'token_exchange_failed', tokenData.error || 'Token exchange failed');
    }

    // Validate token response
    if (!tokenData.access_token) {
      console.error('❌ No access token in popup response:', tokenData);
      return createPopupResponse(false, 'no_access_token', 'No access token received');
    }

    // Store the contacts access token securely
    try {
      await storeContactsAccessToken(
        session.user.id, 
        tokenData.access_token, 
        tokenData.refresh_token
      );
      console.log(`✅ Stored contacts access token for user in popup: ${session.user.id}`);
    } catch (error) {
      console.error('❌ Failed to store contacts access token in popup:', error);
      return createPopupResponse(false, 'token_storage_failed', 'Failed to store access token');
    }

    // Clean up auth state
    await deleteIncrementalAuthState(state);

    console.log(`✅ Popup auth successful for user ${session.user.id}`);
    
    // Return success response to popup
    return createPopupResponse(true, null, 'Authorization successful', {
      contactSaveToken: stateData.contactSaveToken,
      profileId: stateData.profileId
    });
    
  } catch (error) {
    console.error('❌ Popup auth callback error:', error);
    return createPopupResponse(false, 'callback_error', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Create HTML response for popup that sends postMessage to parent
 */
function createPopupResponse(
  success: boolean, 
  error: string | null, 
  message: string,
  data?: { contactSaveToken: string; profileId: string }
) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Auth ${success ? 'Complete' : 'Failed'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .message {
      text-align: center;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .success { color: #28a745; }
    .error { color: #dc3545; }
  </style>
</head>
<body>
  <div class="message">
    ${success ? `
      <div class="success">
        <h3>Authorization Complete</h3>
        <p>Contact permission granted successfully!</p>
      </div>
    ` : `
      <div class="error">
        <h3>Authorization Failed</h3>
        <p>${message}</p>
      </div>
    `}
  </div>

  <script>
    (function() {
      // Send result to parent window
      const result = {
        type: 'GOOGLE_AUTH_COMPLETE',
        success: ${success},
        error: ${error ? `'${error}'` : 'null'},
        message: '${message}',
        ${data ? `contactSaveToken: '${data.contactSaveToken}', profileId: '${data.profileId}',` : ''}
        timestamp: Date.now()
      };

      console.log('📤 Popup sending result to parent:', result);

      // Send to parent window
      if (window.opener) {
        window.opener.postMessage(result, window.location.origin);
        console.log('✅ Message sent to parent via opener');
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(result, window.location.origin);
        console.log('✅ Message sent to parent via parent');
      } else {
        console.warn('⚠️ No parent window found to send message to');
      }

      // Close popup after a short delay (let parent process the message)
      setTimeout(() => {
        console.log('🔄 Closing popup...');
        window.close();
      }, 1500);

      // If window doesn't close automatically (some browsers), show a close button
      setTimeout(() => {
        if (!window.closed) {
          document.body.innerHTML = \`
            <div class="message">
              <h3>You can close this window</h3>
              <button onclick="window.close()" style="
                background: #007bff; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 4px; 
                cursor: pointer;
                font-size: 16px;
              ">Close</button>
            </div>
          \`;
        }
      }, 4000);
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
} 