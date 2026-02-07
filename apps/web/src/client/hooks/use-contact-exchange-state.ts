/**
 * Custom hook to manage contact exchange state and modal flows
 * Handles auth callbacks, state transitions, and modal orchestration
 */

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import type { UserProfile } from '@/types/profile';
import { saveContactFlow } from '@/client/contacts/save';
import { getExchangeState, setExchangeState, shouldShowUpsell, markGoogleContactsPermissionGranted } from '@/client/contacts/exchange/state';
import { isEmbeddedBrowser } from '@/client/platform-detection';

// SSR-safe: useLayoutEffect on client, useEffect on server (avoids SSR warning)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface UseContactExchangeStateResult {
  showSuccessModal: boolean;
  setShowSuccessModal: (show: boolean) => void;
  showUpsellModal: boolean;
  setShowUpsellModal: (show: boolean) => void;
  isSuccess: boolean;
}

export function useContactExchangeState(
  token: string,
  profile: UserProfile,
  isHistoricalMode: boolean
): UseContactExchangeStateResult {
  // Start false on both server and client to avoid hydration mismatch.
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);

  // Track whether we already handled the auth return to prevent race conditions
  // on hook re-runs (e.g., from profile reference changes or React re-renders)
  const authReturnHandledRef = useRef(false);

  // Check if contact is already saved by checking exchange state
  const exchangeState = getExchangeState(token);
  const isSuccess = exchangeState?.state === 'completed_success' || exchangeState?.state === 'completed_firebase_only';

  // Set modal state synchronously BEFORE the browser paints.
  // This runs after hydration but before any visual update, so the user
  // never sees the "closed" state and the modal animates in exactly once.
  useIsomorphicLayoutEffect(() => {
    if (isHistoricalMode) return;

    const state = getExchangeState(token);
    const authResult = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('incremental_auth')
      : null;

    if (authResult === 'success' && state) {
      authReturnHandledRef.current = true;
      setShowSuccessModal(true);
      // Update exchange state synchronously so any remount sees completed_success
      // (not auth_in_progress which would trigger the upsell)
      setExchangeState(token, {
        state: 'completed_success',
        platform: state.platform,
        profileId: state.profileId,
        timestamp: Date.now()
      });
      markGoogleContactsPermissionGranted();
      return;
    }

    if (state?.state === 'completed_success') {
      setShowSuccessModal(true);
      return;
    }

    if (state?.state === 'completed_firebase_only') {
      const iosNonEmbedded = state.platform === 'ios' && !isEmbeddedBrowser();
      if (shouldShowUpsell(token, state.platform, iosNonEmbedded)) {
        setShowUpsellModal(true);
      } else {
        setShowSuccessModal(true);
      }
    }
  // Only run once on mount — modal state is set before first paint
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle side effects: URL cleanup, state persistence, background Google save
  useEffect(() => {
    if (isHistoricalMode) return;

    const checkExchangeState = async () => {
      try {
        const exchangeState = getExchangeState(token);

        if (!exchangeState) {
          return;
        }

        // Check if this matches the current profile
        if (exchangeState.profileId !== profile.userId) {
          return;
        }

        // Check for auth return URL params first
        const urlParams = new URLSearchParams(window.location.search);
        const authResult = urlParams.get('incremental_auth');
        const contactSaveToken = urlParams.get('contact_save_token') || token;

        // Always clean auth URL params immediately — even if we already handled
        // the return on a previous render. This prevents re-triggering on
        // component remounts (e.g., session refresh).
        if (authResult) {
          const url = new URL(window.location.href);
          url.searchParams.delete('incremental_auth');
          url.searchParams.delete('contact_save_token');
          url.searchParams.delete('profile_id');
          window.history.replaceState({}, document.title, url.toString());
        }

        if (authResult === 'success') {
          // State + permission already updated by layout effect.
          // URL params already cleaned above. No ref guard needed —
          // cleaned URL params prevent duplicate runs on re-renders.

          // Fire off the Google save in the background (don't wait for it)
          fetch('/api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: contactSaveToken, googleOnly: true }),
            keepalive: true
          }).catch(() => {
            // Google save failed silently - contact is still saved to Firebase
          });

          return;
        }

        if (authResult === 'denied') {
          // Prevent re-processing on hook re-runs
          if (authReturnHandledRef.current) return;
          authReturnHandledRef.current = true;

          // For denied, we still need to call saveContactFlow to handle the denial logic
          const result = await saveContactFlow(profile, token);

          if (result.showUpsellModal) {
            setShowUpsellModal(true);
          }
          if (result.showSuccessModal) {
            setShowSuccessModal(true);
          }

          return;
        }

        // Handle different states (only if no auth params)
        if (exchangeState.state === 'completed_success') {
          setShowSuccessModal(true);
          return;
        }

        if (exchangeState.state === 'auth_in_progress') {
          // Only reach here if no URL params — user likely tapped back
          // Skip if we already handled the auth return on a previous render
          if (authReturnHandledRef.current) return;

          // Call saveContactFlow to handle potential auth return
          const result = await saveContactFlow(profile, token);

          if (result.showUpsellModal) {
            setShowUpsellModal(true);
          }
          if (result.showSuccessModal) {
            setShowSuccessModal(true);
          }

          return;
        }

        if (exchangeState.state === 'completed_firebase_only') {
          // Check if we should show upsell based on platform rules
          const iosNonEmbedded = exchangeState.platform === 'ios' && !isEmbeddedBrowser();
          if (shouldShowUpsell(token, exchangeState.platform, iosNonEmbedded)) {
            setShowUpsellModal(true);
          } else {
            setShowSuccessModal(true);
          }
          return;
        }

      } catch {
        // Error checking exchange state
      }
    };

    checkExchangeState();
  }, [profile, profile.userId, token, isHistoricalMode]);

  return {
    showSuccessModal,
    setShowSuccessModal,
    showUpsellModal,
    setShowUpsellModal,
    isSuccess
  };
}
