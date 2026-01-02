/**
 * ProfileImageIcon for iOS
 * Adapted from: apps/web/src/app/components/ui/elements/ProfileImageIcon.tsx
 *
 * Changes from web:
 * - Replaced Next.js Image with React Native Image
 * - Replaced HTML input with expo-image-picker
 * - Replaced div with View/TouchableOpacity
 */

import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface ProfileImageIconProps {
  imageUrl?: string;
  onUpload: (uri: string) => void;
  size?: number;
}

export function ProfileImageIcon({
  imageUrl,
  onUpload,
  size = 32,
}: ProfileImageIconProps) {
  // Helper function to handle Firebase image cache busting
  const getCachebustedImageUrl = (url: string): string => {
    if (url.includes('firebasestorage.app')) {
      const cacheBuster = `cb=${Date.now()}`;
      return url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
    }
    return url;
  };

  const handlePress = async () => {
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
        onUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.container}>
      {imageUrl ? (
        <View style={[styles.imageContainer, { width: size, height: size }]}>
          <Image
            source={{ uri: getCachebustedImageUrl(imageUrl) }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      ) : (
        <View style={[styles.placeholder, { width: size, height: size }]}>
          <Text style={styles.placeholderEmoji}>👤</Text>
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
