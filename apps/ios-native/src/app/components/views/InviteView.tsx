/**
 * InviteView - Shows event invitation details and allows attendee to accept/link calendar
 * Deep linked from /i/{code}
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../../../App';
import { useSession } from '../../providers/SessionProvider';
import { useProfile } from '../../context/ProfileContext';
import { getApiBaseUrl, getIdToken } from '../../../client/auth/firebase';
import { Button } from '../ui/buttons/Button';
import { PageHeader } from '../ui/layout/PageHeader';
import { ScreenTransition, useGoBackWithFade } from '../ui/layout/ScreenTransition';
import { textSizes, fontStyles } from '../ui/Typography';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

type InviteViewRouteProp = RouteProp<RootStackParamList, 'Invite'>;

// Initialize Firebase JS SDK for Firestore reads (same config as web)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

interface InviteData {
  calendarEventId: string;
  calendarProvider: string;
  organizerId: string;
  attendeeId: string;
  eventDetails: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    location: string;
    locationAddress: string;
    timeZone: string;
  };
  addedToRecipient: boolean;
}

export function InviteView() {
  const route = useRoute<InviteViewRouteProp>();
  const goBackWithFade = useGoBackWithFade();
  const { code } = route.params;
  const { data: session, status } = useSession();
  const { profile } = useProfile();
  const apiBaseUrl = getApiBaseUrl();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingEmail, setAddingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [patching, setPatching] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      try {
        const inviteDoc = await getDoc(doc(db, 'invites', code));
        if (!inviteDoc.exists()) {
          setError('Invite not found');
          setLoading(false);
          return;
        }
        setInvite(inviteDoc.data() as InviteData);
      } catch (err) {
        console.error('[InviteView] Failed to load invite:', err);
        setError('Failed to load invite');
      } finally {
        setLoading(false);
      }
    }

    if (code) loadInvite();
  }, [code]);

  const patchEventWithEmail = async (email: string) => {
    setPatching(true);
    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const response = await fetch(`${apiBaseUrl}/api/scheduling/invite-accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          inviteCode: code,
          attendeeEmail: email,
        }),
      });

      if (!response.ok) throw new Error('Failed to add you to the event');

      Alert.alert('Success', 'You have been added to the event!');

      // Refresh invite
      const inviteDoc = await getDoc(doc(db, 'invites', code));
      if (inviteDoc.exists()) setInvite(inviteDoc.data() as InviteData);
    } catch (err) {
      console.error('[InviteView] Patch failed:', err);
      Alert.alert('Error', 'Failed to add you to the event. Please try again.');
    } finally {
      setPatching(false);
    }
  };

  const isSignedIn = status === 'authenticated' && session?.user;

  if (loading) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <PageHeader title="Invite" onBack={goBackWithFade} />
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#71E454" />
          </View>
        </View>
      </ScreenTransition>
    );
  }

  if (error || !invite) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <PageHeader title="Invite" onBack={goBackWithFade} />
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error || 'Invite not found'}</Text>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  const { eventDetails, addedToRecipient } = invite;
  const startDate = new Date(eventDetails.startTime);
  const endDate = new Date(eventDetails.endTime);

  const dateStr = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: eventDetails.timeZone,
  });
  const startTimeStr = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: eventDetails.timeZone,
  });
  const endTimeStr = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: eventDetails.timeZone,
  });

  // Not signed in: minimal info
  if (!isSignedIn) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <PageHeader title="Invite" onBack={goBackWithFade} />
          <View style={styles.centered}>
            <Text style={styles.heading}>{eventDetails.title}</Text>
            <Text style={styles.subtitleText}>
              Sign in to see the full details and accept this invite.
            </Text>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition>
      <View style={styles.container}>
        <PageHeader title="Invite" onBack={goBackWithFade} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Event Card */}
          <View style={styles.card}>
            <Text style={styles.heading}>{eventDetails.title}</Text>
            <Text style={styles.detailText}>{dateStr}</Text>
            <Text style={styles.detailText}>{startTimeStr} - {endTimeStr}</Text>
            {eventDetails.location ? (
              <Text
                style={[styles.detailText, styles.linkText]}
                onPress={() => {
                  const query = encodeURIComponent(eventDetails.location);
                  Linking.openURL(`https://maps.apple.com/?q=${query}`);
                }}
              >
                {eventDetails.location}
              </Text>
            ) : null}
          </View>

          {/* Actions */}
          {addedToRecipient ? (
            <View style={styles.actions}>
              <Text style={styles.infoText}>
                A calendar invite has been sent to your email.
              </Text>
            </View>
          ) : (
            <View style={styles.actions}>
              {!addingEmail ? (
                <>
                  <Button
                    variant="white"
                    size="lg"
                    onPress={() => setAddingEmail(true)}
                    style={styles.fullWidth}
                  >
                    <Text style={styles.buttonText}>Add Email to Accept</Text>
                  </Button>
                </>
              ) : (
                <View style={styles.emailForm}>
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor="#666"
                    value={emailInput}
                    onChangeText={setEmailInput}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Button
                    variant="white"
                    size="md"
                    onPress={() => patchEventWithEmail(emailInput)}
                    disabled={!emailInput || patching}
                    style={styles.fullWidth}
                  >
                    <Text style={styles.buttonText}>
                      {patching ? 'Adding...' : 'Add to Event'}
                    </Text>
                  </Button>
                </View>
              )}
            </View>
          )}

          {/* Branding */}
          <Text style={styles.branding}>
            Scheduled via Nekt
          </Text>
        </ScrollView>
      </View>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrollContent: {
    padding: 24,
    gap: 24,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    gap: 8,
  },
  heading: {
    ...textSizes.xl,
    ...fontStyles.bold,
    color: '#ffffff',
    marginBottom: 8,
  },
  detailText: {
    ...textSizes.base,
    ...fontStyles.regular,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  linkText: {
    color: '#71E454',
    textDecorationLine: 'underline',
  },
  subtitleText: {
    ...textSizes.base,
    ...fontStyles.regular,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 12,
  },
  errorText: {
    ...textSizes.base,
    ...fontStyles.regular,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  actions: {
    gap: 12,
  },
  infoText: {
    ...textSizes.sm,
    ...fontStyles.regular,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  buttonText: {
    ...textSizes.base,
    ...fontStyles.regular,
    color: '#374151',
  },
  emailForm: {
    gap: 12,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
    ...textSizes.base,
    ...fontStyles.regular,
  },
  branding: {
    ...textSizes.xs,
    ...fontStyles.regular,
    color: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
    marginTop: 24,
  },
});
