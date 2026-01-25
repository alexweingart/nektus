/**
 * Real-time contact exchange service for iOS
 * Uses polling for match detection and expo-sensors for motion
 */

import { getApiBaseUrl, getIdToken } from '../../auth/firebase';
import type {
  ContactExchangeRequest,
  ContactExchangeResponse,
  ContactExchangeState
} from '@nektus/shared-types';
import { MotionDetector } from '../motion';

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
  private motionDetectionCancelled: boolean = false;
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
    motionPermissionGranted: boolean = false,
    sharingCategory: 'All' | 'Personal' | 'Work' = 'All'
  ): Promise<void> {
    try {
      console.log(`🎯 [iOS] Starting exchange (${sharingCategory}) with session ${this.sessionId}, motion=${motionPermissionGranted}`);

      // Get auth token for API calls
      const idToken = await getIdToken();
      console.log(`🔐 [iOS] Got ID token: ${idToken ? idToken.substring(0, 20) + '...' : 'NULL'}`);

      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (idToken) {
        authHeaders['Authorization'] = `Bearer ${idToken}`;
      } else {
        console.error('❌ [iOS] No auth token available - user may not be signed in');
      }

      // Initialize exchange and get token for QR code display
      const initiateResponse = await fetch(`${this.apiBaseUrl}/api/exchange/initiate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          sessionId: this.sessionId,
          sharingCategory
        })
      });

      if (!initiateResponse.ok) {
        const errorText = await initiateResponse.text();
        console.error('[iOS] Initiate failed:', initiateResponse.status, errorText);
        throw new Error(`Failed to initiate exchange: ${initiateResponse.status}`);
      }

      const { token } = await initiateResponse.json();
      this.matchToken = token;

      // Emit event with token for ProfileView to show QR code
      exchangeEvents.emit('exchange-initiated', { token });

      console.log(`🎫 [iOS] Exchange initiated with token: ${token.substring(0, 8)}...`);

      // Reset cancellation flag
      this.motionDetectionCancelled = false;

      // Start listening for motion (or just QR in simulator)
      this.updateState({ status: 'waiting-for-bump' });

      if (motionPermissionGranted) {
        // Start fresh motion detection session
        MotionDetector.startNewSession();
        console.log('👂 [iOS] Waiting for bump or scan (20s timeout)...');
      } else {
        console.log('📱 [iOS] QR-only mode - waiting for scan (20s timeout)...');
      }

      // Start polling immediately for QR scan matches
      this.startMatchPolling();
      console.log('🔄 [iOS] Started polling for QR scan matches');

      // Set 20-second timeout for entire exchange process
      this.waitingForBumpTimeout = setTimeout(async () => {
        console.log('⏰ [iOS] Exchange timed out after 20 seconds');

        // Stop motion detection and polling
        await this.disconnect();

        // Only show timeout if we haven't found a match
        if (this.state.status !== 'matched') {
          console.log('⏰ [iOS] Showing timeout UI');
          this.updateState({ status: 'timeout' });
        } else {
          console.log('✅ [iOS] Match found - not showing timeout');
        }
      }, 20000);

      // Only start motion detection if permission was granted
      if (motionPermissionGranted) {
        await this.waitForBump(true, sharingCategory);
      }
      // If no motion permission, just wait for QR scan via polling

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
    // Cancel motion detection
    this.motionDetectionCancelled = true;

    // End motion detection session completely
    MotionDetector.endSession();

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
      if (this.motionDetectionCancelled || this.state.status === 'timeout' || this.state.status === 'error') {
        this.clearPolling();
        return;
      }

      try {
        const idToken = await getIdToken();
        const response = await fetch(`${this.apiBaseUrl}/api/exchange/status/${this.sessionId}`, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
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
            }, 60000);
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

  private async waitForBump(_hasPermission: boolean, sharingCategory: 'All' | 'Personal' | 'Work'): Promise<void> {
    let hitCount = 0;
    let lastHitTime = 0;
    const HIT_COOLDOWN_MS = 500;

    while (!this.motionDetectionCancelled) {
      try {
        const isFirstHit = hitCount === 0;

        // Detect motion/bump
        const motionResult = await MotionDetector.detectMotion();

        if (!motionResult.hasMotion) {
          return; // Cancelled or timed out
        }

        // Rate limiting
        const now = Date.now();
        if (!isFirstHit && (now - lastHitTime) < HIT_COOLDOWN_MS) {
          continue;
        }

        hitCount++;
        lastHitTime = now;

        console.log(`🚀 [iOS] Hit #${hitCount} detected (mag=${motionResult.magnitude.toFixed(2)})`);

        // Prepare exchange request
        const request: ContactExchangeRequest = {
          ts: motionResult.timestamp || Date.now(),
          mag: motionResult.magnitude,
          session: this.sessionId,
          sharingCategory: sharingCategory,
          tSent: Date.now(),
          hitNumber: hitCount
        };

        // Add vector hash if motion was detected
        if (motionResult.acceleration) {
          request.vector = await MotionDetector.hashAcceleration(motionResult.acceleration);
        }

        // Send hit to server
        if (isFirstHit) {
          console.log(`🚨 [iOS] Setting status to processing (first hit detected)`);
          this.updateState({ status: 'processing' });
        }

        console.log(`📤 [iOS] Sending hit #${hitCount} to server`);
        const response = await this.sendHit(request);

        // If we got an immediate match, handle it
        if (response.matched && response.token) {
          console.log(`🎉 [iOS] Instant match!`);
          await this.handleMatch(response.token, response.youAre || 'A');
          return;
        } else {
          // Start polling as fallback (only on first hit)
          if (isFirstHit) {
            this.startMatchPolling();
          }
        }

      } catch (error) {
        console.error('❌ [iOS] Error in waitForBump:', error);
        this.updateState({
          status: 'error',
          error: 'Motion detection failed - please try again'
        });
        break;
      }
    }
  }

  private async sendHit(request: ContactExchangeRequest): Promise<ContactExchangeResponse> {
    const idToken = await getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch(`${this.apiBaseUrl}/api/exchange/hit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      let serverMessage = 'Unknown error';
      try {
        const errorBody = await response.json();
        serverMessage = errorBody.message || serverMessage;
      } catch {
        // Response wasn't JSON
      }
      throw new Error(`Exchange failed (${response.status}): ${serverMessage}`);
    }

    const result: ContactExchangeResponse = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Exchange request failed');
    }

    return result;
  }

  private updateState(updates: Partial<ContactExchangeState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }
}
