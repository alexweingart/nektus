/**
 * Utility functions for handling image URLs and optimizations
 *
 * TODO: Replace with shared-lib version
 * - This file is nearly identical to @nektus/shared-lib/src/client/profile/image.ts
 * - Delete this file and import from @nektus/shared-lib instead
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