/**
 * iOS Firebase Storage Service
 * Uses React Native Firebase SDK for native iOS storage operations
 */

import storage from '@react-native-firebase/storage';

/**
 * Uploads an image to Firebase Storage
 * @param base64Data Base64-encoded image data (with or without data URI prefix)
 * @param userId The user ID
 * @param imageType Type of image (background or profile)
 * @returns Promise resolving to the download URL
 */
export async function uploadImageToStorage(
  base64Data: string,
  userId: string,
  imageType: 'background' | 'profile'
): Promise<string> {
  try {
    console.log(`[Storage] Uploading ${imageType} image for user:`, userId);

    // Convert base64 to blob-compatible format
    const base64WithoutPrefix = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    // Create storage reference with timestamp to avoid overwriting
    const timestamp = Date.now();
    const imagePath = `users/${userId}/${imageType}-image-${timestamp}.png`;
    const imageRef = storage().ref(imagePath);

    console.log(`[Storage] Uploading to path: ${imagePath}`);

    // Upload the base64 string directly (React Native Firebase handles this)
    await imageRef.putString(base64WithoutPrefix, 'base64', {
      contentType: 'image/png',
    });

    console.log(`[Storage] Upload successful`);

    // Get download URL
    const downloadURL = await imageRef.getDownloadURL();
    console.log(`[Storage] Download URL generated:`, downloadURL);

    return downloadURL;
  } catch (error) {
    console.error(`[Storage] Failed to upload ${imageType} image:`, error);
    throw error;
  }
}

export async function uploadBackgroundImage(base64Data: string, userId: string): Promise<string> {
  return uploadImageToStorage(base64Data, userId, 'background');
}

export async function uploadProfileImage(base64Data: string, userId: string): Promise<string> {
  return uploadImageToStorage(base64Data, userId, 'profile');
}

/**
 * Cleans up all storage files for a user during account deletion
 */
export async function cleanupUserStorage(userId: string): Promise<void> {
  try {
    console.log(`[Storage] Cleaning up storage files for user:`, userId);

    const userFolderRef = storage().ref(`users/${userId}`);

    try {
      const listResult = await userFolderRef.listAll();
      console.log(`[Storage] Found ${listResult.items.length} files to delete for user ${userId}`);

      // Delete all files in parallel
      const deletePromises = listResult.items.map(async (itemRef) => {
        try {
          await itemRef.delete();
          console.log(`[Storage] Deleted file: ${itemRef.fullPath}`);
        } catch (error) {
          console.error(`[Storage] Failed to delete file ${itemRef.fullPath}:`, error);
        }
      });

      await Promise.all(deletePromises);
      console.log(`[Storage] Storage cleanup completed for user ${userId}`);
    } catch (listError) {
      // If folder doesn't exist or is empty, that's fine
      const errorCode = (listError as { code?: string })?.code;
      if (errorCode === 'storage/object-not-found') {
        console.log(`[Storage] No storage files found for user ${userId}`);
      } else {
        console.error(`[Storage] Error listing files for user ${userId}:`, listError);
      }
    }
  } catch (error) {
    console.error(`[Storage] Storage cleanup failed for user ${userId}:`, error);
    // Don't throw - we don't want to block account deletion if storage cleanup fails
  }
}

/**
 * Downloads a Google profile image and re-hosts it on Firebase Storage
 * Returns the new Firebase Storage URL
 */
export async function rehostGoogleProfileImage(googleUrl: string, userId: string): Promise<string> {
  try {
    console.log('[Storage] Re-hosting Google profile image for user:', userId);
    console.log('[Storage] Original Google URL:', googleUrl);

    // Download the image from Google
    const response = await fetch(googleUrl);
    if (!response.ok) {
      throw new Error(`Failed to download Google image: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log('[Storage] Downloaded Google image, size:', blob.size, 'bytes');

    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
    });
    reader.readAsDataURL(blob);

    const base64Data = await base64Promise;

    // Create storage reference
    const timestamp = Date.now();
    const imagePath = `users/${userId}/profile-image-${timestamp}.png`;
    const imageRef = storage().ref(imagePath);

    // Upload to Firebase Storage
    console.log('[Storage] Uploading to Firebase Storage...');

    // Extract base64 part (remove data:image/...;base64, prefix)
    const base64WithoutPrefix = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    await imageRef.putString(base64WithoutPrefix, 'base64', {
      contentType: 'image/png',
    });

    console.log('[Storage] Upload successful');

    // Get the download URL
    const downloadURL = await imageRef.getDownloadURL();
    console.log('[Storage] New Firebase URL:', downloadURL);

    return downloadURL;
  } catch (error) {
    console.error('[Storage] Failed to rehost Google profile image:', error);
    throw error;
  }
}
