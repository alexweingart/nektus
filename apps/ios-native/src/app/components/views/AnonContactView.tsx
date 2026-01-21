/**
 * AnonContactView component - Teaser profile for unauthenticated users who scan QR codes
 * Shows limited profile data with Sign in with Apple prompt
 *
 * Ported from: apps/web/src/app/components/views/AnonContactView.tsx
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { UserProfile } from '@nektus/shared-types';
import { getFieldValue } from '@nektus/shared-client';
import Avatar from '../ui/elements/Avatar';
import SocialIcon from '../ui/elements/SocialIcon';
import { Button } from '../ui/buttons/Button';
import { StandardModal } from '../ui/modals/StandardModal';
import { BodyText } from '../ui/Typography';

interface AnonContactViewProps {
  profile: UserProfile;
  socialIconTypes: string[];
  token: string;
  onSignIn: () => void;
}

// Map icon type to display name
const getSocialDisplayName = (type: string): string => {
  const names: Record<string, string> = {
    instagram: 'Instagram',
    x: 'X',
    twitter: 'X',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    snapchat: 'Snapchat',
    telegram: 'Telegram',
    github: 'GitHub',
    whatsapp: 'WhatsApp',
    phone: 'phone number',
    email: 'email',
  };
  return names[type] || type;
};

export function AnonContactView({
  profile,
  socialIconTypes,
  token,
  onSignIn,
}: AnonContactViewProps) {
  const [showEagerBeaverModal, setShowEagerBeaverModal] = useState(false);
  const [clickedSocial, setClickedSocial] = useState<string>('');

  const name = getFieldValue(profile.contactEntries, 'name') || 'User';
  const bio = getFieldValue(profile.contactEntries, 'bio') || 'Welcome to my profile!';

  const handleSocialIconClick = useCallback((iconType: string) => {
    setClickedSocial(iconType);
    setShowEagerBeaverModal(true);
  }, []);

  const handleSignIn = useCallback(() => {
    setShowEagerBeaverModal(false);
    onSignIn();
  }, [onSignIn]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Profile Image */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBorder}>
              <Avatar
                src={profile.profileImage}
                size="lg"
              />
            </View>
          </View>

          {/* Content Card */}
          <View style={styles.contentCard}>
            {/* Name */}
            <Text style={styles.name}>{name}</Text>

            {/* Bio */}
            <BodyText style={styles.bio}>{bio}</BodyText>

            {/* Social Icons - non-clickable, trigger modal */}
            {socialIconTypes.length > 0 && (
              <View style={styles.socialIconsContainer}>
                {socialIconTypes.map((iconType) => (
                  <SocialIcon
                    key={iconType}
                    platform={iconType}
                    size="md"
                    variant="white"
                    onPress={() => handleSocialIconClick(iconType)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Sign in with Apple button */}
          <Button
            variant="white"
            size="xl"
            onPress={handleSignIn}
            style={styles.fullWidth}
          >
            <Text style={styles.buttonText}> Sign in with Apple</Text>
          </Button>

          {/* "to save contact" text */}
          <Text style={styles.helperText}>to save {name}&apos;s contact</Text>
        </View>
      </ScrollView>

      {/* Eager Beaver Modal */}
      <StandardModal
        isOpen={showEagerBeaverModal}
        onClose={() => setShowEagerBeaverModal(false)}
        title="Eager Beaver, eh?"
        subtitle={`Sign in to view ${name}'s ${getSocialDisplayName(clickedSocial)}`}
        showCloseButton={false}
        primaryButtonText=" Sign in with Apple"
        onPrimaryButtonClick={handleSignIn}
        secondaryButtonText="Cancel"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  profileCard: {
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarBorder: {
    borderWidth: 4,
    borderColor: '#ffffff',
    borderRadius: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contentCard: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  name: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  bio: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  socialIconsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  actionsContainer: {
    marginTop: 24,
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  helperText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default AnonContactView;
