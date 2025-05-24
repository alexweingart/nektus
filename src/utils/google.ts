/**
 * Utility for revoking Google OAuth tokens
 */

/**
 * Revokes a Google OAuth token to disconnect the app from the user's Google account
 * This allows the user to re-authenticate with the same Google account
 * 
 * @param token The Google OAuth token to revoke
 * @returns Promise that resolves when the token is revoked
 */
export async function revokeGoogleToken(token: string): Promise<void> {
  if (!token) {
    console.warn('No token provided for revocation');
    return;
  }
  
  try {
    // Google OAuth token revocation endpoint
    const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google token revocation failed:', errorData);
      throw new Error(`Failed to revoke token: ${errorData.error}`);
    }
    
    console.log('Google token successfully revoked');
  } catch (error) {
    console.error('Error revoking Google token:', error);
    throw error;
  }
}
