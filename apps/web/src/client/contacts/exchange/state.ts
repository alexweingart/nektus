/**
 * Unified exchange state management service
 * Replaces multiple localStorage keys with single exchange state per token
 */

export type ExchangeState = 'pending' | 'auth_in_progress' | 'completed_success' | 'completed_firebase_only';

export interface ExchangeStateData {
  state: ExchangeState;
  timestamp: number;
  platform: string;
  profileId: string;
  token: string;
  upsellShown: boolean;
  successModalDismissed?: boolean;
}

/**
 * Get exchange state for a token
 */
export function getExchangeState(token: string): ExchangeStateData | null {
  try {
    const stored = localStorage.getItem(`exchange_state_${token}`);
    if (!stored) return null;
    
    const data = JSON.parse(stored) as ExchangeStateData;
    
    // Check if state is expired (varies by state and platform)
    const age = Date.now() - data.timestamp;
    
    // Auth in progress expires after 5 minutes
    if (data.state === 'auth_in_progress' && age > 5 * 60 * 1000) {
      clearExchangeState(token);
      return null;
    }
    
    // Completed states expire after 15 minutes
    if ((data.state === 'completed_success' || data.state === 'completed_firebase_only') && age > 15 * 60 * 1000) {
      clearExchangeState(token);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Failed to get exchange state:', error);
    clearExchangeState(token);
    return null;
  }
}

/**
 * Set exchange state for a token
 */
export function setExchangeState(token: string, data: Partial<ExchangeStateData>): void {
  try {
    const existing = getExchangeState(token);
    const newData: ExchangeStateData = {
      state: 'pending',
      timestamp: Date.now(),
      platform: 'web',
      profileId: '',
      token: token,
      upsellShown: false,
      ...existing,
      ...data
    };
    
    localStorage.setItem(`exchange_state_${token}`, JSON.stringify(newData));
    console.log('💾 Set exchange state:', newData);
  } catch (error) {
    console.warn('Failed to set exchange state:', error);
  }
}

/**
 * Clear exchange state for a token
 */
export function clearExchangeState(token: string): void {
  try {
    localStorage.removeItem(`exchange_state_${token}`);
    console.log('🗑️ Cleared exchange state for token:', token);
  } catch (error) {
    console.warn('Failed to clear exchange state:', error);
  }
}

/**
 * Mark success modal as dismissed for a token (prevents re-showing on remount)
 */
export function markSuccessModalDismissed(token: string): void {
  const existing = getExchangeState(token);
  if (existing) {
    setExchangeState(token, { ...existing, successModalDismissed: true });
  }
}

/**
 * Mark upsell as shown for a token
 */
export function markUpsellShown(token: string): void {
  const existing = getExchangeState(token);
  if (existing) {
    setExchangeState(token, { ...existing, upsellShown: true });
  }
}

/**
 * Check if user has completed their first contact save (iOS non-embedded only)
 */
export function hasCompletedFirstSave(): boolean {
  try {
    return localStorage.getItem('google_contacts_first_save_completed') === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark that user has completed their first contact save (iOS non-embedded only)
 */
export function markFirstSaveCompleted(): void {
  try {
    localStorage.setItem('google_contacts_first_save_completed', 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if this is a first-time save (no exchange state exists)
 */
export function isFirstTimeSave(token: string): boolean {
  return getExchangeState(token) === null;
}

/**
 * Check if user has ever successfully authorized Google Contacts (global across all contacts)
 */
export function hasGoogleContactsPermission(): boolean {
  try {
    return localStorage.getItem('google_contacts_permission_granted') === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark that user has successfully authorized Google Contacts (global)
 */
export function markGoogleContactsPermissionGranted(): void {
  try {
    localStorage.setItem('google_contacts_permission_granted', 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if upsell should be shown based on exchange state
 */
export function shouldShowUpsell(token: string): boolean {
  const state = getExchangeState(token);

  // For first-time saves (no state yet), check if user has permission globally
  if (!state) {
    return !hasGoogleContactsPermission();
  }

  // Only show upsell if contact was saved to Firebase but not Google
  if (state.state !== 'completed_firebase_only') return false;

  return true;
}

/**
 * Check if success modal should be shown
 */
export function shouldShowSuccess(token: string): boolean {
  const state = getExchangeState(token);
  return state?.state === 'completed_success';
}

/**
 * Check if we're returning from auth flow
 */
export function isReturningFromAuth(token: string): boolean {
  // First check URL params (handles both modal-triggered and fast-path auth)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('incremental_auth');
    if (authResult === 'success' || authResult === 'denied') {
      return true;
    }
  }

  // Also check for recent auth_in_progress state (fallback for fast-path)
  const state = getExchangeState(token);
  if (!state) return false;

  if (state.state === 'auth_in_progress') {
    const age = Date.now() - state.timestamp;
    return age <= 2 * 60 * 1000; // Within 2 minutes
  }

  return false;
}