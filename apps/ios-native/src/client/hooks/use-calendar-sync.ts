/**
 * Hook to manage EventKit busy time sync with the server.
 *
 * Handles three sync triggers:
 * 1. Initial setup: configures native module + syncs on mount when EventKit calendar exists
 * 2. App foreground: re-syncs when app returns from background
 * 3. Calendar changes: native module auto-syncs via EKEventStoreChanged listener
 *
 * Also schedules BGAppRefreshTask for periodic background sync.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSession } from '../../app/providers/SessionProvider';
import { useProfile } from '../../app/context/ProfileContext';
import { getIdToken } from '../auth/firebase';
import { getApiBaseUrl } from '../config';
import {
  configureCalendarSync,
  syncDeviceBusyTimesNow,
  startCalendarChangeListener,
  stopCalendarChangeListener,
  scheduleBackgroundCalendarSync,
} from '../calendar/calendar-sync';

export function useCalendarSync() {
  const { data: session, status } = useSession();
  const { profile } = useProfile();
  const configuredRef = useRef(false);

  // Check if user has an EventKit calendar connected
  const hasEventKitCalendar = profile?.calendars?.some(
    (cal) => cal.accessMethod === 'eventkit'
  );

  // Configure native module + initial sync when authenticated with EventKit calendar
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || !hasEventKitCalendar) {
      return;
    }

    let cancelled = false;

    const setup = async () => {
      const idToken = await getIdToken();
      if (!idToken || cancelled) return;

      const apiBaseUrl = getApiBaseUrl();

      // Configure native module with credentials
      configureCalendarSync(session.user.id, idToken, apiBaseUrl);
      configuredRef.current = true;

      // Start listening for calendar changes (auto-syncs via native module)
      startCalendarChangeListener();

      // Schedule periodic background sync
      scheduleBackgroundCalendarSync();

      // Initial sync
      const synced = await syncDeviceBusyTimesNow();
      if (synced !== null) {
        console.log(`[CalendarSync] Initial sync: ${synced} busy times uploaded`);
      }
    };

    setup();

    return () => {
      cancelled = true;
      stopCalendarChangeListener();
    };
  }, [status, session?.user?.id, hasEventKitCalendar]);

  // Re-sync + refresh credentials on app foreground
  useEffect(() => {
    if (!configuredRef.current || !session?.user?.id) return;

    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active' && configuredRef.current) {
        // Refresh the stored ID token (it may have expired while backgrounded)
        const idToken = await getIdToken();
        if (idToken) {
          configureCalendarSync(session.user.id, idToken, getApiBaseUrl());
          syncDeviceBusyTimesNow();
        }
      }
    });

    return () => sub.remove();
  }, [session?.user?.id]);
}
