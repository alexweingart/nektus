import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from '@react-native-community/blur';
import Svg, { Path } from 'react-native-svg';
import Avatar from '../elements/Avatar';
import { SocialIconsList } from '../elements/SocialIconsList';
import { ProfileViewSelector } from '../controls/ProfileViewSelector';
import { Heading, BodyText } from '../Typography';
import type { UserProfile, ContactEntry } from '../../../../app/context/ProfileContext';

type ProfileViewMode = 'Personal' | 'Work';
type SharingCategory = 'Personal' | 'Work';

interface ProfileInfoProps {
  profile: UserProfile;
  profileImageSrc?: string;
  bioContent: string;
  isLoadingProfile?: boolean;
  isGoogleInitials?: boolean; // Whether Google profile has auto-generated initials
}

/**
 * Get a field value from ContactEntry array by fieldType
 */
const getFieldValue = (contactEntries: ContactEntry[] | undefined, fieldType: string): string => {
  if (!contactEntries) return '';
  const entry = contactEntries.find(e => e.fieldType === fieldType);
  return entry?.value || '';
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

export const ProfileInfo: React.FC<ProfileInfoProps> = ({
  profile,
  profileImageSrc,
  bioContent,
  isLoadingProfile = false,
  isGoogleInitials = false
}) => {
  const [selectedMode, setSelectedMode] = useState<ProfileViewMode>('Personal');
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  // Keep showInitials true when we have Google initials, even when profileImageSrc arrives
  // This enables the Avatar component to crossfade from initials to the generated image
  const showInitialsValue = isGoogleInitials;

  // Load selected mode from AsyncStorage on mount
  useEffect(() => {
    const loadCategory = async () => {
      try {
        const savedCategory = await AsyncStorage.getItem('nekt-sharing-category') as SharingCategory;
        if (savedCategory && ['Personal', 'Work'].includes(savedCategory)) {
          setSelectedMode(savedCategory);
        }
        setHasLoadedFromStorage(true);
      } catch (error) {
        console.warn('Failed to load sharing category from AsyncStorage:', error);
        setHasLoadedFromStorage(true);
      }
    };
    loadCategory();
  }, []);

  // Save selected mode to AsyncStorage when it changes
  useEffect(() => {
    if (!hasLoadedFromStorage) return;

    const saveCategory = async () => {
      try {
        await AsyncStorage.setItem('nekt-sharing-category', selectedMode);
      } catch (error) {
        console.warn('Failed to save sharing category to AsyncStorage:', error);
      }
    };
    saveCategory();
  }, [selectedMode, hasLoadedFromStorage]);

  // Filter contact entries based on selected mode
  const filteredContactEntries = React.useMemo(() => {
    if (profile?.contactEntries && hasLoadedFromStorage) {
      const filteredProfile = filterProfileByCategory(profile, selectedMode);
      return filteredProfile.contactEntries;
    }
    return profile?.contactEntries || [];
  }, [profile, selectedMode, hasLoadedFromStorage]);

  // Handle layout to measure container width
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  // Handle mode change from selector
  const handleModeChange = (mode: ProfileViewMode) => {
    if (mode === selectedMode || !containerWidth) return;

    setSelectedMode(mode);

    // Animate carousel - use measured container width
    const targetX = mode === 'Work' ? -containerWidth : 0;
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
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      // Capture horizontal gestures before ScrollView can claim them
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        // Capture if horizontal movement significantly exceeds vertical
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Claim gesture if horizontal movement exceeds vertical
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
      },
      onPanResponderMove: (_, gestureState) => {
        if (!containerWidth) return;
        const currentOffset = selectedMode === 'Work' ? -containerWidth : 0;
        translateX.setValue(currentOffset + gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!containerWidth) return;
        const SWIPE_THRESHOLD = 50;

        if (gestureState.dx < -SWIPE_THRESHOLD && selectedMode === 'Personal') {
          // Swipe left from Personal to Work
          handleModeChange('Work');
        } else if (gestureState.dx > SWIPE_THRESHOLD && selectedMode === 'Work') {
          // Swipe right from Work to Personal
          handleModeChange('Personal');
        } else {
          // Snap back to current position
          const targetX = selectedMode === 'Work' ? -containerWidth : 0;
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
    if (!containerWidth) return;
    const targetX = selectedMode === 'Work' ? -containerWidth : 0;
    Animated.spring(translateX, {
      toValue: targetX,
      useNativeDriver: true,
      tension: 50,
      friction: 9,
    }).start();
  }, [selectedMode, translateX, containerWidth]);

  return (
    <View style={styles.container}>
      {/* Profile Image */}
      <View style={styles.profileImageContainer}>
        <View style={styles.avatarBorder}>
          <Avatar
            src={profileImageSrc}
            alt={getFieldValue(profile?.contactEntries, 'name') || 'Profile'}
            size="lg"
            isLoading={isLoadingProfile}
            showInitials={showInitialsValue}
          />
        </View>
      </View>

      {/* Carousel Container - Full width background */}
      <View style={styles.cardContainer} onLayout={handleLayout}>
        {/* Backdrop blur matching web */}
        <BlurView
          style={StyleSheet.absoluteFillObject}
          blurType="dark"
          blurAmount={16}
          reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.6)"
        />
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
            selected={selectedMode}
            onSelect={handleModeChange}
            tintColor={profile?.backgroundColors?.[2]}
          />
        </View>
      </View>
    </View>
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
    borderRadius: 68, // (128 + 8) / 2
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
    paddingVertical: 16,
  },
  carouselContainer: {
    flexDirection: 'row',
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
