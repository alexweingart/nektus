/**
 * Custom hook to manage contact exchange state and modal flows
 * Handles auth callbacks, state transitions, and modal orchestration
 */

import { useState, useEffect } from 'react';
import type { UserProfile } from '@/types/profile';
import { saveContactFlow } from '@/client/contacts/save';
import { getExchangeState, shouldShowUpsell } from '@/client/contacts/exchange/state';
import { isEmbeddedBrowser } from '@/client/platform-detection';

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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);

  // Check if contact is already saved by checking exchange state
  const exchangeState = getExchangeState(token);
  const isSuccess = exchangeState?.state === 'completed_success' || exchangeState?.state === 'completed_firebase_only';

  // Check for exchange state on mount
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

        // Check for auth success URL params first
        const urlParams = new URLSearchParams(window.location.search);
        const authResult = urlParams.get('incremental_auth');

        if (authResult === 'success') {
          // Show success modal immediately - we know auth succeeded!
          setShowSuccessModal(true);

          // DON'T clean URL params here - let saveContactFlow handle it
          // so it can detect isReturningFromAuth correctly

          // Make Google API call in background (don't wait for it)
          // saveContactFlow will detect auth return via URL params and handle the Google save
          saveContactFlow(profile, token).catch(() => {
            // Could optionally show a toast notification if the background save fails
          });

          return;
        }

        if (authResult === 'denied') {
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
