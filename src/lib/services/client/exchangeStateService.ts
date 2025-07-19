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
    
    // Completed states expire after 15 minutes (except iOS Safari which persists forever)
    if ((data.state === 'completed_success' || data.state === 'completed_firebase_only')) {
      if (data.platform !== 'ios_safari' && age > 15 * 60 * 1000) {
        clearExchangeState(token);
        return null;
      }
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
 * Mark upsell as shown for a token
 */
export function markUpsellShown(token: string): void {
  const existing = getExchangeState(token);
  if (existing) {
    setExchangeState(token, { ...existing, upsellShown: true });
  }
}

/**
 * Check if upsell should be shown based on exchange state and platform rules
 */
export function shouldShowUpsell(token: string, platform: string): boolean {
  const state = getExchangeState(token);
  if (!state) return false;
  
  // Only show upsell if contact was saved to Firebase but not Google
  if (state.state !== 'completed_firebase_only') return false;
  
  // iOS Safari: show only once ever
  if (platform === 'ios_safari') {
    return !state.upsellShown;
  }
  
  // All other platforms: show every time (for now - simplified as requested)
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
  const state = getExchangeState(token);
  if (!state) return false;
  
  // Check if we have recent auth_in_progress state
  if (state.state === 'auth_in_progress') {
    const age = Date.now() - state.timestamp;
    return age <= 2 * 60 * 1000; // Within 2 minutes
  }
  
  return false;
}