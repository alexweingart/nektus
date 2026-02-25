/**
 * ContactView component - Displays a matched contact's profile
 * Similar to ProfileView but read-only with Save/Message actions
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Linking, Alert, ActivityIndicator, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../App';
import type { UserProfile } from '@nektus/shared-types';
import { getFieldValue, getFirstName } from '@nektus/shared-client';
import { generateProfileColors } from '../../../shared/colors';
import { getApiBaseUrl, getIdToken } from '../../../client/auth/firebase';
import { ClientProfileService } from '../../../client/firebase/firebase-save';
import { isAppClip } from '../../../client/auth/session-handoff';
import * as FileSystem from 'expo-file-system/legacy';
import { useSession } from '../../providers/SessionProvider';
import { useProfile } from '../../context/ProfileContext';
import { PageHeader } from '../ui/layout/PageHeader';
import { ScreenTransition, useGoBackWithFade } from '../ui/layout/ScreenTransition';
import { ContactInfo } from '../ui/modules/ContactInfo';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { ContactButton } from '../ui/buttons/ContactButton';
import { StandardModal } from '../ui/modals/StandardModal';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { saveContactFlow, MeCardData } from '../../../client/contacts/save';
import { showAppStoreOverlay } from '../../../client/native/SKOverlayWrapper';
import { generateMessageText } from '../../../client/contacts/messaging';
import { useContactEnterAnimation } from '../../../client/hooks/use-exchange-animations';
import { emitMatchFound } from '../../utils/animationEvents';
import { textSizes, fontStyles } from '../ui/Typography';

// Demo robot avatar for test mode simulation
const demoRobotAvatarAsset = require('../../../../assets/demo-robot-avatar.png');
const getDemoRobotAvatarUri = () => Image.resolveAssetSource(demoRobotAvatarAsset).uri;

type ContactViewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Contact'>;
type ContactViewRouteProp = RouteProp<RootStackParamList, 'Contact'>;

/**
 * Props for direct use (App Clip) - bypasses React Navigation
 */
interface ContactViewProps {
  /** Direct profile data (App Clip) */
  profile?: UserProfile;
  /** Exchange token */
  token?: string;
  /** Session user name for "Say hi" message (App Clip) */
  sessionUserName?: string | null;
}


export function ContactView(props: ContactViewProps = {}) {
  const inAppClip = isAppClip();
  const insets = useSafeAreaInsets();

  // Navigation hooks - always called (Rules of Hooks), but may return stubs in App Clip
  // In App Clip mode without NavigationContainer, these will fail
  // So we call them unconditionally but only USE the values when not in App Clip
  let navigation: NativeStackNavigationProp<RootStackParamList, 'Contact'> | null = null;
  let route: RouteProp<RootStackParamList, 'Contact'> | null = null;

  // For ScreenTransition fade navigation (full app only)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const goBackWithFade = !inAppClip ? useGoBackWithFade() : null;

  if (!inAppClip) {
    // Only use these hooks in full app mode
    // eslint-disable-next-line react-hooks/rules-of-hooks
    navigation = useNavigation<ContactViewNavigationProp>();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    route = useRoute<ContactViewRouteProp>();
  }

  // Get params from props (App Clip) or route (full app)
  const userId = route?.params?.userId;
  const token = props.token || route?.params?.token || '';
  const isHistoricalMode = route?.params?.isHistoricalMode || false;
  const navBackgroundColors = route?.params?.backgroundColors;

  const { data: session } = useSession();
  const { saveProfile, profile: userProfile } = useProfile();
  const apiBaseUrl = getApiBaseUrl();

  // Use props.profile directly if provided (App Clip), otherwise fetch
  const [profile, setProfile] = useState<UserProfile | null>(props.profile || null);
  const [isLoading, setIsLoading] = useState(!props.profile);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAddCalendarModal, setShowAddCalendarModal] = useState(false);

  // Animation values (matching web's contactEnter animation)
  const {
    cardTranslateY,
    cardScale,
    cardOpacity,
    buttonsTranslateY,
    buttonsOpacity,
    exitOpacity,
    playExitAnimation,
  } = useContactEnterAnimation(isHistoricalMode);

  // Emit match-found for props.profile case (App Clip)
  useEffect(() => {
    if (props.profile?.backgroundColors) {
      emitMatchFound(props.profile.backgroundColors);
    }
  }, [props.profile]);

  // Emit background colors immediately from nav params (before async fetch)
  useEffect(() => {
    if (!props.profile && navBackgroundColors && navBackgroundColors.length >= 3) {
      emitMatchFound(navBackgroundColors);
    }
  }, [navBackgroundColors, props.profile]);

  // Fetch the contact profile (skip if props.profile provided)
  useEffect(() => {
    // Skip fetch if profile provided via props (App Clip)
    if (props.profile) {
      return;
    }

    const fetchProfile = async () => {
      try {
        setIsLoading(true);

        // SPECIAL HANDLING FOR TEST MODE (matches web implementation)
        if (token === 'test-animation-token') {
          // Create mock profile for testing with robot avatar and vibrant colors
          const mockProfile: UserProfile = {
            userId: 'mock-user-123',
            shortCode: 'demo1234',
            profileImage: getDemoRobotAvatarUri(),
            backgroundImage: '',
            lastUpdated: Date.now(),
            backgroundColors: ['#FF6F61', '#FFB6C1', '#FF1493'], // Vibrant coral/pink
            contactEntries: [
              {
                fieldType: 'name',
                value: 'Demo Contact',
                section: 'personal',
                order: 0,
                isVisible: true,
                confirmed: true
              },
              {
                fieldType: 'bio',
                value: 'This is a test contact for animation preview. In real usage, you\'ll see the actual contact\'s profile here after a successful bump exchange!',
                section: 'personal',
                order: 1,
                isVisible: true,
                confirmed: true
              },
              {
                fieldType: 'phone',
                value: '+1234567890',
                section: 'personal',
                order: 2,
                isVisible: true,
                confirmed: true
              },
              {
                fieldType: 'email',
                value: 'demo@example.com',
                section: 'personal',
                order: 3,
                isVisible: true,
                confirmed: true
              },
              {
                fieldType: 'instagram',
                value: 'democontact',
                section: 'personal',
                order: 4,
                isVisible: true,
                confirmed: true
              },
              {
                fieldType: 'x',
                value: 'democontact',
                section: 'personal',
                order: 5,
                isVisible: true,
                confirmed: true
              }
            ],
            calendars: []
          };

          setProfile(mockProfile);
          // Emit match-found to update LayoutBackground colors
          if (mockProfile.backgroundColors) {
            emitMatchFound(mockProfile.backgroundColors);
          }
          setIsLoading(false);
          return;
        }

        if (isHistoricalMode) {
          // For historical contacts, fetch from Firestore
          if (!session?.user?.id) {
            throw new Error('Not authenticated');
          }
          if (!userId) {
            throw new Error('No user ID provided');
          }
          const contact = await ClientProfileService.getContactById(session.user.id, userId);
          if (contact) {
            setProfile(contact);
            // Emit match-found to update LayoutBackground colors
            // Generate fallback colors from name if contact has no backgroundColors
            const colors = contact.backgroundColors?.length && contact.backgroundColors.length >= 3
              ? contact.backgroundColors
              : (() => {
                  const name = getFieldValue(contact.contactEntries, 'name');
                  return name ? generateProfileColors(name) : undefined;
                })();
            if (colors) {
              emitMatchFound(colors);
            }
          } else {
            throw new Error('Contact not found');
          }
        } else {
          // For new contacts, fetch from exchange pair API
          const endpoint = `${apiBaseUrl}/api/exchange/pair/${token}`;
          const idToken = await getIdToken();
          const response = await fetch(endpoint, {
            headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
          });

          if (!response.ok) {
            throw new Error('Failed to fetch contact');
          }

          const result = await response.json();
          if (result.profile) {
            setProfile(result.profile);
            // Emit match-found to update LayoutBackground colors
            if (result.profile.backgroundColors) {
              emitMatchFound(result.profile.backgroundColors);
            }
          } else {
            throw new Error('Invalid response');
          }
        }
      } catch (error) {
        console.error('[ContactView] Failed to fetch profile:', error);
        Alert.alert('Couldn\'t load this person', 'Something went wrong pulling up their profile');
        navigation?.goBack();
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [props.profile, userId, token, isHistoricalMode, apiBaseUrl, navigation, session?.user?.id]);

  // Navigate to web (for App Clip exit)
  const navigateToWeb = useCallback(() => {
    showAppStoreOverlay();
    // Small delay to let user see overlay, then navigate to web
    setTimeout(() => {
      Linking.openURL('https://nekt.us').catch((err) => {
        console.error('[ContactView] Failed to open URL:', err);
      });
    }, 500);
  }, []);

  // App Clip exit: fade out then navigate to web
  const exitAppClip = useCallback(() => {
    playExitAnimation(() => navigateToWeb());
  }, [playExitAnimation, navigateToWeb]);

  // Handle back navigation with exit animation
  const handleBack = useCallback(() => {
    if (inAppClip) {
      exitAppClip();
    } else if (goBackWithFade) {
      // Full app: use ScreenTransition fade
      goBackWithFade();
    } else {
      // Fallback
      navigation?.goBack();
    }
  }, [inAppClip, navigation, exitAppClip, goBackWithFade]);

  // Handle Me Card data extraction callback
  const handleMeCardExtracted = useCallback(async (meCardData: MeCardData) => {
    if (!saveProfile || !userProfile) {
      console.log('[ContactView] Me Card: skipping — saveProfile:', !!saveProfile, 'userProfile:', !!userProfile);
      return;
    }
    console.log('[ContactView] Me Card: processing extraction, hasImage:', !!meCardData.imageFileUri, 'currentProfileImage:', !!userProfile.profileImage);

    const updates: Partial<UserProfile> = {};
    const entries = [...(userProfile.contactEntries || [])];

    // Auto-fill phone if user has no phone entry
    if (meCardData.phone) {
      const hasPhone = entries.some(e => e.fieldType === 'phone' && e.value);
      if (!hasPhone) {
        const phoneIndex = entries.findIndex(e => e.fieldType === 'phone');
        if (phoneIndex >= 0) {
          entries[phoneIndex] = { ...entries[phoneIndex], value: meCardData.phone };
        } else {
          entries.push({
            fieldType: 'phone',
            value: meCardData.phone,
            section: 'personal' as const,
            order: 0,
            isVisible: true,
            confirmed: true,
          });
        }
        updates.contactEntries = entries;
      }
    }

    // Set profile photo from Me Card if user has no photo or only an AI-generated one
    if (meCardData.imageFileUri && (!userProfile.profileImage || userProfile.aiGeneration?.avatarGenerated) && session?.user?.id) {
      try {
        // Read image file as base64 using expo-file-system (same as ProfileImageIcon).
        // This avoids passing large base64 through the RN bridge which triggers
        // Hermes's "ArrayBuffer blob not supported" error.
        const base64 = await FileSystem.readAsStringAsync(meCardData.imageFileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const imageData = `data:image/jpeg;base64,${base64}`;

        console.log('[ContactView] Me Card: uploading photo via API...', `(${Math.round(base64.length / 1024)}KB)`);
        const apiBaseUrl = getApiBaseUrl();
        const idToken = await getIdToken();
        if (!idToken) throw new Error('No Firebase ID token');

        const response = await fetch(`${apiBaseUrl}/api/profile/generate/profile-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ imageData }),
        });

        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
        const data = await response.json();

        if (data.imageUrl) {
          updates.profileImage = data.imageUrl;
          if (data.backgroundColors) {
            updates.backgroundColors = data.backgroundColors;
          }
          if (userProfile.aiGeneration?.avatarGenerated) {
            updates.aiGeneration = {
              ...userProfile.aiGeneration,
              avatarGenerated: false,
            };
          }
          console.log('[ContactView] Me Card: photo uploaded successfully');
        }
      } catch (error) {
        console.error('[ContactView] Me Card: failed to upload photo:', error);
      }
    }

    if (Object.keys(updates).length > 0) {
      await saveProfile(updates);
    }
  }, [saveProfile, userProfile, session]);

  // Handle save contact
  const handleSaveContact = useCallback(async () => {
    if (isSaved) {
      // Already saved - "Done" button tapped, navigate back
      if (inAppClip) {
        exitAppClip();
      } else if (goBackWithFade) {
        goBackWithFade();
      } else {
        navigation?.goBack();
      }
      return;
    }

    if (!profile || !token) {
      Alert.alert('Hmm, that didn\'t work', 'Cannot save contact — missing data');
      return;
    }

    try {
      setIsSaving(true);

      // Use the actual save service
      const result = await saveContactFlow(profile, token, {
        saveToNative: true,
        onMeCardExtracted: handleMeCardExtracted,
      });

      if (result.success) {
        setIsSaved(true);
        setShowSuccessModal(true);
      } else {
        console.error('[ContactView] Save failed:', result);
        Alert.alert('Hmm, that didn\'t work', 'Couldn\'t save — try one more time?');
      }
    } catch (error) {
      console.error('[ContactView] Save failed:', error);
      Alert.alert('Error', 'Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  }, [isSaved, inAppClip, navigation, exitAppClip, profile, token, handleMeCardExtracted, goBackWithFade]);

  // Handle say hi (open messaging)
  const handleSayHi = useCallback(() => {
    if (!profile) return;

    const phoneNumber = getFieldValue(profile.contactEntries, 'phone');
    const contactFirstName = getFirstName(getFieldValue(profile.contactEntries, 'name'));
    // Get sender name: profile contactEntries first (most reliable), then session, then App Clip prop
    const senderName = getFieldValue(userProfile?.contactEntries, 'name') || props.sessionUserName || session?.user?.name || '';
    const senderFirstName = getFirstName(senderName);

    // Use shortCode if available, fall back to userId (both work with /c/ route)
    const senderProfileId = userProfile?.shortCode;
    const message = generateMessageText(contactFirstName, senderFirstName, undefined, senderProfileId);

    setShowSuccessModal(false);

    if (phoneNumber) {
      const smsUrl = `sms:${phoneNumber}&body=${encodeURIComponent(message)}`;
      Linking.openURL(smsUrl).catch(() => {
        Alert.alert('Can\'t open messages', 'Something\'s off with the messaging app');
      });
    } else {
      Alert.alert('No number yet', 'They haven\'t added their phone number');
    }
    // Note: SKOverlay is shown when user taps "Done", not after messaging
  }, [profile, props.sessionUserName, session, userProfile?.contactEntries, userProfile?.shortCode]);

  // Handle Meet Up button - check for linked calendar first (matches web)
  const handleScheduleMeetUp = useCallback(() => {
    if (!session?.user?.id) return;

    // Check if user has a calendar (use 'personal' as default section, matching web behavior)
    const userHasCalendar = userProfile?.calendars?.some(
      (cal) => cal.section === 'personal'
    );

    const contactUserId = userId || profile?.userId || '';

    if (userHasCalendar) {
      navigation?.navigate('SmartSchedule', {
        contactUserId,
        backgroundColors: profile?.backgroundColors,
        contactProfile: profile,
      });
    } else {
      setShowAddCalendarModal(true);
    }
  }, [session?.user?.id, userProfile?.calendars, navigation, userId, profile]);

  // Handle calendar added from modal - navigate to smart schedule
  const handleCalendarAdded = useCallback(() => {
    setShowAddCalendarModal(false);
    navigation?.navigate('SmartSchedule', {
      contactUserId: userId || profile?.userId || '',
      backgroundColors: profile?.backgroundColors,
      contactProfile: profile,
    });
  }, [navigation, userId, profile]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // No profile state
  if (!profile) {
    return (
      <>
        <PageHeader title="Contact" onBack={isHistoricalMode ? handleBack : undefined} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>This person is a ghost</Text>
        </View>
      </>
    );
  }

  const bioContent = getFieldValue(profile.contactEntries, 'bio') || 'Too cool for a bio. Google me.';
  const contactName = getFieldValue(profile.contactEntries, 'name');

  return (
    <ScreenTransition>
      <Animated.View style={[styles.container, inAppClip ? { opacity: exitOpacity } : undefined]}>
        {/* Header - positioned absolutely to not affect centering */}
        <View style={styles.headerContainer}>
          <PageHeader onBack={isHistoricalMode ? handleBack : undefined} />
        </View>

        {/* Content area - centered against full page (including top safe area)
            LayoutBackground adds paddingTop: insets.top, so we offset by -insets.top/2
            to visually center relative to the full screen height */}
        <View style={[styles.content, { paddingBottom: insets.bottom, marginTop: -insets.top / 2 }]}>
          {/* Contact Info - animated entry from top */}
          <Animated.View
            style={{
              opacity: cardOpacity,
              transform: [
                { translateY: cardTranslateY },
                { scale: cardScale },
              ],
            }}
          >
            <ContactInfo profile={profile} bioContent={bioContent} />
          </Animated.View>

          {/* Action Buttons - animated entry with delay */}
          <Animated.View
            style={[
              styles.actionsContainer,
              {
                opacity: buttonsOpacity,
                transform: [{ translateY: buttonsTranslateY }],
              },
            ]}
          >
            {isHistoricalMode ? (
              // Historical mode buttons (matching web)
              <>
                {/* Meet Up Button (Primary) - checks for calendar first */}
                <Button
                  variant="white"
                  size="xl"
                  onPress={handleScheduleMeetUp}
                  style={styles.fullWidth}
                >
                  <Text style={styles.buttonText}>Meet Up 🤝</Text>
                </Button>

                {/* Say Hi Button (Secondary) */}
                <View style={styles.secondaryButtonContainer}>
                  <SecondaryButton onPress={handleSayHi}>
                    Say Hi
                  </SecondaryButton>
                </View>
              </>
            ) : (
              // New contact mode buttons
              <>
                {isSaved ? (
                  <Button
                    variant="white"
                    size="xl"
                    onPress={handleScheduleMeetUp}
                    style={{ width: '100%' }}
                  >
                    Let's hang
                  </Button>
                ) : (
                  <ContactButton
                    isSuccess={isSaved}
                    isSaving={isSaving}
                    onPress={handleSaveContact}
                  />
                )}

                {isSaved && (
                  <View style={styles.secondaryButtonContainer}>
                    <SecondaryButton onPress={handleSaveContact}>
                      Maybe later
                    </SecondaryButton>
                  </View>
                )}

                {!isSaved && (
                  <View style={styles.secondaryButtonContainer}>
                    <SecondaryButton onPress={handleBack} disabled={isSaving}>
                      Nah, who this
                    </SecondaryButton>
                  </View>
                )}
              </>
            )}
          </Animated.View>
        </View>
      </Animated.View>

      {/* Success Modal */}
      <StandardModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Contact Saved! 🎉"
        subtitle={`You and ${contactName} are officially nekt'd!`}
        primaryButtonText="Say hi 👋"
        onPrimaryButtonClick={handleSayHi}
        secondaryButtonText="Nah, they'll text me"
        onSecondaryButtonClick={() => setShowSuccessModal(false)}
        showCloseButton={false}
      />

      {/* Add Calendar Modal - shown when user taps Meet Up without a linked calendar */}
      <AddCalendarModal
        isOpen={showAddCalendarModal}
        onClose={() => setShowAddCalendarModal(false)}
        section="personal"
        userEmail={session?.user?.email || getFieldValue(userProfile?.contactEntries, 'email') || ''}
        onCalendarAdded={handleCalendarAdded}
      />
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#ffffff',
    ...textSizes.base,
    ...fontStyles.regular,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  actionsContainer: {
    marginTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  fullWidth: {
    width: '100%',
  },
  buttonText: {
    ...textSizes.xl,
    ...fontStyles.bold,
    color: '#374151',
  },
  secondaryButtonContainer: {
    alignItems: 'center',
  },
});
