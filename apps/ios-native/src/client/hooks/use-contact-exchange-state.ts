/**
 * Custom hook to manage contact exchange state and modal flows for iOS
 * Handles state transitions and modal orchestration
 */

import { useState, useEffect } from 'react';
import type { UserProfile } from '@nektus/shared-types';
import { getExchangeState } from '../contacts/exchange/state';

interface UseContactExchangeStateResult {
  showSuccessModal: boolean;
  setShowSuccessModal: (show: boolean) => void;
  isSuccess: boolean;
  isLoading: boolean;
}

export function useContactExchangeState(
  token: string,
  profile: UserProfile,
  isHistoricalMode: boolean
): UseContactExchangeStateResult {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for exchange state on mount
  useEffect(() => {
    if (isHistoricalMode) {
      setIsLoading(false);
      return;
    }

    const checkExchangeState = async () => {
      try {
        const exchangeState = await getExchangeState(token);

        if (!exchangeState) {
          setIsLoading(false);
          return;
        }

        // Check if this matches the current profile
        if (exchangeState.profileId !== profile.userId) {
          setIsLoading(false);
          return;
        }

        // Set success based on exchange state
        const success = exchangeState.state === 'completed_success' ||
                       exchangeState.state === 'completed_firebase_only';
        setIsSuccess(success);

        if (success) {
          setShowSuccessModal(true);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('[iOS] Error checking exchange state:', error);
        setIsLoading(false);
      }
    };

    checkExchangeState();
  }, [profile, profile.userId, token, isHistoricalMode]);

  return {
    showSuccessModal,
    setShowSuccessModal,
    isSuccess,
    isLoading
  };
}
