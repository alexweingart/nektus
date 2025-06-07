import { storage } from './config';
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
    
    // Create storage reference
    const imageRef: StorageReference = ref(storage, `users/${userId}/${imageType}-image.png`);
    
    // Upload the blob
    console.log(`[Storage] Uploading to path: users/${userId}/${imageType}-image.png`);
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
