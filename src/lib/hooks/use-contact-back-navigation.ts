/**
 * Custom hook to handle back navigation from ContactView with animations
 * Manages exit animations, sessionStorage coordination, and iOS-safe navigation timing
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
    const backClickTime = performance.now();
    console.log('🎯 ContactView: Back button clicked at', backClickTime.toFixed(2), 'ms, starting exit animation');
    sessionStorage.setItem('nav-back-clicked-at', backClickTime.toString());
    setIsExiting(true);

    // Mark that we're returning (for coordinating entrance animation)
    if (isHistoricalMode) {
      console.log('🎯 ContactView: Marking return to history');
      sessionStorage.setItem('returning-to-history', 'true');

      // Store contact background for crossfade
      if (profile.backgroundImage) {
        sessionStorage.setItem('contact-background-url', profile.backgroundImage);
      }
    } else {
      console.log('🎯 ContactView: Marking return to profile');
      sessionStorage.setItem('returning-to-profile', 'true');

      // Store contact background for crossfade
      if (profile.backgroundImage) {
        sessionStorage.setItem('contact-background-url', profile.backgroundImage);
      }
    }

    // Navigate immediately - iOS Safari throttles setTimeout during touch interactions
    // Using requestAnimationFrame + Promise for more reliable iOS execution
    const performNavigation = () => {
      const navStartTime = performance.now();
      console.log('🎯 ContactView: Calling onReject (router.push) at', navStartTime.toFixed(2), 'ms');
      sessionStorage.setItem('nav-router-push-at', navStartTime.toString());
      onReject();
    };

    // Use requestAnimationFrame to ensure we're in sync with the next frame,
    // then navigate immediately. This is more reliable on iOS than setTimeout alone.
    requestAnimationFrame(() => {
      // Use a microtask to ensure React state updates are flushed
      Promise.resolve().then(performNavigation);
    });
  };

  return {
    isExiting,
    handleBack
  };
}
