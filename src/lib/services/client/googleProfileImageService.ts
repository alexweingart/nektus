/**
 * Detects if a Google profile image is auto-generated (initials) or user-uploaded
 * using the Google People API
 */

/**
 * Checks if a Google profile image is auto-generated initials using the People API
 * @param accessToken - Google OAuth access token
 * @returns Promise<boolean> - true if it's auto-generated initials, false if user-uploaded
 */
export async function isGoogleInitialsImage(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://people.googleapis.com/v1/people/me?personFields=photos', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`People API request failed: ${response.status}`);
    }

    const data = await response.json();
    const primaryPhoto = data.photos?.find((photo: { metadata?: { primary?: boolean } }) => photo.metadata?.primary);
    
    if (!primaryPhoto) {
      console.log('🔍 No primary photo found in People API response');
      return true; // No photo means we should generate one
    }

    const isDefault = primaryPhoto.default === true;
    console.log(`🔍 Google profile photo check: ${isDefault ? 'auto-generated initials' : 'user-uploaded photo'}`);
    
    return isDefault;
  } catch (error) {
    console.warn('⚠️ Error checking Google profile photo via People API:', error);
    // Default to false (treat as user photo) to avoid unnecessary generation
    return false;
  }
}

