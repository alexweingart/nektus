/**
 * ContactInfo component - Read-only display of contact profile information
 * Similar to ProfileInfo but without Personal/Work switching and editing capabilities
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { UserProfile } from '@nektus/shared-types';
import Avatar from '../elements/Avatar';
import SocialIconsList from '../elements/SocialIconsList';

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
  const name = getFieldValue(profile?.contactEntries, 'name') || 'Anonymous';

  return (
    <View style={styles.container}>
      {/* Profile Image */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatarBorder}>
          <Avatar
            src={profile.profileImage}
            alt={name}
            size="lg"
          />
        </View>
      </View>

      {/* Content with blur background */}
      <View style={styles.contentCard}>
        {/* Name */}
        <View style={styles.nameContainer}>
          <Text style={styles.name}>{name}</Text>
        </View>

        {/* Bio */}
        <View style={styles.bioContainer}>
          <Text style={styles.bio}>{bioContent}</Text>
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
    borderRadius: 68, // 128 / 2 + 4
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contentCard: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
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
