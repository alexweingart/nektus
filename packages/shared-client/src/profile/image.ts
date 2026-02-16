/**
 * Utility functions for handling image URLs, optimizations, and Google image detection
 */

/**
 * Upgrades a Google profile picture URL to a higher resolution
 * Google profile pictures support URL parameters for sizing:
 * - s{size} = sets the longest side to {size} pixels
 * - s{size}-c = sets size and crops to square
 *
 * @param googleImageUrl - The original Google profile image URL
 * @param size - Desired size in pixels (default: 400)
 * @param square - Whether to crop to square (default: true)
 * @returns Higher resolution image URL
 */
export const getHighResGoogleImage = (
  googleImageUrl: string | null | undefined,
  size: number = 400,
  square: boolean = true
): string => {
  if (!googleImageUrl) return '';

  // Check if this is a Google image URL
  if (!googleImageUrl.includes('googleusercontent.com')) {
    return googleImageUrl;
  }

  // Remove existing size parameters (common patterns: =s96-c, =s96, etc.)
  const baseUrl = googleImageUrl.replace(/=s\d+(-c)?.*$/, '');

  // Add our desired size parameter
  const sizeParam = square ? `=s${size}-c` : `=s${size}`;

  return `${baseUrl}${sizeParam}`;
};

/**
 * Gets the optimal profile image URL, preferring high-res Google images
 * or falling back to the original URL
 */
export const getOptimalProfileImageUrl = (
  imageUrl: string | null | undefined,
  size: number = 400
): string => {
  if (!imageUrl) return '';

  // If it's a Google image, upgrade to high-res
  if (imageUrl.includes('googleusercontent.com')) {
    return getHighResGoogleImage(imageUrl, size, true);
  }

  // For other images, return as-is
  return imageUrl;
};

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
      // If unauthorized (401), the token is invalid/expired - assume it's a real photo to avoid regeneration
      if (response.status === 401) {
        console.log('Google access token expired/invalid - skipping profile image check');
        return false; // Assume real photo to avoid unnecessary generation
      }
      throw new Error(`People API request failed: ${response.status}`);
    }

    const data = await response.json();
    const primaryPhoto = data.photos?.find((photo: { metadata?: { primary?: boolean } }) => photo.metadata?.primary);

    if (!primaryPhoto) {
      console.log('No primary photo found in People API response');
      return true; // No photo means we should generate one
    }

    const isDefault = primaryPhoto.default === true;
    console.log(`Google profile photo check: ${isDefault ? 'auto-generated initials' : 'user-uploaded photo'}`);

    return isDefault;
  } catch (error) {
    console.warn('Error checking Google profile photo via People API:', error);
    // Default to false (treat as user photo) to avoid unnecessary generation
    return false;
  }
}
