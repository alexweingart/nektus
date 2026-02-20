/**
 * AnonContactView component - Teaser profile for unauthenticated users who scan QR codes
 * Shows limited profile data with Sign in with Apple prompt
 *
 * Ported from: apps/web/src/app/components/views/AnonContactView.tsx
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { UserProfile } from '@nektus/shared-types';
import { getFieldValue, getOptimalProfileImageUrl } from '@nektus/shared-client';
import Avatar from '../ui/elements/Avatar';
import SocialIcon from '../ui/elements/SocialIcon';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { StandardModal } from '../ui/modals/StandardModal';
import { BodyText, textSizes, fontStyles } from '../ui/Typography';
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

  const name = getFieldValue(profile.contactEntries, 'name') || 'They-who-must-not-be-named';
  const bio = getFieldValue(profile.contactEntries, 'bio') || 'Welcome to my profile!';

  // --- Crossfade animation values ---
  const profileOpacity = useRef(new Animated.Value(1)).current;
  const upsellOpacity = useRef(new Animated.Value(0)).current;
  const headlineAnim = useRef(new Animated.Value(0)).current;
  const headlineSlide = useRef(new Animated.Value(15)).current;
  const subheadAnim = useRef(new Animated.Value(0)).current;
  const row1Anim = useRef(new Animated.Value(0)).current;
  const row1Slide = useRef(new Animated.Value(15)).current;
  const row2Anim = useRef(new Animated.Value(0)).current;
  const row2Slide = useRef(new Animated.Value(15)).current;
  const row3Anim = useRef(new Animated.Value(0)).current;
  const row3Slide = useRef(new Animated.Value(15)).current;
  const buttonsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isSaved) return;

    const easeOut = Easing.out(Easing.ease);
    const baseDelay = 250;
    const stagger = 150;

    // Fade out profile card
    Animated.timing(profileOpacity, {
      toValue: 0,
      duration: 300,
      easing: easeOut,
      useNativeDriver: true,
    }).start();

    // Upsell container becomes visible
    Animated.sequence([
      Animated.delay(baseDelay),
      Animated.timing(upsellOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Headline
    Animated.sequence([
      Animated.delay(baseDelay),
      Animated.parallel([
        Animated.timing(headlineAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(headlineSlide, { toValue: 0, duration: 300, easing: easeOut, useNativeDriver: true }),
      ]),
    ]).start();

    // Subhead "Your profile is ready."
    Animated.sequence([
      Animated.delay(baseDelay + stagger),
      Animated.timing(subheadAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Feature rows — staggered entrance
    const rows = [
      [row1Anim, row1Slide],
      [row2Anim, row2Slide],
      [row3Anim, row3Slide],
    ] as const;

    rows.forEach(([opacity, slide], i) => {
      Animated.sequence([
        Animated.delay(baseDelay + stagger * (i + 2)),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(slide, { toValue: 0, duration: 300, easing: easeOut, useNativeDriver: true }),
        ]),
      ]).start();
    });

    // Buttons fade in last
    Animated.sequence([
      Animated.delay(baseDelay + stagger * 5),
      Animated.timing(buttonsAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [isSaved]);

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
      {/* Pre-save: Profile card + sign-in or save buttons */}
      <Animated.View
        style={[styles.profileLayer, { opacity: profileOpacity }]}
        pointerEvents={isSaved ? 'none' : 'auto'}
      >
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
              <Text style={styles.name}>{name}</Text>
              <BodyText style={styles.bio}>{bio}</BodyText>
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
            ) : (
              <>
                <Button
                  variant="white"
                  size="xl"
                  onPress={handleSignIn}
                  icon={<AppleIcon />}
                  style={styles.fullWidth}
                >
                  Sign in with Apple
                </Button>
                <Text style={styles.helperText}>to get nekt&apos;d</Text>
              </>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      {/* Post-save: Upsell page — crossfades in over the profile */}
      {isSaved && (
        <Animated.View
          style={[styles.upsellLayer, { opacity: upsellOpacity }]}
        >
          <ScrollView
            contentContainerStyle={styles.upsellScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Headline */}
            <Animated.Text
              style={[
                styles.upsellHeadline,
                { opacity: headlineAnim, transform: [{ translateY: headlineSlide }] },
              ]}
            >
              More new friends await
            </Animated.Text>

            {/* Upsell Card */}
            <View style={styles.upsellCard}>
              <Animated.Text style={[styles.upsellSubhead, { opacity: subheadAnim }]}>
                Your profile is ready.
              </Animated.Text>

              <Animated.View style={[styles.upsellDividerWrap, { opacity: subheadAnim }]}>
                <View style={styles.upsellDivider} />
              </Animated.View>

              {/* Row 1 — Tap to connect */}
              <Animated.View
                style={[
                  styles.upsellRow,
                  { opacity: row1Anim, transform: [{ translateY: row1Slide }] },
                ]}
              >
                <Text style={styles.upsellEmoji}>{'\u{1F4F2}'}</Text>
                <View style={styles.upsellRowText}>
                  <Text style={styles.upsellRowTitle}>Tap to connect</Text>
                  <Text style={styles.upsellRowDesc}>
                    Skip the QR — just tap phones next time
                  </Text>
                </View>
              </Animated.View>

              {/* Row 2 — Auto-save */}
              <Animated.View
                style={[
                  styles.upsellRow,
                  { opacity: row2Anim, transform: [{ translateY: row2Slide }] },
                ]}
              >
                <Text style={styles.upsellEmoji}>{'\u2728'}</Text>
                <View style={styles.upsellRowText}>
                  <Text style={styles.upsellRowTitle}>Auto-save</Text>
                  <Text style={styles.upsellRowDesc}>
                    New connections go straight to your phone
                  </Text>
                </View>
              </Animated.View>

              {/* Row 3 — AI scheduling */}
              <Animated.View
                style={[
                  styles.upsellRow,
                  { opacity: row3Anim, transform: [{ translateY: row3Slide }] },
                ]}
              >
                <Text style={styles.upsellEmoji}>{'\uD83D\uDCC5'}</Text>
                <View style={styles.upsellRowText}>
                  <Text style={styles.upsellRowTitle}>AI scheduling</Text>
                  <Text style={styles.upsellRowDesc}>
                    Find the perfect time to meet up
                  </Text>
                </View>
              </Animated.View>
            </View>

            {/* Buttons */}
            <Animated.View style={[styles.actionsContainer, { opacity: buttonsAnim }]}>
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
            </Animated.View>
          </ScrollView>
        </Animated.View>
      )}

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
  profileLayer: {
    flex: 1,
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
    borderRadius: 68,
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
    ...textSizes.xxl,
    ...fontStyles.bold,
    textAlign: 'center',
    marginBottom: 16,
  },
  bio: {
    color: 'rgba(255, 255, 255, 0.9)',
    ...fontStyles.regular,
    ...textSizes.sm,
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
    ...fontStyles.regular,
    ...textSizes.sm,
    textAlign: 'center',
  },
  secondaryButtonContainer: {
    alignItems: 'center',
  },

  // --- Upsell page styles ---
  upsellLayer: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 16,
  },
  upsellScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  upsellHeadline: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 36,
    ...fontStyles.bold,
    textAlign: 'center',
    marginBottom: 24,
  },
  upsellCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 16,
  },
  upsellSubhead: {
    color: 'rgba(255, 255, 255, 0.9)',
    ...textSizes.base,
    ...fontStyles.medium,
    textAlign: 'center',
  },
  upsellDividerWrap: {
    paddingHorizontal: 8,
  },
  upsellDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  upsellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  upsellEmoji: {
    fontSize: 28,
    lineHeight: 36,
    width: 36,
    textAlign: 'center',
  },
  upsellRowText: {
    flex: 1,
    gap: 2,
  },
  upsellRowTitle: {
    color: '#ffffff',
    ...textSizes.base,
    ...fontStyles.semibold,
  },
  upsellRowDesc: {
    color: 'rgba(255, 255, 255, 0.7)',
    ...textSizes.sm,
    ...fontStyles.regular,
  },
});

export default AnonContactView;
