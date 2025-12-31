import { storage } from '@/client/config/firebase';
import { ref, uploadBytes, getDownloadURL, StorageReference } from 'firebase/storage';

export async function uploadImageToStorage(
  base64Data: string, 
  userId: string, 
  imageType: 'background' | 'profile'
): Promise<string> {
  try {
    console.log(`[Storage] Uploading ${imageType} image for user:`, userId);
    
    if (!storage) {
      throw new Error('Firebase Storage is not initialized');
    }
    
    // Convert base64 to blob
    const base64WithoutPrefix = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const byteCharacters = atob(base64WithoutPrefix);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    
    console.log(`[Storage] Image blob size: ${blob.size} bytes`);
    
    // Create storage reference with timestamp to avoid overwriting
    const timestamp = Date.now();
    const imageRef: StorageReference = ref(storage, `users/${userId}/${imageType}-image-${timestamp}.png`);
    
    // Upload the blob
    console.log(`[Storage] Uploading to path: users/${userId}/${imageType}-image-${timestamp}.png`);
    const snapshot = await uploadBytes(imageRef, blob);
    console.log(`[Storage] Upload successful, snapshot:`, snapshot.metadata);
    
    // Get download URL
    const downloadURL = await getDownloadURL(imageRef);
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
    
    if (!storage) {
      console.warn('[Storage] Firebase Storage is not initialized, skipping cleanup');
      return;
    }

    // List all files in the user's folder
    const { listAll, deleteObject } = await import('firebase/storage');
    const userFolderRef = ref(storage, `users/${userId}`);
    
    try {
      const listResult = await listAll(userFolderRef);
      console.log(`[Storage] Found ${listResult.items.length} files to delete for user ${userId}`);
      
      // Delete all files in parallel
      const deletePromises = listResult.items.map(async (itemRef) => {
        try {
          await deleteObject(itemRef);
          console.log(`[Storage] Deleted file: ${itemRef.fullPath}`);
        } catch (error) {
          console.error(`[Storage] Failed to delete file ${itemRef.fullPath}:`, error);
        }
      });
      
      await Promise.all(deletePromises);
      console.log(`[Storage] Storage cleanup completed for user ${userId}`);
      
    } catch (listError) {
      // If folder doesn't exist or is empty, that's fine
      if ((listError as { code?: string })?.code === 'storage/object-not-found') {
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
    
    if (!storage) {
      throw new Error('Firebase Storage is not initialized');
    }
    
    // Download the image from Google
    const response = await fetch(googleUrl);
    if (!response.ok) {
      throw new Error(`Failed to download Google image: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('[Storage] Downloaded Google image, size:', blob.size, 'bytes');
    
    // Create storage reference
    const timestamp = Date.now();
    const imageRef: StorageReference = ref(storage, `users/${userId}/profile-image-${timestamp}.png`);
    
    // Upload to Firebase Storage
    console.log('[Storage] Uploading to Firebase Storage...');
    await uploadBytes(imageRef, blob);
    console.log('[Storage] Upload successful');
    
    // Get the download URL
    const downloadURL = await getDownloadURL(imageRef);
    console.log('[Storage] New Firebase URL:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('[Storage] Failed to rehost Google profile image:', error);
    throw error;
  }
}
