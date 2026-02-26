/**
 * Real-time contact exchange service for iOS
 * Uses polling for match detection (QR scan matches)
 */

import { DeviceEventEmitter } from 'react-native';
import { getApiBaseUrl, getIdToken } from '../../auth/firebase';
import type {
  ContactExchangeResponse,
  ContactExchangeState
} from '@nektus/shared-types';
import { EXCHANGE_TIMEOUT } from '@nektus/shared-client';

// DeviceEventEmitter event for reliable token propagation to ProfileView
export const EXCHANGE_TOKEN_EVENT = 'EXCHANGE_TOKEN_CHANGED';

// Simple event callback system for exchange events
type ExchangeEventCallback = (data: { token: string }) => void;
const exchangeInitiatedCallbacks: ExchangeEventCallback[] = [];

export const exchangeEvents = {
  onExchangeInitiated: (callback: ExchangeEventCallback) => {
    exchangeInitiatedCallbacks.push(callback);
    return () => {
      const index = exchangeInitiatedCallbacks.indexOf(callback);
      if (index > -1) exchangeInitiatedCallbacks.splice(index, 1);
    };
  },
  emit: (event: string, data: { token: string }) => {
    if (event === 'exchange-initiated') {
      exchangeInitiatedCallbacks.forEach(cb => cb(data));
    }
  }
};

// Generate a unique session ID
function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export { generateSessionId };

export class RealTimeContactExchangeService {
  private sessionId: string;
  private state: ContactExchangeState;
  private onStateChange?: (state: ContactExchangeState) => void;
  private cancelled: boolean = false;
  private abortController: AbortController = new AbortController();
  private waitingForBumpTimeout: ReturnType<typeof setTimeout> | null = null;
  private matchPollingInterval: ReturnType<typeof setInterval> | null = null;
  private matchToken: string | null = null;
  private apiBaseUrl: string;

  constructor(sessionId: string, onStateChange?: (state: ContactExchangeState) => void) {
    this.sessionId = sessionId;
    this.state = { status: 'idle' };
    this.onStateChange = onStateChange;
    this.apiBaseUrl = getApiBaseUrl();
  }

  /**
   * Get current exchange state
   */
  getState(): ContactExchangeState {
    return { ...this.state };
  }

  /**
   * Get current match token (for QR code display)
   */
  getMatchToken(): string | null {
    return this.matchToken;
  }

  /**
   * Start the contact exchange process
   */
  async startExchange(
    sharingCategory: 'All' | 'Personal' | 'Work' = 'All'
  ): Promise<void> {
    try {
      console.log(`[iOS] Starting exchange (${sharingCategory}) with session ${this.sessionId}`);

      // Get auth token for API calls
      const idToken = await getIdToken();

      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (idToken) {
        authHeaders['Authorization'] = `Bearer ${idToken}`;
      } else {
        console.error('[iOS] No auth token available - user may not be signed in');
      }

      // Initialize exchange and get token for QR code display
      const initiateResponse = await fetch(`${this.apiBaseUrl}/api/exchange/initiate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          sessionId: this.sessionId,
          sharingCategory
        }),
        signal: this.abortController.signal,
      });

      if (!initiateResponse.ok) {
        const errorText = await initiateResponse.text();
        console.error('[iOS] Initiate failed:', initiateResponse.status, errorText);
        throw new Error(`Failed to initiate exchange: ${initiateResponse.status}`);
      }

      const { token } = await initiateResponse.json();
      this.matchToken = token;

      // Emit token via DeviceEventEmitter for reliable propagation to ProfileView
      DeviceEventEmitter.emit(EXCHANGE_TOKEN_EVENT, { token });

      // Also emit via module-level callbacks (legacy path)
      exchangeEvents.emit('exchange-initiated', { token });

      console.log(`[iOS] Exchange initiated with token: ${token?.substring(0, 8)}...`);

      // Reset cancellation flag
      this.cancelled = false;

      // Start waiting for scan
      this.updateState({ status: 'waiting-for-bump' });

      // Start polling immediately for QR scan matches
      this.startMatchPolling();
      console.log('[iOS] Started polling for QR scan matches');

      // Set 60-second timeout for entire exchange process
      this.waitingForBumpTimeout = setTimeout(async () => {
        console.log('[iOS] Exchange timed out after 60 seconds');

        // Stop polling
        await this.disconnect();

        // Only show timeout if we haven't found a match
        if (this.state.status !== 'matched') {
          this.updateState({ status: 'timeout' });
        }
      }, EXCHANGE_TIMEOUT.SLOW_MS);

    } catch (error) {
      console.error('[iOS] Exchange failed:', error);
      this.updateState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Exchange failed'
      });
    }
  }

  /**
   * Reset the exchange state
   */
  async reset(): Promise<void> {
    await this.disconnect();
    this.updateState({ status: 'idle' });
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    this.cancelled = true;

    // Abort all pending fetch requests to free connection slots
    this.abortController.abort();

    // Clear any active timeouts
    if (this.waitingForBumpTimeout) {
      clearTimeout(this.waitingForBumpTimeout);
      this.waitingForBumpTimeout = null;
    }
    if (this.matchPollingInterval) {
      clearInterval(this.matchPollingInterval);
      this.matchPollingInterval = null;
    }
  }

  /**
   * Start polling for matches
   */
  private async startMatchPolling(): Promise<void> {
    // Don't start polling if already running
    if (this.matchPollingInterval) {
      console.log('🔄 [iOS] Polling already running, skipping duplicate start');
      return;
    }

    // Poll every 1 second
    this.matchPollingInterval = setInterval(async () => {
      // Check if exchange has been cancelled/timed out
      if (this.cancelled || this.state.status === 'timeout' || this.state.status === 'error') {
        this.clearPolling();
        return;
      }

      try {
        const idToken = await getIdToken();
        const response = await fetch(`${this.apiBaseUrl}/api/exchange/status/${this.sessionId}`, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
          signal: this.abortController.signal,
        });

        if (!response.ok) {
          let serverMessage = 'Unknown error';
          try {
            const errorBody = await response.json();
            serverMessage = errorBody.message || serverMessage;
          } catch {
            // Response wasn't JSON
          }
          throw new Error(`Status check failed (${response.status}): ${serverMessage}`);
        }

        const result = await response.json();

        // Check for QR scan status updates
        if (result.success && result.scanStatus === 'pending_auth') {
          console.log('⏳ [iOS] QR scanned - User B is signing in...');

          // Extend timeout to 60 seconds for OAuth sign-in
          if (this.waitingForBumpTimeout) {
            clearTimeout(this.waitingForBumpTimeout);
            console.log('⏰ [iOS] Extending timeout to 60 seconds for OAuth sign-in');
            this.waitingForBumpTimeout = setTimeout(async () => {
              console.log('⏰ [iOS] Exchange timed out after 60 seconds (QR scan)');
              await this.disconnect();
              if (this.state.status !== 'matched') {
                this.updateState({ status: 'timeout' });
              }
            }, EXCHANGE_TIMEOUT.SLOW_MS);
          }

          this.updateState({ status: 'qr-scan-pending' });
          return;
        }

        if (result.success && result.hasMatch && result.match) {
          console.log('🎉 [iOS] Match found!');

          // Check if this is a QR scan match
          if (result.scanStatus === 'completed') {
            console.log('📱 [iOS] QR scan match completed!');

            // Clear timeout - match found!
            if (this.waitingForBumpTimeout) {
              clearTimeout(this.waitingForBumpTimeout);
              this.waitingForBumpTimeout = null;
            }

            // Clear polling
            this.clearPolling();

            this.updateState({ status: 'qr-scan-matched', qrToken: result.match.token });
          } else {
            // Regular bump match
            this.clearPolling();
            await this.handleMatch(result.match.token, result.match.youAre);
          }
          return;
        }

      } catch (error) {
        console.error('[iOS] Polling error:', error);
        // Don't stop polling on single error - let main timeout handle it
      }
    }, 1000);
  }

  /**
   * Clear polling interval
   */
  private clearPolling(): void {
    if (this.matchPollingInterval) {
      clearInterval(this.matchPollingInterval);
      this.matchPollingInterval = null;
    }
  }

  private async handleMatch(token: string, youAre: 'A' | 'B'): Promise<void> {
    try {
      // Clear the main exchange timeout when match is found
      if (this.waitingForBumpTimeout) {
        clearTimeout(this.waitingForBumpTimeout);
        this.waitingForBumpTimeout = null;
      }

      // Fetch the matched user's profile
      const idToken = await getIdToken();
      const response = await fetch(`${this.apiBaseUrl}/api/exchange/pair/${token}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch matched profile');
      }

      const result = await response.json();

      if (result.success && result.profile) {
        console.log(`👤 [iOS] Matched with: ${result.profile.name}`);
        this.updateState({
          status: 'matched',
          match: {
            token,
            youAre,
            profile: result.profile
          }
        });

        // Clean up the service after match
        await this.disconnect();
      } else {
        throw new Error('Invalid match response');
      }

    } catch (error) {
      console.error('[iOS] Failed to handle match:', error);
      this.updateState({
        status: 'error',
        error: 'Failed to load matched profile'
      });
    }
  }

  private updateState(updates: Partial<ContactExchangeState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }
}
