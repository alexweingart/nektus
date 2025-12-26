/**
 * Custom hook to proactively pre-fetch common time slots for contact scheduling
 * Caches scheduling data for faster UX when user navigates to smart-schedule
 */

import { useEffect, useRef } from 'react';
import type { SavedContact } from '@/types/contactExchange';
import type { UserProfile, Calendar } from '@/types/profile';
import { auth } from '@/lib/config/firebase/client';

interface UseSchedulingPreFetchParams {
  isHistoricalMode: boolean;
  sessionUserId?: string;
  profile?: SavedContact | UserProfile;
  userCalendars?: Calendar[];
}

export function useSchedulingPreFetch({
  isHistoricalMode,
  sessionUserId,
  profile,
  userCalendars
}: UseSchedulingPreFetchParams): void {
  const hasFetchedSlotsRef = useRef(false);

  useEffect(() => {
    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;

    const preFetchCommonTimeSlots = async () => {
      if (!isHistoricalMode || !sessionUserId || !profile?.userId || !auth?.currentUser) return;
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
        console.log('🔄 Proactively pre-fetching common time slots for contact page...');
        const idToken = await auth.currentUser.getIdToken();

        const response = await fetch('/api/scheduling/common-times', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            user1Id: sessionUserId,
            user2Id: profile.userId,
            duration: 30,
            calendarType: contactType,
          }),
          signal: abortController.signal, // Allow request to be cancelled
        });

        if (response.ok) {
          const data = await response.json();
          const slots = data.slots || [];
          console.log(`✅ Proactively pre-fetched ${slots.length} common time slots (cached for scheduling)`);
        }
      } catch (error) {
        // Ignore abort errors (expected on unmount)
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Pre-fetch cancelled (component unmounted)');
        } else {
          console.log('Pre-fetch failed (non-critical):', error);
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
