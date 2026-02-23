import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import Avatar from '../elements/Avatar';
import { SocialIconsList } from '../elements/SocialIconsList';
import { ProfileViewSelector } from '../controls/ProfileViewSelector';
import { Heading, BodyText, textSizes, fontStyles } from '../Typography';
import { getApiBaseUrl, getFieldValue, ANIMATION } from '@nektus/shared-client';
import { useProfile, type SharingCategory } from '../../../../app/context/ProfileContext';
import type { UserProfile, ContactEntry } from '../../../../app/context/ProfileContext';
import { useAdminModeActivator } from '../banners/AdminBanner';
import { generateProfileColors } from '../../../../shared/colors';

interface ProfileAnimatedValues {
  scale: Animated.Value;
  translateY: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;
}

interface ProfileInfoProps {
  profile: UserProfile;
  profileImageSrc?: string;
  bioContent: string;
  isLoadingProfile?: boolean;
  isGoogleInitials?: boolean; // Whether Google profile has auto-generated initials
  showQRCode?: boolean; // Whether to show QR code instead of profile details
  matchToken?: string; // Token for QR code URL
  animatedValues?: ProfileAnimatedValues; // Animation values from useProfileAnimations
  showCameraOverlay?: boolean;
  onCameraPress?: () => void;
  onAddBioPress?: () => void;
  isBioLoading?: boolean;
  onAddLinkPress?: () => void;
}

/**
 * Camera overlay button with scale press feedback (no opacity change to preserve blur)
 */
const CameraOverlayButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.9,
      duration: ANIMATION.MICRO_MS,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.cameraOverlay, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.cameraOverlayInner}
      >
        <BlurView
          style={StyleSheet.absoluteFillObject}
          tint="dark"
          intensity={50}
        />
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
          <Path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <Path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </Svg>
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Filter profile by category (Personal or Work)
 */
const filterProfileByCategory = (profile: UserProfile, category: SharingCategory): UserProfile => {
  if (!profile.contactEntries) {
    return { ...profile, contactEntries: [] };
  }

  const filteredEntries = profile.contactEntries.filter(entry => {
    // Universal entries appear in both views
    if (entry.section === 'universal') return true;
    // Match section to category (case-insensitive)
    return entry.section?.toLowerCase() === category.toLowerCase();
  });

  return {
    ...profile,
    contactEntries: filteredEntries,
  };
};

/**
 * Single carousel panel for Personal or Work view
 */
const ProfilePanel: React.FC<{
  section: 'personal' | 'work';
  profile: UserProfile;
  containerWidth: number;
  isBioLoading: boolean;
  isBioPlaceholder: boolean;
  bioContent: string;
  skeletonOpacity: Animated.Value;
  onAddBioPress?: () => void;
  filteredContactEntries: ContactEntry[];
  visibleLinkCount: number;
  onAddLinkPress?: () => void;
}> = ({ section, profile, containerWidth, isBioLoading, isBioPlaceholder, bioContent, skeletonOpacity, onAddBioPress, filteredContactEntries, visibleLinkCount, onAddLinkPress }) => {
  const location = profile?.locations?.find(loc => loc.section === section);

  return (
    <View style={[styles.viewContainer, { width: containerWidth || '100%' }]}>
      <View style={[styles.nameContainer, location && { marginBottom: 4 }]}>
        <Heading style={styles.name}>
          {getFieldValue(profile?.contactEntries, 'name') || 'They-who-must-not-be-named'}
        </Heading>
      </View>

      {location && (
        <View style={styles.locationRow}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </Svg>
          <BodyText style={styles.locationText}>
            {location.city}, {location.region}
          </BodyText>
        </View>
      )}

      <View style={styles.bioContainer}>
        {isBioLoading ? (
          <View style={styles.skeletonContainer}>
            <Animated.View style={[styles.skeletonBar, styles.skeletonBarLong, { opacity: skeletonOpacity }]} />
            <Animated.View style={[styles.skeletonBar, styles.skeletonBarShort, { opacity: skeletonOpacity }]} />
          </View>
        ) : isBioPlaceholder && onAddBioPress ? (
          <TouchableOpacity onPress={onAddBioPress} style={styles.addBioButton}>
            <BodyText style={styles.addBioText}>+ Add Bio</BodyText>
          </TouchableOpacity>
        ) : (
          <BodyText style={styles.bioText}>{bioContent}</BodyText>
        )}
      </View>

      <View style={styles.iconsContainer}>
        {filteredContactEntries && (
          <SocialIconsList
            contactEntries={filteredContactEntries}
            showAddButton={visibleLinkCount <= 4 && !!onAddLinkPress}
            onAddPress={onAddLinkPress}
          />
        )}
      </View>
    </View>
  );
};

export const ProfileInfo: React.FC<ProfileInfoProps> = ({
  profile,
  profileImageSrc,
  bioContent,
  isLoadingProfile = false,
  isGoogleInitials = false,
  showQRCode = false,
  matchToken,
  animatedValues,
  showCameraOverlay = false,
  onCameraPress,
  onAddBioPress,
  isBioLoading = false,
  onAddLinkPress,
}) => {
  // Dynamic avatar sizing based on screen width
  const { width: screenWidth } = useWindowDimensions();
  const avatarSize = Math.min(Math.max(screenWidth * 0.5, 120), 300);

  // Get base URL for QR code
  const apiBaseUrl = getApiBaseUrl();
  // Convert API base URL to web URL (remove /api if present, use web domain)
  const webBaseUrl = apiBaseUrl.replace('/api', '').replace('api.', '');
  // Sharing category from Context (replaces AsyncStorage)
  const { sharingCategory, setSharingCategory } = useProfile();
  const [containerWidth, setContainerWidth] = useState(0);
  const [innerContentHeight, setInnerContentHeight] = useState(0); // Track inner content height (without padding) for stable QR transition
  const containerWidthRef = useRef(0);
  const selectedModeRef = useRef<SharingCategory>(sharingCategory);
  const translateX = useRef(new Animated.Value(0)).current;

  // Keep showInitials true when we have Google initials, even when profileImageSrc arrives
  // This enables the Avatar component to crossfade from initials to the generated image
  const showInitialsValue = isGoogleInitials;

  // Use actual profile colors when available (photo-extracted), fall back to name-generated
  const name = getFieldValue(profile?.contactEntries, 'name') || 'They-who-must-not-be-named';
  const profileColors = (profile.backgroundColors?.length === 3
    ? profile.backgroundColors as [string, string, string]
    : generateProfileColors(name));

  // Admin mode activator - double-tap on avatar to toggle
  const adminActivator = useAdminModeActivator();

  // Keep ref in sync with context
  useEffect(() => {
    selectedModeRef.current = sharingCategory;
  }, [sharingCategory]);

  // Filter contact entries based on selected mode
  const filteredContactEntries = React.useMemo(() => {
    if (profile?.contactEntries) {
      const filteredProfile = filterProfileByCategory(profile, sharingCategory);
      return filteredProfile.contactEntries;
    }
    return profile?.contactEntries || [];
  }, [profile, sharingCategory]);

  // Count visible non-empty social links (exclude name/bio)
  const visibleLinkCount = React.useMemo(() => {
    return (filteredContactEntries || []).filter(e =>
      e.fieldType !== 'name' && e.fieldType !== 'bio' &&
      e.isVisible !== false && !!e.value?.trim()
    ).length;
  }, [filteredContactEntries]);

  const defaultBioPlaceholder = 'My bio is going to be awesome once I create it.';
  const isBioPlaceholder = bioContent === defaultBioPlaceholder;

  // Bio skeleton animation
  const skeletonOpacity = React.useRef(new Animated.Value(0.3)).current;
  React.useEffect(() => {
    if (isBioLoading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonOpacity, { toValue: 0.7, duration: ANIMATION.CINEMATIC_MS, useNativeDriver: true }),
          Animated.timing(skeletonOpacity, { toValue: 0.3, duration: ANIMATION.CINEMATIC_MS, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isBioLoading, skeletonOpacity]);

  // Handle layout to measure container width (card container)
  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    containerWidthRef.current = width;
    setContainerWidth(width);
  };

  // Handle layout to measure inner content height (without card padding) - matches web approach
  const handleInnerContentLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    // Only capture height when not showing QR code (to maintain stable size)
    if (!showQRCode && height > 0) {
      setInnerContentHeight(height);
    }
  };

  // Handle mode change from selector
  const handleModeChange = (mode: SharingCategory) => {
    if (mode === selectedModeRef.current || !containerWidthRef.current) return;

    setSharingCategory(mode);
    selectedModeRef.current = mode;

    // Animate carousel - use measured container width
    const targetX = mode === 'Work' ? -containerWidthRef.current : 0;
    Animated.timing(translateX, {
      toValue: targetX,
      duration: ANIMATION.UI_MS,
      useNativeDriver: true,
    }).start();
  };

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Aggressively capture horizontal gestures in capture phase
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        // Very low threshold, prioritize horizontal over vertical
        const absX = Math.abs(gestureState.dx);
        const absY = Math.abs(gestureState.dy);
        return absX > 3 && absX > absY;
      },
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        const containerWidth = containerWidthRef.current;
        if (!containerWidth) return;
        const currentOffset = selectedModeRef.current === 'Work' ? -containerWidth : 0;
        translateX.setValue(currentOffset + gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const containerWidth = containerWidthRef.current;
        const currentMode = selectedModeRef.current;
        if (!containerWidth) return;
        const SWIPE_THRESHOLD = 50;

        if (gestureState.dx < -SWIPE_THRESHOLD && currentMode === 'Personal') {
          handleModeChange('Work');
        } else if (gestureState.dx > SWIPE_THRESHOLD && currentMode === 'Work') {
          handleModeChange('Personal');
        } else {
          const targetX = currentMode === 'Work' ? -containerWidth : 0;
          Animated.timing(translateX, {
            toValue: targetX,
            duration: ANIMATION.UI_MS,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Update carousel position when mode changes
  useEffect(() => {
    if (!containerWidthRef.current) return;
    const targetX = sharingCategory === 'Work' ? -containerWidthRef.current : 0;
    Animated.timing(translateX, {
      toValue: targetX,
      duration: ANIMATION.UI_MS,
      useNativeDriver: true,
    }).start();
  }, [sharingCategory, translateX]);

  // Build rotation interpolation for the profile card wobble effect
  const rotationInterpolation = animatedValues?.rotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-2deg', '0deg', '2deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        animatedValues && {
          opacity: animatedValues.opacity,
          transform: [
            { scale: animatedValues.scale },
            { translateY: animatedValues.translateY },
            { rotate: rotationInterpolation || '0deg' },
          ],
        },
      ]}
    >
      {/* Profile Image - tap to change photo when camera overlay shown, double-tap for admin mode */}
      <TouchableOpacity
        style={styles.profileImageContainer}
        onPress={showCameraOverlay && onCameraPress ? onCameraPress : adminActivator.onPress}
        activeOpacity={showCameraOverlay ? 0.8 : 1}
      >
        <View style={{ position: 'relative' }}>
          <View style={[styles.avatarBorder, { borderRadius: (avatarSize + 8) / 2 }]}>
            <Avatar
              src={profileImageSrc}
              alt={getFieldValue(profile?.contactEntries, 'name') || 'They-who-must-not-be-named'}
              sizeNumeric={avatarSize}
              isLoading={isLoadingProfile}
              showInitials={showInitialsValue}
              profileColors={profileColors}
            />
          </View>
          {showCameraOverlay && onCameraPress && (
            <CameraOverlayButton onPress={onCameraPress} />
          )}
        </View>
      </TouchableOpacity>

      {/* Carousel Container - Full width background */}
      {/* Use py-6 (24px) padding for QR mode, py-4 (16px) for normal - matching web */}
      <View
        style={[
          styles.cardContainer,
          { paddingVertical: showQRCode ? 24 : 16 },
        ]}
        onLayout={handleContainerLayout}
      >
        {/* Backdrop blur matching web */}
        <BlurView
          style={StyleSheet.absoluteFillObject}
          tint="dark"
          intensity={50}
        />

        {/* QR Code Display - shows when exchange is active */}
        {showQRCode && matchToken ? (
          <View style={[
            styles.qrCodeContainer,
            // Use inner content height minus padding difference (24-16=8px each side = 16px total)
            // This matches web's adjustedHeight = contentHeight - 16 calculation
            innerContentHeight > 0 ? { height: innerContentHeight - 16 } : undefined,
          ]}>
            <QRCode
              value={`${webBaseUrl}/x/${matchToken}`}
              size={Math.min(containerWidth - 48, innerContentHeight > 0 ? innerContentHeight - 32 : 260)}
              color="#FFFFFF"
              backgroundColor="transparent"
            />
          </View>
        ) : (
        <View onLayout={handleInnerContentLayout}>
        <Animated.View
          style={[
            styles.carouselContainer,
            {
              transform: [{ translateX }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Personal View */}
          <ProfilePanel
            section="personal"
            profile={profile}
            containerWidth={containerWidth}
            isBioLoading={isBioLoading}
            isBioPlaceholder={isBioPlaceholder}
            bioContent={bioContent}
            skeletonOpacity={skeletonOpacity}
            onAddBioPress={onAddBioPress}
            filteredContactEntries={filteredContactEntries}
            visibleLinkCount={visibleLinkCount}
            onAddLinkPress={onAddLinkPress}
          />

          {/* Work View */}
          <ProfilePanel
            section="work"
            profile={profile}
            containerWidth={containerWidth}
            isBioLoading={isBioLoading}
            isBioPlaceholder={isBioPlaceholder}
            bioContent={bioContent}
            skeletonOpacity={skeletonOpacity}
            onAddBioPress={onAddBioPress}
            filteredContactEntries={filteredContactEntries}
            visibleLinkCount={visibleLinkCount}
            onAddLinkPress={onAddLinkPress}
          />
        </Animated.View>

        {/* Profile View Selector */}
        <View style={styles.selectorContainer}>
          <ProfileViewSelector
            selected={sharingCategory}
            onSelect={handleModeChange}
            tintColor={profile?.backgroundColors?.[2]}
          />
        </View>
        </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    // No padding - should come from parent like web version
  },
  profileImageContainer: {
    marginBottom: 16,
    alignItems: 'center',
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
  cardContainer: {
    width: '100%',
    backgroundColor: 'transparent', // BlurView now handles background
    borderRadius: 16,
    overflow: 'hidden',
    // paddingVertical is set dynamically: 24 for QR mode, 16 for normal (matching web py-6/py-4)
    // Height is controlled by inner content + padding, not minHeight (matching web approach)
  },
  carouselContainer: {
    flexDirection: 'row',
  },
  qrCodeContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24, // Match web's px-6
  },
  viewContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  nameContainer: {
    marginBottom: 12,
    alignItems: 'center',
  },
  name: {
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  locationText: {
    color: 'rgba(255, 255, 255, 0.9)',
    ...textSizes.sm,
  },
  bioContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  bioText: {
    textAlign: 'center',
    color: '#ffffff',
    ...textSizes.sm,
  },
  iconsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  selectorContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 56,
    height: 56,
    borderRadius: 28,
    zIndex: 20,
  },
  cameraOverlayInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addBioButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  addBioText: {
    textAlign: 'center',
    color: '#ffffff',
    ...textSizes.sm,
    ...fontStyles.bold,
  },
  skeletonContainer: {
    gap: 8,
    alignItems: 'center',
  },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  skeletonBarLong: {
    width: '75%',
  },
  skeletonBarShort: {
    width: '50%',
  },
});

export default ProfileInfo;
