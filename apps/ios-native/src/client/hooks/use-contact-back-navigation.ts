/**
 * useContactBackNavigation hook for iOS
 * Adapted from: apps/web/src/client/hooks/use-contact-back-navigation.ts
 *
 * Changes from web:
 * - Replaced sessionStorage with AsyncStorage
 * - Replaced router navigation with React Navigation
 * - Simplified animation timing (no iOS Safari workarounds needed)
 */

import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@nektus/shared-types';

interface UseContactBackNavigationResult {
  isExiting: boolean;
  handleBack: () => void;
}

export function useContactBackNavigation(
  isHistoricalMode: boolean,
  profile: UserProfile | null,
  onBack: () => void
): UseContactBackNavigationResult {
  const [isExiting, setIsExiting] = useState(false);

  const handleBack = useCallback(async () => {
    console.log('🎯 ContactView: Back button clicked, starting exit animation');
    setIsExiting(true);

    // Mark that we're returning (for coordinating entrance animation)
    try {
      if (isHistoricalMode) {
        console.log('🎯 ContactView: Marking return to history');
        await AsyncStorage.setItem('returning-to-history', 'true');

        // Store contact background for crossfade
        if (profile?.backgroundImage) {
          await AsyncStorage.setItem('contact-background-url', profile.backgroundImage);
        }
      } else {
        console.log('🎯 ContactView: Marking return to profile');
        await AsyncStorage.setItem('returning-to-profile', 'true');

        // Store contact background for crossfade
        if (profile?.backgroundImage) {
          await AsyncStorage.setItem('contact-background-url', profile.backgroundImage);
        }
      }
    } catch (error) {
      console.error('Failed to save navigation state:', error);
    }

    // Navigate back
    onBack();
  }, [isHistoricalMode, profile, onBack]);

  return {
    isExiting,
    handleBack,
  };
}

export default useContactBackNavigation;
