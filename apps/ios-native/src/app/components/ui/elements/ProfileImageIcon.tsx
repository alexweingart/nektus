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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ANIMATION } from '@nektus/shared-client';
import { getApiBaseUrl, getIdToken } from '../../../../client/auth/firebase';
import Avatar from './Avatar';
import { textSizes } from '../Typography';

interface ProfileImageIconProps {
  imageUrl?: string;
  onUpload: (uri: string, backgroundColors?: string[]) => void;
  size?: number;
  alt?: string;
  profileColors?: [string, string, string];
}

export function ProfileImageIcon({
  imageUrl,
  onUpload,
  size = 32,
  alt,
  profileColors,
}: ProfileImageIconProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Scale animation for press feedback (matches Button pattern — no opacity change)
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, { toValue: 0.92, duration: ANIMATION.MICRO_MS, useNativeDriver: true }).start();
  }, [scaleAnim]);
  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }).start();
  }, [scaleAnim]);

  // Keep a ref to onUpload so the async handlePress always calls the latest version
  const onUploadRef = useRef(onUpload);
  useEffect(() => { onUploadRef.current = onUpload; }, [onUpload]);

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
      // iOS 14+ uses PHPicker which doesn't require photo library permission.
      // Launch the picker directly — no need for requestMediaLibraryPermissionsAsync().
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const localUri = result.assets[0].uri;

        // Show immediate preview with local URI
        onUploadRef.current(localUri);

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

          // Update with permanent Firebase Storage URL and colors (use ref for latest callback)
          if (data.imageUrl) {
            onUploadRef.current(data.imageUrl, data.backgroundColors);
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
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
    <TouchableOpacity onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.container} disabled={isUploading} activeOpacity={1}>
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
        <View style={{ width: size, height: size }}>
          {isUploading ? (
            <View style={[styles.placeholder, { width: size, height: size }]}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          ) : (
            <Avatar
              src={undefined}
              alt={alt || 'Profile'}
              sizeNumeric={size}
              profileColors={profileColors}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
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
    ...textSizes.xl,
  },
});

export default ProfileImageIcon;
