/**
 * Custom hook to handle back navigation from ContactView with animations
 * Manages exit animations and iOS-safe navigation timing
 */

import { useState } from 'react';
import type { UserProfile } from '@/types/profile';

interface UseContactBackNavigationResult {
  isExiting: boolean;
  handleBack: () => void;
}

export function useContactBackNavigation(
  isHistoricalMode: boolean,
  profile: UserProfile,
  onReject: () => void
): UseContactBackNavigationResult {
  const [isExiting, setIsExiting] = useState(false);

  const handleBack = () => {
    setIsExiting(true);

    // Mark that we're returning (for coordinating entrance animation)
    if (!isHistoricalMode) {
      sessionStorage.setItem('returning-to-profile', 'true');
    }

    // Navigate immediately - iOS Safari throttles setTimeout during touch interactions
    // Using requestAnimationFrame + Promise for more reliable iOS execution
    requestAnimationFrame(() => {
      // Use a microtask to ensure React state updates are flushed
      Promise.resolve().then(onReject);
    });
  };

  return {
    isExiting,
    handleBack
  };
}
