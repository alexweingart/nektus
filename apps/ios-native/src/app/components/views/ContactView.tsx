/**
 * ContactView component - Displays a matched contact's profile
 * Similar to ProfileView but read-only with Save/Message actions
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Linking, Alert, ActivityIndicator, Animated, Easing, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../App';
import type { UserProfile } from '@nektus/shared-types';
import { getApiBaseUrl, getIdToken } from '../../../client/auth/firebase';
import { ClientProfileService } from '../../../client/firebase/firebase-save';
import { isAppClip } from '../../../client/auth/session-handoff';
import { useSession } from '../../providers/SessionProvider';
import { useProfile } from '../../context/ProfileContext';
import { PageHeader } from '../ui/layout/PageHeader';
import { ScreenTransition, useGoBackWithFade } from '../ui/layout/ScreenTransition';
import { ContactInfo } from '../ui/modules/ContactInfo';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { StandardModal } from '../ui/modals/StandardModal';
import { saveContactFlow, MeCardData } from '../../../client/contacts/save';
import { showAppStoreOverlay } from '../../../client/native/SKOverlayWrapper';

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

/**
 * Get a field value from ContactEntry array by fieldType
 */
const getFieldValue = (contactEntries: any[] | undefined, fieldType: string): string => {
  if (!contactEntries) return '';
  const entry = contactEntries.find(e => e.fieldType === fieldType);
  return entry?.value || '';
};

/**
 * Get first name from full name
 */
const getFirstName = (name: string): string => {
  if (!name) return '';
  return name.split(' ')[0];
};

export function ContactView(props: ContactViewProps = {}) {
  const inAppClip = isAppClip();

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

  const { data: session } = useSession();
  const { saveProfile } = useProfile();
  const apiBaseUrl = getApiBaseUrl();

  // Use props.profile directly if provided (App Clip), otherwise fetch
  const [profile, setProfile] = useState<UserProfile | null>(props.profile || null);
  const [isLoading, setIsLoading] = useState(!props.profile);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Animation values (matching web's contactEnter animation)
  // Card: translateY(-200 → 0), scale(0.6 → 1), opacity(0 → 1)
  // Buttons: translateY(10 → 0), opacity(0 → 1) with 300ms delay
  const cardTranslateY = useRef(new Animated.Value(-200)).current;
  const cardScale = useRef(new Animated.Value(0.6)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(10)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

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

          console.log('🧪 [ContactView] Using mock profile for test animation');
          setProfile(mockProfile);
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
          if (result.success && result.profile) {
            setProfile(result.profile);
          } else if (result.profile) {
            setProfile(result.profile);
          } else {
            throw new Error('Invalid response');
          }
        }
      } catch (error) {
        console.error('[ContactView] Failed to fetch profile:', error);
        Alert.alert('Error', 'Failed to load contact');
        navigation?.goBack();
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [props.profile, userId, token, isHistoricalMode, apiBaseUrl, navigation, session?.user?.id]);

  // Enter animation - runs on mount with 500ms delay (matches web's profile exit duration)
  useEffect(() => {
    // Skip animation for historical mode (like web)
    if (isHistoricalMode) {
      cardTranslateY.setValue(0);
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      buttonsTranslateY.setValue(0);
      buttonsOpacity.setValue(1);
      return;
    }

    // Delay animation start by 500ms to let ProfileView exit animation complete
    const enterTimer = setTimeout(() => {
      // Card animation: translateY(-200 → 0), scale(0.6 → 1), opacity(0 → 1) - 500ms
      Animated.parallel([
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.bezier(0, 0, 0.2, 1), // ease-in
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: 500,
          easing: Easing.bezier(0, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Buttons animation with 300ms delay: translateY(10 → 0), opacity(0 → 1) - 200ms
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(buttonsTranslateY, {
            toValue: 0,
            duration: 200,
            easing: Easing.bezier(0, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(buttonsOpacity, {
            toValue: 1,
            duration: 200,
            easing: Easing.bezier(0, 0, 0.2, 1),
            useNativeDriver: true,
          }),
        ]).start();
      }, 300);
    }, 500);

    return () => clearTimeout(enterTimer);
  }, [isHistoricalMode, cardTranslateY, cardScale, cardOpacity, buttonsTranslateY, buttonsOpacity]);

  // Exit animation - simple fade out (300ms, matches web's crossfadeExit)
  const playExitAnimation = useCallback((onComplete: () => void) => {
    setIsExiting(true);
    Animated.timing(exitOpacity, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onComplete();
      }
    });
  }, [exitOpacity]);

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

  // Handle back navigation with exit animation
  const handleBack = useCallback(() => {
    if (inAppClip) {
      // App Clip: use custom exit animation then navigate to web
      playExitAnimation(() => {
        navigateToWeb();
      });
    } else if (goBackWithFade) {
      // Full app: use ScreenTransition fade
      goBackWithFade();
    } else {
      // Fallback
      navigation?.goBack();
    }
  }, [inAppClip, navigation, navigateToWeb, playExitAnimation, goBackWithFade]);

  // Handle Me Card data extraction callback
  const handleMeCardExtracted = useCallback(async (meCardData: MeCardData) => {
    // Auto-fill user's profile if phone or photo is missing
    if (!saveProfile) return;

    console.log('[ContactView] Me Card data received, checking if profile needs update');

    // TODO: Check if user's profile is missing phone or has AI-generated photo
    // For now, just log the data - the actual profile update logic will be added later
    // This would involve checking the current profile and calling saveProfile with updates
    if (meCardData.phone) {
      console.log('[ContactView] Me Card has phone:', meCardData.phone);
    }
    if (meCardData.imageBase64) {
      console.log('[ContactView] Me Card has image');
    }
  }, [saveProfile]);

  // Handle save contact
  const handleSaveContact = useCallback(async () => {
    if (isSaved) {
      // Already saved - "Done" button tapped, navigate back
      if (inAppClip) {
        playExitAnimation(() => {
          navigateToWeb();
        });
      } else if (goBackWithFade) {
        goBackWithFade();
      } else {
        navigation?.goBack();
      }
      return;
    }

    if (!profile || !token) {
      Alert.alert('Error', 'Cannot save contact - missing data');
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
        console.log('[ContactView] Save successful:', {
          firebase: result.firebase.success,
          native: result.native.success,
          usedVCard: result.native.usedVCard,
        });
        setIsSaved(true);
        setShowSuccessModal(true);
      } else {
        console.error('[ContactView] Save failed:', result);
        Alert.alert('Error', 'Failed to save contact. Please try again.');
      }
    } catch (error) {
      console.error('[ContactView] Save failed:', error);
      Alert.alert('Error', 'Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  }, [isSaved, inAppClip, navigation, navigateToWeb, profile, token, handleMeCardExtracted, playExitAnimation, goBackWithFade]);

  // Handle reject/dismiss - uses same logic as back
  const handleReject = useCallback(() => {
    if (inAppClip) {
      playExitAnimation(() => {
        navigateToWeb();
      });
    } else if (goBackWithFade) {
      goBackWithFade();
    } else {
      navigation?.goBack();
    }
  }, [inAppClip, navigation, navigateToWeb, playExitAnimation, goBackWithFade]);

  // Handle say hi (open messaging)
  const handleSayHi = useCallback(() => {
    if (!profile) return;

    const phoneNumber = getFieldValue(profile.contactEntries, 'phone');
    const contactName = getFirstName(getFieldValue(profile.contactEntries, 'name'));
    // Use props.sessionUserName in App Clip, otherwise session.user.name
    const senderName = getFirstName(props.sessionUserName || session?.user?.name || '');

    const message = `Hey ${contactName}! It's ${senderName} - nice meeting you!`;

    setShowSuccessModal(false);

    if (phoneNumber) {
      const smsUrl = `sms:${phoneNumber}&body=${encodeURIComponent(message)}`;
      Linking.openURL(smsUrl).catch(() => {
        Alert.alert('Error', 'Could not open messaging app');
      });
    } else {
      Alert.alert('No Phone Number', 'This contact doesn\'t have a phone number');
    }
    // Note: SKOverlay is shown when user taps "Done", not after messaging
  }, [profile, props.sessionUserName, session]);

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
          <Text style={styles.errorText}>Contact not found</Text>
        </View>
      </>
    );
  }

  const bioContent = getFieldValue(profile.contactEntries, 'bio') || 'Welcome to my profile!';
  const contactName = getFieldValue(profile.contactEntries, 'name');

  return (
    <ScreenTransition>
      <Animated.View style={[styles.container, inAppClip ? { opacity: exitOpacity } : undefined]}>
        {/* Header - back button only for historical mode, not for new exchanges */}
        <PageHeader onBack={isHistoricalMode ? handleBack : undefined} />

        {/* Content area - centers ContactInfo + buttons as a unit (like web) */}
        <View style={styles.content}>
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
              // Historical mode buttons
              <>
                <Button
                  variant="white"
                  size="xl"
                  onPress={handleSayHi}
                  style={styles.fullWidth}
                >
                  <Text style={styles.buttonText}>Say Hi</Text>
                </Button>
                <Button
                  variant="white"
                  size="xl"
                  onPress={() => navigation?.navigate('SmartSchedule', { contactUserId: userId || '' })}
                  style={styles.fullWidth}
                >
                  <Text style={styles.buttonText}>Schedule Meetup</Text>
                </Button>
              </>
            ) : (
              // New contact mode buttons
              <>
                <Button
                  variant="white"
                  size="xl"
                  onPress={handleSaveContact}
                  disabled={isSaving}
                  style={styles.fullWidth}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#374151" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {isSaved ? "I'm Done" : 'Save Contact'}
                    </Text>
                  )}
                </Button>

                {!isSaved && (
                  <View style={styles.secondaryButtonContainer}>
                    <SecondaryButton onPress={handleReject} disabled={isSaving}>
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
        title="Contact Saved!"
        subtitle={`${contactName}'s contact has been saved successfully!`}
        primaryButtonText="Say hi"
        onPrimaryButtonClick={handleSayHi}
        secondaryButtonText="Nah, they'll text me"
        onSecondaryButtonClick={() => setShowSuccessModal(false)}
        showCloseButton={false}
      />
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
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
    fontSize: 16,
  },
  content: {
    flexGrow: 1,
    paddingTop: 8,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  secondaryButtonContainer: {
    alignItems: 'center',
  },
});

export default ContactView;
