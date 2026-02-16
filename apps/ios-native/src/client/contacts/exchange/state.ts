/**
 * Unified exchange state management service for iOS
 * Uses AsyncStorage instead of localStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_TTL } from '@nektus/shared-client';

export type ExchangeState = 'pending' | 'auth_in_progress' | 'completed_success' | 'completed_firebase_only';

export interface ExchangeStateData {
  state: ExchangeState;
  timestamp: number;
  platform: string;
  profileId: string;
  token: string;
  upsellShown: boolean;
}

/**
 * Get exchange state for a token
 */
export async function getExchangeState(token: string): Promise<ExchangeStateData | null> {
  try {
    const stored = await AsyncStorage.getItem(`exchange-state-${token}`);
    if (!stored) return null;

    const data = JSON.parse(stored) as ExchangeStateData;

    // Check if state is expired
    const age = Date.now() - data.timestamp;

    // Auth in progress expires after 5 minutes
    if (data.state === 'auth_in_progress' && age > CACHE_TTL.SHORT_MS) {
      await clearExchangeState(token);
      return null;
    }

    // Completed states expire after 5 minutes
    if ((data.state === 'completed_success' || data.state === 'completed_firebase_only') && age > CACHE_TTL.SHORT_MS) {
      await clearExchangeState(token);
      return null;
    }

    return data;
  } catch (error) {
    console.warn('Failed to get exchange state:', error);
    await clearExchangeState(token);
    return null;
  }
}

/**
 * Set exchange state for a token
 */
export async function setExchangeState(token: string, data: Partial<ExchangeStateData>): Promise<void> {
  try {
    const existing = await getExchangeState(token);
    const newData: ExchangeStateData = {
      state: 'pending',
      timestamp: Date.now(),
      platform: 'ios', // Always iOS for this app
      profileId: '',
      token: token,
      upsellShown: false,
      ...existing,
      ...data
    };

    await AsyncStorage.setItem(`exchange-state-${token}`, JSON.stringify(newData));
    console.log('💾 [iOS] Set exchange state:', newData);
  } catch (error) {
    console.warn('Failed to set exchange state:', error);
  }
}

/**
 * Clear exchange state for a token
 */
export async function clearExchangeState(token: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`exchange-state-${token}`);
    console.log('🗑️ [iOS] Cleared exchange state for token:', token);
  } catch (error) {
    console.warn('Failed to clear exchange state:', error);
  }
}

/**
 * Mark upsell as shown for a token
 */
export async function markUpsellShown(token: string): Promise<void> {
  const existing = await getExchangeState(token);
  if (existing) {
    await setExchangeState(token, { ...existing, upsellShown: true });
  }
}

/**
 * Check if success modal should be shown
 */
export async function shouldShowSuccess(token: string): Promise<boolean> {
  const state = await getExchangeState(token);
  return state?.state === 'completed_success';
}
