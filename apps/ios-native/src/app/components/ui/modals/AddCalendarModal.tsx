/**
 * AddCalendarModal - Modal for selecting and connecting a calendar provider
 * Supports Google, Microsoft, and Apple calendars
 *
 * Google/Microsoft: Opens OAuth in browser, extracts auth code from redirect,
 * then exchanges code server-side via /api/calendar-connections/mobile-token
 * (authenticated with Firebase Bearer token).
 *
 * Apple: Opens AppleCalendarSetupModal for CalDAV credentials, then POSTs
 * to the same mobile-token endpoint.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import * as ExpoLinking from 'expo-linking';
import { StandardModal } from './StandardModal';
import { AppleCalendarSetupModal } from './AppleCalendarSetupModal';
import { Button } from '../buttons/Button';
import type { FieldSection } from '@nektus/shared-types';
import { getApiBaseUrl } from '@nektus/shared-client';
import { getIdToken } from '../../../../client/auth/firebase';

// Try to load expo-web-browser, fall back gracefully in App Clip where native module is excluded
let WebBrowser: typeof import('expo-web-browser') | null = null;
try {
  WebBrowser = require('expo-web-browser');
  WebBrowser?.maybeCompleteAuthSession();
} catch {
  // expo-web-browser native module not available (App Clip) — will fall back to Linking
}

interface AddCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: FieldSection;
  userEmail: string;
  onCalendarAdded: () => void;
}

// Google icon
const GoogleIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </Svg>
);

// Microsoft icon
const MicrosoftIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Rect fill="#F25022" x="1" y="1" width="10" height="10" />
    <Rect fill="#7FBA00" x="13" y="1" width="10" height="10" />
    <Rect fill="#00A4EF" x="1" y="13" width="10" height="10" />
    <Rect fill="#FFB900" x="13" y="13" width="10" height="10" />
  </Svg>
);

// Apple icon
const AppleIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Path
      fill="#000000"
      d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"
    />
  </Svg>
);

export function AddCalendarModal({
  isOpen,
  onClose,
  section,
  userEmail,
  onCalendarAdded,
}: AddCalendarModalProps) {
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [showAppleModal, setShowAppleModal] = useState(false);
  const apiBaseUrl = getApiBaseUrl();

  /**
   * Exchange an OAuth auth code or Apple credentials with the server
   * via Firebase Bearer token authentication.
   */
  const postToMobileExchange = async (payload: Record<string, string>) => {
    const idToken = await getIdToken();
    if (!idToken) {
      throw new Error('Not authenticated. Please sign in again.');
    }

    const response = await fetch(`${apiBaseUrl}/api/calendar-connections/mobile-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      // Throw with the error code so callers can check for specific errors
      const err = new Error(data.message || data.error || 'Failed to connect calendar');
      (err as Error & { code?: string }).code = data.error;
      throw err;
    }
    return data;
  };

  const handleAppleConnect = async (appleId: string, appPassword: string) => {
    try {
      await postToMobileExchange({
        provider: 'apple',
        section,
        userEmail,
        appleId,
        appSpecificPassword: appPassword,
      });
      onCalendarAdded();
      onClose();
    } catch (error) {
      throw error; // Re-throw so AppleCalendarSetupModal can show the error
    }
  };

  /**
   * Run the OAuth browser flow for Google/Microsoft and exchange the code.
   * If Google doesn't return a refresh token, automatically retries with prompt=consent.
   */
  const runOAuthFlow = async (provider: 'google' | 'microsoft', forceConsent = false): Promise<boolean> => {
    const oauthEndpoint = provider === 'google'
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

    const clientId = provider === 'google'
      ? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      : process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID;

    if (!clientId) {
      throw new Error(`${provider} client ID not configured`);
    }

    const redirectUri = `${apiBaseUrl}/api/calendar-connections/${provider}/callback`;

    const scope = provider === 'google'
      ? 'https://www.googleapis.com/auth/calendar.readonly'
      : 'https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read openid profile email offline_access';

    // Build app callback URL using Expo's linking (handles exp+nekt:// in dev, nekt:// in prod)
    const appCallbackUrl = ExpoLinking.createURL('calendar-callback');

    const state = encodeURIComponent(JSON.stringify({
      userEmail,
      section,
      platform: 'ios',
      appCallbackUrl,
    }));

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
      login_hint: userEmail,
      ...(provider === 'google' ? {
        access_type: 'offline',
        include_granted_scopes: 'true',
        // Omit prompt so Google only shows what's needed:
        // skips picker if login_hint matches, shows consent only for new scopes
        ...(forceConsent ? { prompt: 'consent' } : {}),
      } : {
        // Microsoft: omit prompt to skip picker when login_hint matches
      }),
    });

    const authUrl = `${oauthEndpoint}?${params.toString()}`;

    if (WebBrowser) {
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        appCallbackUrl,
        { showInRecents: true }
      );

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');

        if (!code) {
          throw new Error('No authorization code received');
        }

        await postToMobileExchange({
          provider,
          code,
          redirectUri,
          section,
          userEmail,
        });

        return true; // success
      }
      // User cancelled
      return false;
    } else {
      // App Clip: fall back to opening in external browser
      await Linking.openURL(authUrl);
      return false;
    }
  };

  const handleAddCalendar = async (provider: 'google' | 'microsoft' | 'apple') => {
    if (isConnecting) return;

    if (provider === 'apple') {
      setShowAppleModal(true);
      return;
    }

    try {
      setIsConnecting(provider);

      let success: boolean;
      try {
        success = await runOAuthFlow(provider);
      } catch (error) {
        // Google: if no refresh token, retry with consent prompt
        if (provider === 'google' && (error as Error & { code?: string }).code === 'no_refresh_token') {
          console.log('[AddCalendarModal] No refresh token, retrying with consent');
          success = await runOAuthFlow(provider, true);
        } else {
          throw error;
        }
      }

      if (success) {
        onCalendarAdded();
        onClose();
      }
    } catch (error) {
      console.error(`[AddCalendarModal] Error connecting ${provider} calendar:`, error);
      Alert.alert('Error', error instanceof Error ? error.message : `Failed to connect ${provider}. Please try again.`);
    } finally {
      setIsConnecting(null);
    }
  };

  return (
    <>
      <StandardModal
        isOpen={isOpen}
        onClose={onClose}
        title="Add Calendar"
        subtitle="Make finding time effortless! Nekt only reads free/busy info and stores no data."
        showPrimaryButton={false}
        showSecondaryButton={true}
        secondaryButtonText="Cancel"
        showCloseButton={false}
      >
        <View style={styles.buttonsContainer}>
          {/* Google Calendar */}
          <Button
            variant="white"
            size="lg"
            onPress={() => handleAddCalendar('google')}
            disabled={isConnecting === 'google'}
            loading={isConnecting === 'google'}
            loadingText="Connecting..."
            icon={<GoogleIcon />}
            style={styles.providerButton}
          >
            Google Calendar
          </Button>

          {/* Microsoft Calendar */}
          <Button
            variant="white"
            size="lg"
            onPress={() => handleAddCalendar('microsoft')}
            disabled={isConnecting === 'microsoft'}
            loading={isConnecting === 'microsoft'}
            loadingText="Connecting..."
            icon={<MicrosoftIcon />}
            style={styles.providerButton}
          >
            Microsoft Calendar
          </Button>

          {/* Apple Calendar */}
          <Button
            variant="white"
            size="lg"
            onPress={() => handleAddCalendar('apple')}
            disabled={isConnecting === 'apple'}
            loading={isConnecting === 'apple'}
            loadingText="Connecting..."
            icon={<AppleIcon />}
            style={styles.providerButton}
          >
            Apple Calendar
          </Button>
        </View>
      </StandardModal>

      <AppleCalendarSetupModal
        isOpen={showAppleModal}
        onClose={() => setShowAppleModal(false)}
        onConnect={handleAppleConnect}
      />
    </>
  );
}

const styles = StyleSheet.create({
  buttonsContainer: {
    gap: 12,
  },
  providerButton: {
    width: '100%',
  },
});

export default AddCalendarModal;
