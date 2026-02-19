/**
 * Reusable hook for picking and uploading a profile image.
 * Extracted from ProfileImageIcon for use in ProfileView camera overlay.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getApiBaseUrl, getIdToken } from '../auth/firebase';

interface UseProfileImagePickerOptions {
  onUpload: (uri: string, backgroundColors?: string[]) => void;
}

export function useProfileImagePicker({ onUpload }: UseProfileImagePickerOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const onUploadRef = useRef(onUpload);
  useEffect(() => { onUploadRef.current = onUpload; }, [onUpload]);

  const pickAndUploadImage = useCallback(async () => {
    if (isUploading) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const localUri = result.assets[0].uri;

        // Show immediate preview
        onUploadRef.current(localUri);

        // Upload to Firebase Storage via API
        setIsUploading(true);
        try {
          const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const mimeType = localUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          const imageData = `data:${mimeType};base64,${base64}`;

          const apiBaseUrl = getApiBaseUrl();
          const idToken = await getIdToken();
          if (!idToken) throw new Error('No Firebase ID token available');

          const response = await fetch(`${apiBaseUrl}/api/profile/generate/profile-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ imageData }),
          });

          if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

          const data = await response.json();
          if (data.imageUrl) {
            onUploadRef.current(data.imageUrl, data.backgroundColors);
          }
        } catch (uploadError) {
          console.error('[useProfileImagePicker] Upload failed:', uploadError);
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error('[useProfileImagePicker] Error picking image:', error);
    }
  }, [isUploading]);

  return { pickAndUploadImage, isUploading };
}
