/**
 * ContactProfileView - View a profile via shortCode (/c/:code)
 * Fetches profile by shortCode and displays using ContactView
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../../../App';
import type { UserProfile } from '@nektus/shared-types';
import { getApiBaseUrl, getIdToken } from '../../../client/auth/firebase';
import { ScreenTransition, useGoBackWithFade } from '../ui/layout/ScreenTransition';
import { ContactView } from './ContactView';
import { Button } from '../ui/buttons/Button';
import { textSizes, fontStyles } from '../ui/Typography';

type ContactProfileRouteProp = RouteProp<RootStackParamList, 'ContactProfile'>;

export function ContactProfileView() {
  const route = useRoute<ContactProfileRouteProp>();
  const goBackWithFade = useGoBackWithFade();
  const { code } = route.params;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const apiBaseUrl = getApiBaseUrl();

  // Fetch profile by shortCode
  useEffect(() => {
    async function fetchProfile() {
      if (!code) {
        setError('Invalid link');
        setIsLoading(false);
        return;
      }

      try {
        const idToken = await getIdToken();
        const response = await fetch(`${apiBaseUrl}/api/profile/shortcode/${code}`, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('Profile not found. The link may be invalid or expired.');
          } else {
            setError('Failed to load profile.');
          }
          return;
        }

        const data = await response.json();
        if (data.success && data.profile) {
          setProfile(data.profile);
        } else {
          setError('Profile not found.');
        }
      } catch (err) {
        console.error('[ContactProfileView] Failed to fetch profile:', err);
        setError('Failed to load profile.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [code, apiBaseUrl]);

  // Loading state
  if (isLoading) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </ScreenTransition>
    );
  }

  // Error state
  if (error) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            variant="primary"
            onPress={() => goBackWithFade()}
          >
            Go Back
          </Button>
        </View>
      </ScreenTransition>
    );
  }

  // Show ContactView with the fetched profile
  if (profile) {
    return <ContactView profile={profile} token={code} />;
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    ...textSizes.base,
    ...fontStyles.regular,
    marginTop: 16,
  },
  errorText: {
    color: '#ef4444',
    ...textSizes.base,
    ...fontStyles.regular,
    textAlign: 'center',
    marginBottom: 16,
  },
});
