/**
 * Scheduling Pre-fetch Hook for iOS
 * Adapted from: apps/web/src/client/hooks/use-scheduling-pre-fetch.ts
 *
 * Changes from web:
 * - Uses getApiBaseUrl() and getIdToken() from iOS auth
 * - Minor fetch adaptation
 */

import { useEffect, useRef } from 'react';
import type { SavedContact, UserProfile, Calendar } from '@nektus/shared-types';
import { getApiBaseUrl, getIdToken } from '../auth/firebase';
import { isEventKitAvailable, getDeviceBusyTimes } from '../calendar/eventkit-service';

// Cold start flag — true on first request after app launch, resets after use
let isColdStart = true;

interface UseSchedulingPreFetchParams {
  isHistoricalMode: boolean;
  sessionUserId?: string;
  profile?: SavedContact | UserProfile;
  userCalendars?: Calendar[];
}

async function getEventKitBusyTimesIfNeeded(
  calendars: Calendar[] | undefined
): Promise<{ user1BusyTimes: { start: string; end: string }[] } | {}> {
  if (!isEventKitAvailable()) return {};
  const calendar = calendars?.find(
    (cal) => cal.accessMethod === 'eventkit'
  );
  if (!calendar) return {};
  try {
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    return { user1BusyTimes: await getDeviceBusyTimes(now, twoWeeksOut) };
  } catch {
    return {};
  }
}

/**
 * Pre-fetches common time slots for contact scheduling
 * Caches scheduling data for faster UX when user navigates to smart-schedule
 */
export function useSchedulingPreFetch({
  isHistoricalMode,
  sessionUserId,
  profile,
  userCalendars,
}: UseSchedulingPreFetchParams): void {
  const hasFetchedSlotsRef = useRef(false);

  useEffect(() => {
    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const preFetchCommonTimeSlots = async () => {
      if (!isHistoricalMode || !sessionUserId || !profile?.userId) return;
      if (hasFetchedSlotsRef.current) return; // Already fetched

      const savedContact = profile as SavedContact;
      const contactType = savedContact.contactType;

      // Only pre-fetch if user has calendar for this contact type
      const userHasCalendar = userCalendars?.some(
        (cal) => cal.section === contactType
      );

      if (!userHasCalendar) return;

      hasFetchedSlotsRef.current = true;

      try {
        console.log('[scheduling-pre-fetch] Pre-fetching common time slots...');
        const idToken = await getIdToken();
        const apiBaseUrl = getApiBaseUrl();

        if (!idToken) {
          console.log('[scheduling-pre-fetch] No auth token, skipping pre-fetch');
          return;
        }

        const response = await fetch(`${apiBaseUrl}/api/scheduling/common-times`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            user1Id: sessionUserId,
            user2Id: profile.userId,
            duration: 30,
            calendarType: contactType,
            ...(await getEventKitBusyTimesIfNeeded(userCalendars)),
            ...(isColdStart ? { skipCache: true } : {}),
          }),
          signal: abortController.signal, // Allow request to be cancelled
        });

        isColdStart = false; // Reset after first API call

        if (response.ok) {
          const data = await response.json();
          const slots = data.slots || [];
          console.log(
            `[scheduling-pre-fetch] Pre-fetched ${slots.length} common time slots`
          );
        }
      } catch (error) {
        // Ignore abort errors (expected on unmount)
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[scheduling-pre-fetch] Pre-fetch cancelled (unmounted)');
        } else {
          console.log('[scheduling-pre-fetch] Pre-fetch failed (non-critical):', error);
        }
      }
    };

    // Defer pre-fetch to avoid blocking initial render
    timeoutId = setTimeout(() => {
      preFetchCommonTimeSlots();
    }, 100); // 100ms delay ensures page is interactive first

    // Cleanup: abort ongoing requests and clear timeout
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      abortController.abort();
    };
    // Only depend on userId, not entire profile object to avoid unnecessary re-fetches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHistoricalMode, sessionUserId, profile?.userId, userCalendars]);
}

export default useSchedulingPreFetch;
