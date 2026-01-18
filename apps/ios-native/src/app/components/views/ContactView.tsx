/**
 * ContactView component - Displays a matched contact's profile
 * Similar to ProfileView but read-only with Save/Message actions
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../App';
import type { UserProfile } from '@nektus/shared-types';
import { getApiBaseUrl, getIdToken } from '../../../client/auth/firebase';
import { ClientProfileService } from '../../../client/firebase/firebase-save';
import { useSession } from '../../providers/SessionProvider';
import { PageHeader } from '../ui/layout/PageHeader';
import { ContactInfo } from '../ui/modules/ContactInfo';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { StandardModal } from '../ui/modals/StandardModal';

type ContactViewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Contact'>;
type ContactViewRouteProp = RouteProp<RootStackParamList, 'Contact'>;

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

export function ContactView() {
  const navigation = useNavigation<ContactViewNavigationProp>();
  const route = useRoute<ContactViewRouteProp>();
  const { userId, token, isHistoricalMode } = route.params;
  const { data: session } = useSession();
  const apiBaseUrl = getApiBaseUrl();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Fetch the contact profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);

        if (isHistoricalMode) {
          // For historical contacts, fetch from Firestore
          if (!session?.user?.id) {
            throw new Error('Not authenticated');
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
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [userId, token, isHistoricalMode, apiBaseUrl, navigation, session?.user?.id]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle save contact
  const handleSaveContact = useCallback(async () => {
    if (isSaved) {
      // Already saved, just go back
      navigation.goBack();
      return;
    }

    try {
      setIsSaving(true);

      // TODO: Implement actual contact saving to device
      // For now, just simulate save and show success
      await new Promise(resolve => setTimeout(resolve, 500));

      setIsSaved(true);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('[ContactView] Save failed:', error);
      Alert.alert('Error', 'Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  }, [isSaved, navigation]);

  // Handle reject/dismiss
  const handleReject = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle say hi (open messaging)
  const handleSayHi = useCallback(() => {
    if (!profile) return;

    const phoneNumber = getFieldValue(profile.contactEntries, 'phone');
    const contactName = getFirstName(getFieldValue(profile.contactEntries, 'name'));
    const senderName = getFirstName(session?.user?.name || '');

    const message = `Hey ${contactName}! It's ${senderName} - nice meeting you!`;

    if (phoneNumber) {
      const smsUrl = `sms:${phoneNumber}&body=${encodeURIComponent(message)}`;
      Linking.openURL(smsUrl).catch(() => {
        Alert.alert('Error', 'Could not open messaging app');
      });
    } else {
      Alert.alert('No Phone Number', 'This contact doesn\'t have a phone number');
    }

    setShowSuccessModal(false);
  }, [profile, session]);

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
        <PageHeader title="Contact" onBack={handleBack} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Contact not found</Text>
        </View>
      </>
    );
  }

  const bioContent = getFieldValue(profile.contactEntries, 'bio') || 'Welcome to my profile!';
  const contactName = getFieldValue(profile.contactEntries, 'name');

  return (
    <>
      <View style={styles.container}>
        {/* Header with back button */}
        <PageHeader onBack={handleBack} />

        {/* Contact Info */}
        <View style={styles.content}>
          <ContactInfo profile={profile} bioContent={bioContent} />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
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
                onPress={() => navigation.navigate('SmartSchedule', { contactUserId: userId })}
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
        </View>
      </View>

      {/* Success Modal */}
      <StandardModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Contact Saved!"
        subtitle={`${contactName}'s contact has been saved successfully!`}
        primaryButtonText="Say hi"
        onPrimaryButtonClick={handleSayHi}
        secondaryButtonText="Nah, they'll text me"
        showCloseButton={false}
      />
    </>
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
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  actionsContainer: {
    paddingBottom: 32,
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
