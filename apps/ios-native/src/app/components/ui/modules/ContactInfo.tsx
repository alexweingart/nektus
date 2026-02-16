/**
 * ContactInfo component - Read-only display of contact profile information
 * Similar to ProfileInfo but without Personal/Work switching and editing capabilities
 */

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import type { UserProfile } from '@nektus/shared-types';
import { getOptimalProfileImageUrl } from '@nektus/shared-client';
import Avatar from '../elements/Avatar';
import SocialIconsList from '../elements/SocialIconsList';
import { generateProfileColors } from '../../../../shared/colors';

interface ContactInfoProps {
  profile: UserProfile;
  bioContent: string;
}

/**
 * Get a field value from ContactEntry array by fieldType
 */
const getFieldValue = (contactEntries: any[] | undefined, fieldType: string): string => {
  if (!contactEntries) return '';
  const entry = contactEntries.find(e => e.fieldType === fieldType);
  return entry?.value || '';
};

export function ContactInfo({ profile, bioContent }: ContactInfoProps) {
  // Dynamic avatar sizing based on screen width
  const { width: screenWidth } = useWindowDimensions();
  const avatarSize = Math.min(Math.max(screenWidth * 0.5, 120), 300);

  const name = getFieldValue(profile?.contactEntries, 'name') || 'Anonymous';
  // Use actual profile colors when available (photo-extracted), fall back to name-generated
  const profileColors = (profile.backgroundColors?.length === 3
    ? profile.backgroundColors as [string, string, string]
    : generateProfileColors(name));

  return (
    <View style={styles.container}>
      {/* Profile Image */}
      <View style={styles.avatarContainer}>
        <View style={[styles.avatarBorder, { borderRadius: (avatarSize + 8) / 2 }]}>
          <Avatar
            src={getOptimalProfileImageUrl(profile.profileImage, 256)}
            alt={name}
            sizeNumeric={avatarSize}
            showInitials={!profile.profileImage}
            profileColors={profileColors}
          />
        </View>
      </View>

      {/* Content with blur background - matches web bg-black/60 backdrop-blur-lg */}
      <View style={styles.contentCard}>
        <BlurView
          style={StyleSheet.absoluteFillObject}
          tint="dark"
          intensity={50}
        />
        {/* Name */}
        <View style={styles.nameContainer}>
          <Text style={styles.name}>{name}</Text>
        </View>

        {/* Bio - split on double newlines for paragraph spacing */}
        <View style={styles.bioContainer}>
          {bioContent.split(/\n\n+/).map((paragraph, i, arr) => (
            <Text
              key={i}
              style={[styles.bio, i < arr.length - 1 && { marginBottom: 12 }]}
            >
              {paragraph}
            </Text>
          ))}
        </View>

        {/* Social Media Icons */}
        <View style={styles.socialContainer}>
          {profile.contactEntries && (
            <SocialIconsList
              contactEntries={profile.contactEntries}
              size="md"
              variant="white"
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarBorder: {
    borderWidth: 4,
    borderColor: '#ffffff',
    // borderRadius is set dynamically based on avatarSize
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contentCard: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  bioContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  bio: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  socialContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
});

export default ContactInfo;
