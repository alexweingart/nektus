/**
 * Hybrid Exchange Service for Nektus iOS App
 * Coordinates BLE + server matching simultaneously (first match wins)
 *
 * Design:
 * - Both BLE and server start when user taps Nekt
 * - First match wins: whichever returns a match first, the other is cancelled
 * - Race condition handling: if both return at nearly the same time, pick earlier timestamp
 * - Cancellation: stopBLE() and stopServerPolling() methods to cleanly stop the other
 *
 * Long-term goal: fully offline capable - server calls are non-blocking
 */

import type {
  ContactExchangeState,
  ExchangeStatus,
  UserProfile,
  BLEMatchResult,
} from '@nektus/shared-types';
import { RealTimeContactExchangeService, generateSessionId, exchangeEvents } from './service';
import { BLEExchangeService } from './ble-service';
import type { SharingCategory } from '../../profile/filtering';

// Match result unified across BLE and server
export interface HybridMatchResult {
  token: string;
  profile: UserProfile;
  youAre: 'A' | 'B';
  matchType: 'ble' | 'bump' | 'qr-scan';
}

export interface HybridServiceCallbacks {
  onStateChange?: (state: ContactExchangeState) => void;
  onStatusChange?: (status: ExchangeStatus) => void;
  onMatchTokenChange?: (token: string | null) => void;
  onMatch?: (match: HybridMatchResult) => void;
}

export class HybridExchangeService {
  private callbacks: HybridServiceCallbacks;
  private bleService: BLEExchangeService | null = null;
  private serverService: RealTimeContactExchangeService | null = null;
  private sessionId: string;
  private matchFound: boolean = false;
  private userProfile: UserProfile | null = null;
  private userId: string = '';
  private sharingCategory: SharingCategory = 'Personal';
  private motionPermissionGranted: boolean = false;
  private bleAvailable: boolean = false;
  private currentStatus: ExchangeStatus = 'idle';

  constructor(callbacks: HybridServiceCallbacks = {}) {
    this.callbacks = callbacks;
    this.sessionId = generateSessionId();
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if BLE is available for matching
   */
  async checkBLEAvailability(): Promise<boolean> {
    const bleService = new BLEExchangeService();
    this.bleAvailable = await bleService.isAvailable();
    console.log(`[Hybrid] BLE available: ${this.bleAvailable}`);
    return this.bleAvailable;
  }

  /**
   * Start hybrid exchange (BLE + server simultaneously)
   */
  async start(
    userId: string,
    userProfile: UserProfile,
    sharingCategory: SharingCategory,
    motionPermissionGranted: boolean
  ): Promise<void> {
    if (this.matchFound) {
      console.warn('[Hybrid] Already matched, ignoring start');
      return;
    }

    console.log('[Hybrid] Starting hybrid exchange...');
    this.userId = userId;
    this.userProfile = userProfile;
    this.sharingCategory = sharingCategory;
    this.motionPermissionGranted = motionPermissionGranted;
    this.matchFound = false;

    // Update status based on BLE availability
    // When BLE is available, BLE scanning handles proximity — show scanning status
    this.updateStatus(this.bleAvailable ? 'ble-scanning' : 'waiting-for-bump');

    // Start BLE and server in parallel
    const blePromise = this.startBLE();
    const serverPromise = this.startServer();

    // Both start immediately, first match wins
    await Promise.all([blePromise, serverPromise]);
  }

  /**
   * Start BLE matching
   */
  private async startBLE(): Promise<void> {
    if (!this.userProfile || this.matchFound) return;

    // Check BLE availability first
    if (!this.bleAvailable) {
      await this.checkBLEAvailability();
    }

    if (!this.bleAvailable) {
      console.log('[Hybrid] BLE not available, skipping');
      return;
    }

    console.log('[Hybrid] Starting BLE service...');

    this.bleService = new BLEExchangeService({
      onStatusChange: (status) => {
        // Only update status if no match found yet
        if (!this.matchFound) {
          this.updateStatus(status);
        }
      },
      onMatch: (match) => this.handleBLEMatch(match),
      onError: (error) => {
        console.warn('[Hybrid] BLE error:', error.message);
        // Don't fail hybrid service on BLE error - server may still work
      },
    });

    try {
      await this.bleService.start(this.userId, this.userProfile!, this.sharingCategory);
    } catch (error) {
      console.warn('[Hybrid] BLE start failed:', error);
      // Don't propagate error - server matching continues
    }
  }

  /**
   * Start server matching
   */
  private async startServer(): Promise<void> {
    if (this.matchFound) return;

    console.log('[Hybrid] Starting server service...');

    this.serverService = new RealTimeContactExchangeService(
      this.sessionId,
      (state) => this.handleServerStateChange(state)
    );

    // Convert sharing category format
    const serverCategory = this.sharingCategory === 'Personal' ? 'Personal' : 'Work';

    try {
      // When BLE is available, disable motion detection for server matching
      // BLE handles proximity via scanning; server only handles QR code matching
      const motionForServer = this.bleAvailable ? false : this.motionPermissionGranted;
      await this.serverService.startExchange(motionForServer, serverCategory);
    } catch (error) {
      console.warn('[Hybrid] Server start failed:', error);
      // BLE matching continues independently
    }
  }

  /**
   * Handle BLE match
   */
  private handleBLEMatch(bleMatch: BLEMatchResult): void {
    if (this.matchFound) {
      console.log('[Hybrid] Already matched, ignoring BLE match');
      return;
    }

    console.log('[Hybrid] BLE match received!', bleMatch.token);
    this.matchFound = true;

    // Stop server service
    this.stopServer();

    // Convert to hybrid match result
    const match: HybridMatchResult = {
      token: bleMatch.token,
      profile: bleMatch.profile,
      youAre: bleMatch.youAre,
      matchType: 'ble',
    };

    // Call onMatch BEFORE updateStatus so the glow color is set before the animation starts
    this.callbacks.onMatch?.(match);
    this.updateStatus('ble-matched');
  }

  /**
   * Handle server state change
   */
  private handleServerStateChange(state: ContactExchangeState): void {
    // Forward state to callback
    this.callbacks.onStateChange?.(state);

    // Update status if not BLE status
    // When BLE is available, don't let server's bump/processing override BLE scanning
    if (!this.matchFound && !state.status.startsWith('ble-')) {
      const isBumpStatus = state.status === 'waiting-for-bump' || state.status === 'processing';
      if (!(this.bleAvailable && isBumpStatus)) {
        this.updateStatus(state.status);
      }
    }

    // Handle server match
    if (state.status === 'matched' && state.match) {
      this.handleServerMatch(state);
    }

    // Handle QR scan match
    if (state.status === 'qr-scan-matched' && state.qrToken) {
      // QR scan matched - let ExchangeButton handle fetching profile
      // We just forward the status
      this.callbacks.onMatchTokenChange?.(state.qrToken);
    }

    // Forward QR token for display
    if (this.serverService) {
      const token = this.serverService.getMatchToken();
      if (token) {
        this.callbacks.onMatchTokenChange?.(token);
      }
    }
  }

  /**
   * Handle server match
   */
  private handleServerMatch(state: ContactExchangeState): void {
    if (this.matchFound) {
      console.log('[Hybrid] Already matched, ignoring server match');
      return;
    }

    if (!state.match) return;

    console.log('[Hybrid] Server match received!', state.match.token);
    this.matchFound = true;

    // Stop BLE service
    this.stopBLE();

    // Convert to hybrid match result
    const match: HybridMatchResult = {
      token: state.match.token,
      profile: state.match.profile,
      youAre: state.match.youAre,
      matchType: 'bump',
    };

    // Call onMatch BEFORE updateStatus so the glow color is set before the animation starts
    this.callbacks.onMatch?.(match);
    this.updateStatus('matched');
  }

  /**
   * Stop BLE service
   */
  private stopBLE(): void {
    if (this.bleService) {
      console.log('[Hybrid] Stopping BLE service...');
      this.bleService.stop();
      this.bleService = null;
    }
  }

  /**
   * Stop server service
   */
  private stopServer(): void {
    if (this.serverService) {
      console.log('[Hybrid] Stopping server service...');
      this.serverService.disconnect();
      this.serverService = null;
    }
  }

  /**
   * Stop all services
   */
  async stop(): Promise<void> {
    console.log('[Hybrid] Stopping all services...');
    this.stopBLE();
    this.stopServer();
    this.matchFound = false;
    this.updateStatus('idle');
  }

  /**
   * Reset and prepare for new exchange
   */
  async reset(): Promise<void> {
    await this.stop();
    this.sessionId = generateSessionId();
    this.userProfile = null;
  }

  /**
   * Get current state from server service
   */
  getState(): ContactExchangeState {
    if (this.serverService) {
      return this.serverService.getState();
    }
    return { status: this.currentStatus };
  }

  /**
   * Get match token from server service (for QR code display)
   */
  getMatchToken(): string | null {
    return this.serverService?.getMatchToken() ?? null;
  }

  /**
   * Update and emit status
   */
  private updateStatus(status: ExchangeStatus): void {
    if (this.currentStatus !== status) {
      console.log(`[Hybrid] Status: ${this.currentStatus} -> ${status}`);
      this.currentStatus = status;
      this.callbacks.onStatusChange?.(status);
    }
  }
}

/**
 * Create a new hybrid exchange service instance
 */
export function createHybridExchangeService(
  callbacks?: HybridServiceCallbacks
): HybridExchangeService {
  return new HybridExchangeService(callbacks);
}
