/**
 * AddCalendarModal - Modal for selecting and connecting a calendar provider
 *
 * Primary: iPhone Calendar (EventKit) - reads all device-synced calendars with one permission prompt
 * Secondary: Google/Microsoft OAuth for accounts not synced to the device
 *
 * App Clip fallback: EventKit unavailable, shows Google/Microsoft/Apple CalDAV
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import * as ExpoLinking from 'expo-linking';
import { textSizes } from '../Typography';
import { StandardModal } from './StandardModal';
import { AppleCalendarSetupModal } from './AppleCalendarSetupModal';
import { Button } from '../buttons/Button';
import type { FieldSection, Calendar } from '@nektus/shared-types';
import { getApiBaseUrl, WORK_SCHEDULABLE_HOURS, PERSONAL_SCHEDULABLE_HOURS } from '@nektus/shared-client';
import { getIdToken } from '../../../../client/auth/firebase';
import { useProfile } from '../../../context/ProfileContext';
import { useSession } from '../../../providers/SessionProvider';
import {
  isEventKitAvailable,
  requestCalendarPermission,
} from '../../../../client/calendar/eventkit-service';
import {
  configureCalendarSync,
  syncDeviceBusyTimesNow,
  scheduleBackgroundCalendarSync,
  startCalendarChangeListener,
} from '../../../../client/calendar/calendar-sync';

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

// iPhone icon
const IPhoneIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Path
      fill="#000000"
      d="M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z"
    />
  </Svg>
);

const eventKitAvailable = isEventKitAvailable();
console.log('[AddCalendarModal] EventKit available:', eventKitAvailable);

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
  const { profile, saveProfile } = useProfile();
  const { data: session } = useSession();

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
   * Handle EventKit (iPhone Calendar) connection.
   * Requests permission, then saves a calendar entry client-side.
   */
  const handleEventKitConnect = async () => {
    if (isConnecting) return;

    try {
      setIsConnecting('eventkit');

      const granted = await requestCalendarPermission();
      if (!granted) {
        Alert.alert(
          'Calendar Access Required',
          'Please enable calendar access in Settings > Nekt to use iPhone Calendar.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      // Save calendar entry client-side (no server round-trip needed)
      const schedulableHours = section === 'work'
        ? WORK_SCHEDULABLE_HOURS
        : PERSONAL_SCHEDULABLE_HOURS;

      const newCalendar: Calendar = {
        id: `eventkit-${section}-${Date.now()}`,
        userId: session?.user?.id || '',
        provider: 'apple',
        accessMethod: 'eventkit',
        email: userEmail,
        section,
        schedulableHours,
        connectionStatus: 'connected',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedCalendars = [
        ...(profile?.calendars?.filter((cal) => cal.section !== section) || []),
        newCalendar,
      ];

      await saveProfile({ calendars: updatedCalendars });

      // Initial sync: upload device busy times to server for cross-user scheduling
      const idToken = await getIdToken();
      if (idToken && session?.user?.id) {
        configureCalendarSync(session.user.id, idToken, getApiBaseUrl());
        startCalendarChangeListener();
        scheduleBackgroundCalendarSync();
        syncDeviceBusyTimesNow().then((synced) => {
          if (synced !== null) console.log(`[CalendarSync] Initial sync: ${synced} busy times`);
        });
      }

      onCalendarAdded();
      onClose();
    } catch (error) {
      console.error('[AddCalendarModal] EventKit connection error:', error);
      Alert.alert('Error', 'Failed to connect iPhone Calendar. Please try again.');
    } finally {
      setIsConnecting(null);
    }
  };

  /**
   * Run the OAuth browser flow for Google/Microsoft and exchange the code.
   */
  const runOAuthFlow = async (provider: 'google' | 'microsoft'): Promise<boolean> => {
    const isGoogleNative = provider === 'google' && process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

    const oauthEndpoint = provider === 'google'
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

    let clientId: string;
    let redirectUri: string;
    let callbackUrl: string;

    if (isGoogleNative) {
      clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!;
      redirectUri = `com.googleusercontent.apps.${clientId.split('.')[0]}:/oauthredirect`;
      callbackUrl = redirectUri;
    } else {
      clientId = (provider === 'google'
        ? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
        : process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID) || '';
      if (!clientId) throw new Error(`${provider} client ID not configured`);
      redirectUri = `${apiBaseUrl}/api/calendar-connections/${provider}/callback`;
      callbackUrl = ExpoLinking.createURL('calendar-callback');
    }

    const scope = provider === 'google'
      ? 'https://www.googleapis.com/auth/calendar.readonly'
      : 'https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read openid profile email offline_access';

    const state = encodeURIComponent(JSON.stringify({
      userEmail,
      section,
      ...(isGoogleNative ? {} : { platform: 'ios', appCallbackUrl: callbackUrl }),
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
      } : {}),
    });

    const authUrl = `${oauthEndpoint}?${params.toString()}`;

    console.log('[AddCalendarModal] provider:', provider, 'isGoogleNative:', !!isGoogleNative);
    console.log('[AddCalendarModal] callbackUrl:', callbackUrl);
    console.log('[AddCalendarModal] redirectUri:', redirectUri);

    if (WebBrowser) {
      const callbackScheme = callbackUrl.split(':')[0];
      console.log('[AddCalendarModal] Opening auth session, scheme:', callbackScheme);

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        callbackUrl,
        { preferEphemeralSession: isGoogleNative }
      );

      console.log('[AddCalendarModal] Auth result:', JSON.stringify(result).substring(0, 500));

      if (result.type === 'success' && result.url) {
        const queryString = result.url.split('?')[1] || '';
        const urlParams = new URLSearchParams(queryString);
        const code = urlParams.get('code');

        if (!code) {
          throw new Error('No authorization code received');
        }

        console.log('[AddCalendarModal] Got code, exchanging via mobile-token...');

        await postToMobileExchange({
          provider,
          code,
          redirectUri,
          section,
          userEmail,
          ...(isGoogleNative ? { useIosClientId: 'true' } : {}),
        });

        return true;
      }
      console.log('[AddCalendarModal] Auth session cancelled or dismissed');
      return false;
    } else {
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

      const success = await runOAuthFlow(provider);

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
        isOpen={isOpen && !showAppleModal}
        onClose={onClose}
        title="Add Calendar"
        subtitle="Make finding time effortless! Nekt only reads free/busy info and stores no data."
        showPrimaryButton={false}
        showSecondaryButton={true}
        secondaryButtonText="Cancel"
        showCloseButton={false}
      >
        <View style={styles.buttonsContainer}>
          {/* iPhone Calendar (EventKit) - primary option when available */}
          {eventKitAvailable && (
            <>
              <Button
                variant="white"
                size="lg"
                onPress={handleEventKitConnect}
                disabled={isConnecting === 'eventkit'}
                loading={isConnecting === 'eventkit'}
                loadingText="Connecting..."
                icon={<IPhoneIcon />}
                style={styles.providerButton}
              >
                iPhone Calendar
              </Button>

              {/* "or" divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

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

          {/* Apple CalDAV - only show in App Clip where EventKit is not available */}
          {!eventKitAvailable && (
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
          )}
        </View>
      </StandardModal>

      {/* AppleCalendarSetupModal only needed for App Clip CalDAV fallback */}
      {!eventKitAvailable && (
        <AppleCalendarSetupModal
          isOpen={showAppleModal}
          onClose={() => setShowAppleModal(false)}
          onConnect={handleAppleConnect}
        />
      )}
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
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.4)',
    ...textSizes.sm,
    marginHorizontal: 12,
  },
});

export default AddCalendarModal;
