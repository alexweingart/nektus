/**
 * AnonContactView component - Teaser profile for unauthenticated users who scan QR codes
 * Shows limited profile data with Sign in with Apple prompt
 *
 * Ported from: apps/web/src/app/components/views/AnonContactView.tsx
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { UserProfile } from '@nektus/shared-types';
import { getFieldValue, getOptimalProfileImageUrl } from '@nektus/shared-client';
import Avatar from '../ui/elements/Avatar';
import SocialIcon from '../ui/elements/SocialIcon';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { StandardModal } from '../ui/modals/StandardModal';
import { BodyText } from '../ui/Typography';
import { showAppStoreOverlay } from '../../../client/native/SKOverlayWrapper';

// Apple icon (dark logo for white button to match app style)
const AppleIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="#111827">
    <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </Svg>
);

interface AnonContactViewProps {
  profile: UserProfile;
  socialIconTypes: string[];
  token: string;
  onSignIn: () => void;
  /** When set, user is authenticated — show save/download buttons instead of sign-in */
  isAuthenticated?: boolean;
  /** When true, show demo message instead of saving */
  isDemo?: boolean;
  /** Called when user taps Save Contact */
  onSaveContact?: () => void;
  /** Called when user taps the dismiss/reject button */
  onReject?: () => void;
  /** Called when user taps "Install App" after saving */
  onInstallApp?: () => void;
  /** Whether a save is in progress */
  isSaving?: boolean;
  /** Whether the contact has been saved */
  isSaved?: boolean;
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
  isAuthenticated = false,
  isDemo = false,
  onSaveContact,
  onReject,
  onInstallApp,
  isSaving = false,
  isSaved = false,
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
                src={getOptimalProfileImageUrl(profile.profileImage, 256)}
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
          {isAuthenticated ? (
            <>
              {isSaved ? (
                /* Post-save: value props + install CTA */
                <>
                  <View style={styles.valuePropsContainer}>
                    <Text style={styles.valuePropItem}>
                      <Text style={styles.valuePropBullet}>{'  \u2022  '}</Text>
                      Tap phones to exchange contacts instantly
                    </Text>
                    <Text style={styles.valuePropItem}>
                      <Text style={styles.valuePropBullet}>{'  \u2022  '}</Text>
                      Auto-save new connections to your phone
                    </Text>
                    <Text style={styles.valuePropItem}>
                      <Text style={styles.valuePropBullet}>{'  \u2022  '}</Text>
                      Find the perfect time to meet with AI scheduling
                    </Text>
                  </View>
                  <Button
                    variant="white"
                    size="xl"
                    onPress={onInstallApp || (() => {})}
                    style={styles.fullWidth}
                  >
                    Get the App
                  </Button>
                  <View style={styles.secondaryButtonContainer}>
                    <SecondaryButton onPress={onReject || (() => {})}>
                      Continue on Web
                    </SecondaryButton>
                  </View>
                </>
              ) : (
                /* Pre-save: Save Contact + Nah, who this */
                <>
                  <Button
                    variant="white"
                    size="xl"
                    onPress={() => {
                      if (isDemo) {
                        Alert.alert(
                          'Demo Contact',
                          'This is a demo contact for testing. Download the full app to exchange real contacts!',
                          [
                            { text: 'OK', style: 'cancel' },
                            {
                              text: 'Get the App',
                              onPress: () => showAppStoreOverlay(),
                            },
                          ]
                        );
                      } else {
                        onSaveContact?.();
                      }
                    }}
                    disabled={isSaving}
                    style={styles.fullWidth}
                  >
                    {isSaving ? 'Saving...' : 'Save Contact'}
                  </Button>
                  <View style={styles.secondaryButtonContainer}>
                    <SecondaryButton onPress={onReject || (() => {})} disabled={isSaving}>
                      Nah, who this
                    </SecondaryButton>
                  </View>
                </>
              )}
            </>
          ) : (
            <>
              {/* Sign in with Apple button */}
              <Button
                variant="white"
                size="xl"
                onPress={handleSignIn}
                icon={<AppleIcon />}
                style={styles.fullWidth}
              >
                Sign in with Apple
              </Button>

              {/* "to save contact" text */}
              <Text style={styles.helperText}>to get nekt&apos;d</Text>
            </>
          )}
        </View>
      </ScrollView>

      {/* Eager Beaver Modal */}
      <StandardModal
        isOpen={showEagerBeaverModal}
        onClose={() => setShowEagerBeaverModal(false)}
        title="Eager Beaver, eh?"
        subtitle={`Sign in to view ${name}'s ${getSocialDisplayName(clickedSocial)}`}
        showCloseButton={false}
        primaryButtonText="Sign in with Apple"
        primaryButtonIcon={<AppleIcon />}
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
    borderRadius: 68, // (128 avatar + 4*2 border) / 2
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
    gap: 12,
  },
  fullWidth: {
    width: '100%',
  },
  helperText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  secondaryButtonContainer: {
    alignItems: 'center',
  },
  valuePropsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  valuePropItem: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
  valuePropBullet: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

export default AnonContactView;
