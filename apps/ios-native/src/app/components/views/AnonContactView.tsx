/**
 * AnonContactView component - Teaser profile for unauthenticated users who scan QR codes
 * Shows limited profile data with Sign in with Apple prompt
 *
 * Ported from: apps/web/src/app/components/views/AnonContactView.tsx
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Animated, Easing, useWindowDimensions, Linking } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import type { UserProfile } from '@nektus/shared-types';
import { getFieldValue, getOptimalProfileImageUrl, ANIMATION } from '@nektus/shared-client';
import { BlurView } from 'expo-blur';
import Avatar from '../ui/elements/Avatar';
import SocialIcon from '../ui/elements/SocialIcon';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { StandardModal } from '../ui/modals/StandardModal';
import { BodyText, textSizes, fontStyles } from '../ui/Typography';
import { showAppStoreOverlay } from '../../../client/native/SKOverlayWrapper';
import { generateProfileColors } from '../../../shared/colors';

// Lucide-style SVG icons for upsell features
const PhoneExchangeIcon = () => (
  <Svg width={32} height={28} viewBox="0 0 32 28" fill="none" stroke="#ffffff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    {/* Left phone, tilted -12deg */}
    <Rect x={2} y={4} width={10} height={16} rx={2} ry={2} transform="rotate(-12, 7, 12)" />
    <Path d="M7 17h.01" transform="rotate(-12, 7, 12)" />
    {/* Right phone, tilted 12deg */}
    <Rect x={20} y={4} width={10} height={16} rx={2} ry={2} transform="rotate(12, 25, 12)" />
    <Path d="M25 17h.01" transform="rotate(12, 25, 12)" />
  </Svg>
);

const UserPlusIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 21a8 8 0 0 1 13.292-6" />
    <Circle cx={10} cy={8} r={5} />
    <Path d="M19 16v6" />
    <Path d="M22 19h-6" />
  </Svg>
);

const CalendarCheckIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8 2v4" />
    <Path d="M16 2v4" />
    <Rect x={3} y={4} width={18} height={18} rx={2} />
    <Path d="M3 10h18" />
    <Path d="M9 16l2 2 4-4" />
  </Svg>
);

// Apple icon (dark logo for white button to match app style)
const AppleIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="#111827">
    <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </Svg>
);

interface AnonContactViewProps {
  profile: UserProfile;
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
    custom: 'link',
  };
  return names[type] || 'link';
};

export function AnonContactView({
  profile,
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

  // Dynamic avatar sizing matching ProfileInfo/ContactInfo
  const { width: screenWidth } = useWindowDimensions();
  const avatarSize = Math.min(Math.max(screenWidth * 0.5, 120), 300);

  const name = getFieldValue(profile.contactEntries, 'name') || 'They-who-must-not-be-named';
  const bio = getFieldValue(profile.contactEntries, 'bio') || 'Too cool for a bio. Google me.';

  // Derive social entries from contactEntries (excludes name/bio)
  const socialEntries = (profile.contactEntries || [])
    .filter(e => e.isVisible && !['name', 'bio'].includes(e.fieldType))
    .sort((a, b) => a.order - b.order);

  const profileColors = (profile.backgroundColors?.length === 3
    ? profile.backgroundColors as [string, string, string]
    : generateProfileColors(name));

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

    // Fade out profile card (page-level crossfade)
    Animated.timing(profileOpacity, {
      toValue: 0,
      duration: ANIMATION.NAVIGATION_MS,
      easing: easeOut,
      useNativeDriver: true,
    }).start();

    // Upsell container becomes visible (page-level crossfade)
    Animated.sequence([
      Animated.delay(baseDelay),
      Animated.timing(upsellOpacity, {
        toValue: 1,
        duration: ANIMATION.NAVIGATION_MS,
        useNativeDriver: true,
      }),
    ]).start();

    // Headline
    Animated.sequence([
      Animated.delay(baseDelay),
      Animated.parallel([
        Animated.timing(headlineAnim, { toValue: 1, duration: ANIMATION.UI_MS, useNativeDriver: true }),
        Animated.timing(headlineSlide, { toValue: 0, duration: ANIMATION.UI_MS, easing: easeOut, useNativeDriver: true }),
      ]),
    ]).start();

    // Subtitle "Your profile is ready in the Nekt app"
    Animated.sequence([
      Animated.delay(baseDelay + stagger),
      Animated.timing(subheadAnim, { toValue: 1, duration: ANIMATION.UI_MS, useNativeDriver: true }),
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
          Animated.timing(opacity, { toValue: 1, duration: ANIMATION.UI_MS, useNativeDriver: true }),
          Animated.timing(slide, { toValue: 0, duration: ANIMATION.UI_MS, easing: easeOut, useNativeDriver: true }),
        ]),
      ]).start();
    });

    // Buttons fade in last
    Animated.sequence([
      Animated.delay(baseDelay + stagger * 5),
      Animated.timing(buttonsAnim, { toValue: 1, duration: ANIMATION.UI_MS, useNativeDriver: true }),
    ]).start();
  }, [isSaved]);

  // URL generation for social platforms (matches SocialIconsList/AppClip)
  const SOCIAL_URLS: Record<string, string> = {
    phone: 'tel:',
    email: 'mailto:',
    instagram: 'https://instagram.com/',
    x: 'https://x.com/',
    twitter: 'https://x.com/',
    linkedin: 'https://linkedin.com/in/',
    facebook: 'https://facebook.com/',
    tiktok: 'https://tiktok.com/@',
    youtube: 'https://youtube.com/@',
    snapchat: 'https://snapchat.com/add/',
    threads: 'https://threads.net/@',
    github: 'https://github.com/',
    telegram: 'https://t.me/',
    whatsapp: 'https://wa.me/',
    wechat: 'weixin://dl/chat?',
  };

  const handleSocialIconClick = useCallback((entry: { fieldType: string; value?: string; linkType?: string }) => {
    if (isAuthenticated && entry.value) {
      // Authenticated: open the social URL directly
      let url: string;
      if (entry.linkType === 'custom') {
        url = entry.value.startsWith('http') ? entry.value : `https://${entry.value}`;
      } else {
        const prefix = SOCIAL_URLS[entry.fieldType] || '';
        url = prefix ? `${prefix}${entry.value}` : entry.value;
      }
      Linking.openURL(url).catch((err) => {
        console.warn('[AnonContactView] Failed to open URL:', url, err);
      });
    } else {
      // Not authenticated: show eager beaver modal
      const iconType = entry.linkType === 'custom' ? 'custom' : entry.fieldType;
      setClickedSocial(iconType);
      setShowEagerBeaverModal(true);
    }
  }, [isAuthenticated]);

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

            {/* Content Card */}
            <View style={styles.contentCard}>
              <BlurView
                style={StyleSheet.absoluteFillObject}
                tint="dark"
                intensity={50}
              />
              <Text style={styles.name}>{name}</Text>
              <BodyText style={styles.bio}>{bio}</BodyText>
              {socialEntries.length > 0 && (
                <View style={styles.socialIconsContainer}>
                  {socialEntries.map((entry, i) => {
                    const isCustom = entry.linkType === 'custom';
                    return (
                      <SocialIcon
                        key={`${entry.fieldType}-${entry.section}-${i}`}
                        platform={isCustom ? 'custom' : entry.fieldType}
                        customIcon={isCustom ? entry.icon : undefined}
                        linkType={isCustom ? 'custom' : undefined}
                        size="md"
                        variant="white"
                        onPress={() => handleSocialIconClick(entry)}
                      />
                    );
                  })}
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

            {/* Subtitle — outside card */}
            <Animated.Text style={[styles.upsellSubtitle, { opacity: subheadAnim }]}>
              Your profile is ready in the Nekt app
            </Animated.Text>

            {/* Features Card */}
            <View style={styles.upsellCard}>
              <BlurView
                style={StyleSheet.absoluteFillObject}
                tint="dark"
                intensity={50}
              />

              {/* Feature 1 — Connect instantly */}
              <Animated.View
                style={[
                  styles.upsellFeature,
                  { opacity: row1Anim, transform: [{ translateY: row1Slide }] },
                ]}
              >
                <View style={styles.upsellIconWrap}>
                  <PhoneExchangeIcon />
                </View>
                <View style={styles.upsellFeatureText}>
                  <Text style={styles.upsellFeatureTitle}>Connect instantly</Text>
                  <Text style={styles.upsellFeatureDesc}>
                    Bump phones to share info
                  </Text>
                </View>
              </Animated.View>

              {/* Feature 2 — Save automatically */}
              <Animated.View
                style={[
                  styles.upsellFeature,
                  { opacity: row2Anim, transform: [{ translateY: row2Slide }] },
                ]}
              >
                <View style={styles.upsellIconWrap}>
                  <UserPlusIcon />
                </View>
                <View style={styles.upsellFeatureText}>
                  <Text style={styles.upsellFeatureTitle}>Save automatically</Text>
                  <Text style={styles.upsellFeatureDesc}>
                    Never lose a new connection
                  </Text>
                </View>
              </Animated.View>

              {/* Feature 3 — Schedule effortlessly */}
              <Animated.View
                style={[
                  styles.upsellFeature,
                  { opacity: row3Anim, transform: [{ translateY: row3Slide }] },
                ]}
              >
                <View style={styles.upsellIconWrap}>
                  <CalendarCheckIcon />
                </View>
                <View style={styles.upsellFeatureText}>
                  <Text style={styles.upsellFeatureTitle}>Schedule effortlessly</Text>
                  <Text style={styles.upsellFeatureDesc}>
                    Find the perfect time to hang
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
                Get Nekt
              </Button>
              <View style={styles.secondaryButtonContainer}>
                <SecondaryButton onPress={onReject || (() => {})}>
                  Maybe later
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
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    overflow: 'hidden',
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
    gap: 16,
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
    ...textSizes.xxxl,
    ...fontStyles.bold,
    textAlign: 'center',
    marginBottom: 8,
  },
  upsellSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    ...textSizes.base,
    ...fontStyles.regular,
    textAlign: 'center',
    marginBottom: 24,
  },
  upsellCard: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 24,
    overflow: 'hidden',
  },
  upsellFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  upsellIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellFeatureText: {
    flex: 1,
    gap: 2,
  },
  upsellFeatureTitle: {
    color: '#ffffff',
    ...textSizes.base,
    ...fontStyles.bold,
  },
  upsellFeatureDesc: {
    color: 'rgba(255, 255, 255, 0.7)',
    ...textSizes.sm,
    ...fontStyles.regular,
  },
});

export default AnonContactView;
