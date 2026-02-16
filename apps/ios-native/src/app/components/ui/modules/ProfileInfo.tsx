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
import { Heading, BodyText } from '../Typography';
import { getApiBaseUrl, getFieldValue } from '@nektus/shared-client';
import { useProfile, type SharingCategory } from '../../../../app/context/ProfileContext';
import type { UserProfile, ContactEntry } from '../../../../app/context/ProfileContext';
import { useAdminModeActivator } from '../banners/AdminBanner';

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
}

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

export const ProfileInfo: React.FC<ProfileInfoProps> = ({
  profile,
  profileImageSrc,
  bioContent,
  isLoadingProfile = false,
  isGoogleInitials = false,
  showQRCode = false,
  matchToken,
  animatedValues,
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

  // Handle layout to measure container width (card container)
  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    console.log('[ProfileInfo] Container width measured:', width);
    containerWidthRef.current = width;
    setContainerWidth(width);
  };

  // Handle layout to measure inner content height (without card padding) - matches web approach
  const handleInnerContentLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    console.log('[ProfileInfo] Inner content height measured:', height);
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
    Animated.spring(translateX, {
      toValue: targetX,
      useNativeDriver: true,
      tension: 50,
      friction: 9,
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
      onPanResponderGrant: () => {
        console.log('[ProfileInfo] Pan responder granted, containerWidth:', containerWidthRef.current, 'mode:', selectedModeRef.current);
      },
      onPanResponderMove: (_, gestureState) => {
        const containerWidth = containerWidthRef.current;
        if (!containerWidth) {
          console.log('[ProfileInfo] Pan move blocked - no containerWidth');
          return;
        }
        const currentOffset = selectedModeRef.current === 'Work' ? -containerWidth : 0;
        translateX.setValue(currentOffset + gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const containerWidth = containerWidthRef.current;
        const currentMode = selectedModeRef.current;
        console.log('[ProfileInfo] Pan release - dx:', gestureState.dx, 'mode:', currentMode, 'containerWidth:', containerWidth);
        if (!containerWidth) return;
        const SWIPE_THRESHOLD = 50;

        if (gestureState.dx < -SWIPE_THRESHOLD && currentMode === 'Personal') {
          console.log('[ProfileInfo] Swiping left to Work');
          handleModeChange('Work');
        } else if (gestureState.dx > SWIPE_THRESHOLD && currentMode === 'Work') {
          console.log('[ProfileInfo] Swiping right to Personal');
          handleModeChange('Personal');
        } else {
          console.log('[ProfileInfo] Snapping back to current position');
          const targetX = currentMode === 'Work' ? -containerWidth : 0;
          Animated.spring(translateX, {
            toValue: targetX,
            useNativeDriver: true,
            tension: 50,
            friction: 9,
          }).start();
        }
      },
    })
  ).current;

  // Update carousel position when mode changes
  useEffect(() => {
    if (!containerWidthRef.current) return;
    const targetX = sharingCategory === 'Work' ? -containerWidthRef.current : 0;
    Animated.spring(translateX, {
      toValue: targetX,
      useNativeDriver: true,
      tension: 50,
      friction: 9,
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
      {/* Profile Image - double-tap to toggle admin mode */}
      <TouchableOpacity
        style={styles.profileImageContainer}
        onPress={adminActivator.onPress}
        activeOpacity={1}
      >
        <View style={[styles.avatarBorder, { borderRadius: (avatarSize + 8) / 2 }]}>
          <Avatar
            src={profileImageSrc}
            alt={getFieldValue(profile?.contactEntries, 'name') || 'Profile'}
            sizeNumeric={avatarSize}
            isLoading={isLoadingProfile}
            showInitials={showInitialsValue}
          />
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
          <View style={[styles.viewContainer, { width: containerWidth || '100%' }]}>
            {/* Profile Name */}
            <View style={styles.nameContainer}>
              <Heading style={styles.name}>
                {getFieldValue(profile?.contactEntries, 'name')}
              </Heading>
            </View>

            {/* Location Display */}
            {(() => {
              const personalLocation = profile?.locations?.find(loc => loc.section === 'personal');
              if (personalLocation) {
                return (
                  <View style={styles.locationRow}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2}>
                      <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </Svg>
                    <BodyText style={styles.locationText}>
                      {personalLocation.city}, {personalLocation.region}
                    </BodyText>
                  </View>
                );
              }
              return null;
            })()}

            {/* Bio */}
            <View style={styles.bioContainer}>
              <BodyText style={styles.bioText}>{bioContent}</BodyText>
            </View>

            {/* Contact Icons */}
            <View style={styles.iconsContainer}>
              {filteredContactEntries && (
                <SocialIconsList
                  contactEntries={filteredContactEntries}
                />
              )}
            </View>
          </View>

          {/* Work View */}
          <View style={[styles.viewContainer, { width: containerWidth || '100%' }]}>
            {/* Profile Name */}
            <View style={styles.nameContainer}>
              <Heading style={styles.name}>
                {getFieldValue(profile?.contactEntries, 'name')}
              </Heading>
            </View>

            {/* Location Display */}
            {(() => {
              const workLocation = profile?.locations?.find(loc => loc.section === 'work');
              if (workLocation) {
                return (
                  <View style={styles.locationRow}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2}>
                      <Path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <Path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </Svg>
                    <BodyText style={styles.locationText}>
                      {workLocation.city}, {workLocation.region}
                    </BodyText>
                  </View>
                );
              }
              return null;
            })()}

            {/* Bio */}
            <View style={styles.bioContainer}>
              <BodyText style={styles.bioText}>{bioContent}</BodyText>
            </View>

            {/* Contact Icons */}
            <View style={styles.iconsContainer}>
              {filteredContactEntries && (
                <SocialIconsList
                  contactEntries={filteredContactEntries}
                />
              )}
            </View>
          </View>
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
    marginBottom: 8,
  },
  locationText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  bioContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  bioText: {
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 22,
  },
  iconsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  selectorContainer: {
    marginTop: 16,
    alignItems: 'center',
    // No horizontal padding - centered via flexbox like web version
  },
});

export default ProfileInfo;
