/**
 * Unified exchange state management service for iOS
 * Uses AsyncStorage instead of localStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

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
    const stored = await AsyncStorage.getItem(`exchange_state_${token}`);
    if (!stored) return null;

    const data = JSON.parse(stored) as ExchangeStateData;

    // Check if state is expired
    const age = Date.now() - data.timestamp;

    // Auth in progress expires after 5 minutes
    if (data.state === 'auth_in_progress' && age > 5 * 60 * 1000) {
      await clearExchangeState(token);
      return null;
    }

    // Completed states expire after 15 minutes (except iOS which persists forever)
    if ((data.state === 'completed_success' || data.state === 'completed_firebase_only')) {
      if (data.platform !== 'ios' && age > 15 * 60 * 1000) {
        await clearExchangeState(token);
        return null;
      }
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

    await AsyncStorage.setItem(`exchange_state_${token}`, JSON.stringify(newData));
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
    await AsyncStorage.removeItem(`exchange_state_${token}`);
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
 * Check if user has dismissed Google contacts upsell globally
 */
async function hasUserDismissedUpsellGlobally(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem('google_contacts_upsell_dismissed')) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark that user has dismissed Google contacts upsell globally
 */
export async function markUpsellDismissedGlobally(): Promise<void> {
  try {
    await AsyncStorage.setItem('google_contacts_upsell_dismissed', 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if user has completed their first contact save
 */
export async function hasCompletedFirstSave(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem('google_contacts_first_save_completed')) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark that user has completed their first contact save
 */
export async function markFirstSaveCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem('google_contacts_first_save_completed', 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if this is a first-time save
 */
export async function isFirstTimeSave(token: string): Promise<boolean> {
  return (await getExchangeState(token)) === null;
}

/**
 * Check if user has ever successfully authorized Google Contacts
 */
export async function hasGoogleContactsPermission(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem('google_contacts_permission_granted')) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark that user has successfully authorized Google Contacts
 */
export async function markGoogleContactsPermissionGranted(): Promise<void> {
  try {
    await AsyncStorage.setItem('google_contacts_permission_granted', 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if upsell should be shown
 */
export async function shouldShowUpsell(token: string): Promise<boolean> {
  const state = await getExchangeState(token);

  // For first-time saves, check if user has permission globally
  if (!state) {
    return !(await hasGoogleContactsPermission());
  }

  // Only show upsell if contact was saved to Firebase but not Google
  if (state.state !== 'completed_firebase_only') return false;

  // iOS: show only if never dismissed globally
  return !(await hasUserDismissedUpsellGlobally());
}

/**
 * Check if success modal should be shown
 */
export async function shouldShowSuccess(token: string): Promise<boolean> {
  const state = await getExchangeState(token);
  return state?.state === 'completed_success';
}
