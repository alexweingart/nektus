/**
 * ProfileImageIcon for iOS
 * Adapted from: apps/web/src/app/components/ui/elements/ProfileImageIcon.tsx
 *
 * Changes from web:
 * - Replaced Next.js Image with React Native Image
 * - Replaced HTML input with expo-image-picker
 * - Replaced div with View/TouchableOpacity
 * - Added Firebase Storage upload via API (same as web)
 */

import React, { useState, useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getApiBaseUrl, getIdToken } from '../../../../client/auth/firebase';

interface ProfileImageIconProps {
  imageUrl?: string;
  onUpload: (uri: string, backgroundColors?: string[]) => void;
  size?: number;
}

export function ProfileImageIcon({
  imageUrl,
  onUpload,
  size = 32,
}: ProfileImageIconProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset error state when imageUrl changes
  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  // Helper function to handle Firebase image cache busting
  const getCachebustedImageUrl = (url: string): string => {
    if (url.includes('firebasestorage.app')) {
      const cacheBuster = `cb=${Date.now()}`;
      return url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
    }
    return url;
  };

  const handlePress = async () => {
    if (isUploading) return;

    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access media library denied');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const localUri = result.assets[0].uri;

        // Show immediate preview with local URI
        onUpload(localUri);

        // Upload to Firebase Storage via API (same as web)
        setIsUploading(true);
        try {
          console.log('[ProfileImageIcon] Reading image as base64...');
          const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Determine mime type from URI
          const mimeType = localUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          const imageData = `data:${mimeType};base64,${base64}`;

          console.log('[ProfileImageIcon] Uploading to API...');
          const apiBaseUrl = getApiBaseUrl();
          const idToken = await getIdToken();
          if (!idToken) {
            throw new Error('No Firebase ID token available');
          }

          const response = await fetch(`${apiBaseUrl}/api/profile/generate/profile-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ imageData }),
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
          }

          const data = await response.json();
          console.log('[ProfileImageIcon] Upload successful:', data);

          // Update with permanent Firebase Storage URL and colors
          if (data.imageUrl) {
            onUpload(data.imageUrl, data.backgroundColors);
          }
        } catch (uploadError) {
          console.error('[ProfileImageIcon] Upload failed:', uploadError);
          // Keep the local preview - the image wasn't saved to Firebase but user can try again
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  // Show placeholder if no image URL or if image failed to load
  const showPlaceholder = !imageUrl || hasError;

  return (
    <TouchableOpacity onPress={handlePress} style={styles.container} disabled={isUploading}>
      {!showPlaceholder ? (
        <View style={[styles.imageContainer, { width: size, height: size }]}>
          <Image
            source={{ uri: getCachebustedImageUrl(imageUrl) }}
            style={[styles.image, isUploading && styles.imageUploading]}
            resizeMode="cover"
            onError={() => setHasError(true)}
          />
          {isUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.placeholder, { width: size, height: size }]}>
          {isUploading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.placeholderEmoji}>👤</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageUploading: {
    opacity: 0.5,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 20,
  },
});

export default ProfileImageIcon;
