/**
 * BLE Exchange Service for Nektus iOS App
 * Implements the state machine for BLE proximity matching
 *
 * Flow:
 * 1. User taps Nekt (record buttonPressTimestamp)
 * 2. Start advertising + scanning simultaneously
 * 3. Peer discovered → Determine role (earlier timestamp = initiator)
 * 4. Initiator connects → Exchange profiles via GATT
 * 5. Both receive profile → Emit match-found → Display contact
 */

// Device type from react-native-ble-plx (using any for now as types may not be available)
type Device = any;

import type {
  BLEAdvertisementData,
  BLEProfilePayload,
  BLEExchangeState,
  BLEMatchResult,
  UserProfile,
  ExchangeStatus,
} from '@nektus/shared-types';
import {
  getBleManager,
  requestBluetoothPermissions,
  waitForBluetoothReady,
  startScanning,
  connectToDevice,
  disconnectDevice,
  writeProfileToDevice,
  readProfileFromDevice,
  monitorConnectionState,
  getSecondsSinceMidnightUTC,
  generateBLEMatchToken,
  NEKTUS_SERVICE_UUID,
} from './ble-manager';
import { filterProfileByCategory, type SharingCategory } from '../../profile/filtering';
import { EXCHANGE_TIMEOUT } from '@nektus/shared-client';
import {
  emitStartFloating,
  emitStopFloating,
  emitMatchFound,
} from '../../../app/utils/animationEvents';

// BLE exchange timeout (matching server exchange timeout)
const BLE_EXCHANGE_TIMEOUT_MS = EXCHANGE_TIMEOUT.MEDIUM_MS;

// Debounce for duplicate device discoveries
const DISCOVERY_DEBOUNCE_MS = 1000;

export interface BLEServiceCallbacks {
  onStateChange?: (state: BLEExchangeState) => void;
  onStatusChange?: (status: ExchangeStatus) => void;
  onMatch?: (match: BLEMatchResult) => void;
  onError?: (error: Error) => void;
}

interface DiscoveredPeer {
  device: Device;
  advertisementData: BLEAdvertisementData;
  discoveredAt: number;
}

export class BLEExchangeService {
  private state: BLEExchangeState = 'idle';
  private status: ExchangeStatus = 'idle';
  private callbacks: BLEServiceCallbacks;
  private userProfile: UserProfile | null = null;
  private sharingCategory: SharingCategory = 'Personal';
  private buttonPressTimestamp: number = 0;
  private userId: string = '';

  // Scanning state
  private scanHandle: { stop: () => void } | null = null;
  private discoveredPeers: Map<string, DiscoveredPeer> = new Map();

  // Connection state
  private connectedDevice: Device | null = null;
  private connectionMonitor: { cancel: () => void } | null = null;

  // Timeout handle
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  // Cancel flag
  private cancelled: boolean = false;

  constructor(callbacks: BLEServiceCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Get current BLE exchange state
   */
  getState(): BLEExchangeState {
    return this.state;
  }

  /**
   * Get current exchange status (for UI)
   */
  getStatus(): ExchangeStatus {
    return this.status;
  }

  /**
   * Check if BLE is available
   */
  async isAvailable(): Promise<boolean> {
    const result = await requestBluetoothPermissions();
    return result.granted;
  }

  /**
   * Start BLE exchange process
   */
  async start(
    userId: string,
    userProfile: UserProfile,
    sharingCategory: SharingCategory
  ): Promise<void> {
    if (this.state !== 'idle') {
      console.warn('[BLE Service] Already running, ignoring start');
      return;
    }

    console.log('[BLE Service] Starting BLE exchange...');
    this.cancelled = false;
    this.userId = userId;
    this.userProfile = userProfile;
    this.sharingCategory = sharingCategory;
    this.buttonPressTimestamp = getSecondsSinceMidnightUTC();
    this.discoveredPeers.clear();

    // Update state
    this.setState('starting');
    this.setStatus('ble-scanning');

    try {
      // Request BLE permissions
      const permissionResult = await requestBluetoothPermissions();
      if (!permissionResult.granted) {
        console.warn('[BLE Service] BLE permissions not granted:', permissionResult.message);
        this.setStatus('ble-unavailable');
        this.callbacks.onError?.(new Error(permissionResult.message || 'BLE not available'));
        this.setState('failed');
        return;
      }

      // Wait for Bluetooth to be ready
      const isReady = await waitForBluetoothReady(EXCHANGE_TIMEOUT.MEDIUM_MS);
      if (!isReady) {
        console.warn('[BLE Service] Bluetooth not ready');
        this.setStatus('ble-unavailable');
        this.callbacks.onError?.(new Error('Bluetooth not ready'));
        this.setState('failed');
        return;
      }

      if (this.cancelled) {
        console.log('[BLE Service] Cancelled before scanning');
        return;
      }

      // Start timeout
      this.timeoutHandle = setTimeout(() => {
        if (this.state !== 'completed' && this.state !== 'failed') {
          console.log('[BLE Service] Exchange timeout');
          this.stop();
          this.callbacks.onError?.(new Error('BLE exchange timeout'));
        }
      }, BLE_EXCHANGE_TIMEOUT_MS);

      // Start scanning for peers
      this.startScanning();
      this.setState('scanning');

      // Note: iOS doesn't support BLE peripheral advertising from apps
      // We rely on both devices scanning and connecting as centrals
      // The initiator (earlier timestamp) will attempt connection

    } catch (error) {
      console.error('[BLE Service] Failed to start:', error);
      this.setStatus('error');
      this.setState('failed');
      this.callbacks.onError?.(error instanceof Error ? error : new Error('Failed to start BLE'));
    }
  }

  /**
   * Stop BLE exchange process
   */
  stop(): void {
    console.log('[BLE Service] Stopping BLE exchange...');
    this.cancelled = true;

    // Clear timeout
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    // Stop scanning
    if (this.scanHandle) {
      this.scanHandle.stop();
      this.scanHandle = null;
    }

    // Cancel connection monitor
    if (this.connectionMonitor) {
      this.connectionMonitor.cancel();
      this.connectionMonitor = null;
    }

    // Disconnect device
    if (this.connectedDevice) {
      disconnectDevice(this.connectedDevice);
      this.connectedDevice = null;
    }

    // Clear peers
    this.discoveredPeers.clear();

    // Reset state
    if (this.state !== 'completed') {
      this.setState('idle');
      this.setStatus('idle');
    }
  }

  /**
   * Start scanning for nearby Nektus devices
   */
  private async startScanning(): Promise<void> {
    console.log('[BLE Service] Starting scan...');

    this.scanHandle = await startScanning(
      (device, advertisementData) => this.handleDeviceDiscovered(device, advertisementData),
      (error) => this.handleScanError(error)
    );
  }

  /**
   * Handle discovered device
   */
  private async handleDeviceDiscovered(
    device: Device,
    advertisementData: BLEAdvertisementData | null
  ): Promise<void> {
    if (this.cancelled) return;

    // Ignore devices without proper advertisement data
    if (!advertisementData) {
      console.log('[BLE Service] Ignoring device without advertisement data');
      return;
    }

    // Ignore our own device (shouldn't happen, but safety check)
    if (advertisementData.userId === this.userId.slice(0, 8)) {
      console.log('[BLE Service] Ignoring own device');
      return;
    }

    // Check if sharing category matches
    const ourCategory = this.sharingCategory === 'Personal' ? 'P' : 'W';
    if (advertisementData.sharingCategory !== ourCategory) {
      console.log('[BLE Service] Sharing category mismatch:', advertisementData.sharingCategory, 'vs', ourCategory);
      return;
    }

    // Debounce duplicate discoveries
    const existingPeer = this.discoveredPeers.get(device.id);
    if (existingPeer && Date.now() - existingPeer.discoveredAt < DISCOVERY_DEBOUNCE_MS) {
      return;
    }

    console.log(`[BLE Service] Discovered peer: ${advertisementData.userId} (${device.id})`);

    // Store peer info
    this.discoveredPeers.set(device.id, {
      device,
      advertisementData,
      discoveredAt: Date.now(),
    });

    this.setState('discovered');
    this.setStatus('ble-discovered');

    // Determine role: earlier timestamp = initiator
    const isInitiator = this.shouldBeInitiator(advertisementData);

    console.log(`[BLE Service] Role: ${isInitiator ? 'Initiator' : 'Responder'}`);

    if (isInitiator) {
      // We initiate the connection
      await this.initiateConnection(device);
    } else {
      // Wait for the other device to connect to us
      // In practice, both devices scan and the initiator connects
      console.log('[BLE Service] Waiting for peer to initiate connection...');
    }
  }

  /**
   * Determine if we should be the initiator based on timestamps
   */
  private shouldBeInitiator(peerData: BLEAdvertisementData): boolean {
    // Earlier timestamp = initiator
    if (this.buttonPressTimestamp < peerData.buttonPressTimestamp) {
      return true;
    }
    if (this.buttonPressTimestamp > peerData.buttonPressTimestamp) {
      return false;
    }
    // Timestamps equal: fallback to lexicographic userId comparison
    return this.userId.slice(0, 8) < peerData.userId;
  }

  /**
   * Initiate connection to peer device
   */
  private async initiateConnection(device: Device): Promise<void> {
    if (this.cancelled || this.state === 'completed') return;

    console.log(`[BLE Service] Initiating connection to ${device.id}...`);
    this.setState('connecting');
    this.setStatus('ble-connecting');

    try {
      // Stop scanning while connecting
      if (this.scanHandle) {
        this.scanHandle.stop();
        this.scanHandle = null;
      }

      // Connect to device
      this.connectedDevice = await connectToDevice(device);

      // Monitor connection state
      this.connectionMonitor = monitorConnectionState(this.connectedDevice, () => {
        if (this.state !== 'completed') {
          console.log('[BLE Service] Connection lost');
          this.handleConnectionLost();
        }
      });

      if (this.cancelled) {
        await disconnectDevice(this.connectedDevice);
        return;
      }

      // Exchange profiles
      await this.exchangeProfiles(true); // true = we are initiator

    } catch (error) {
      console.error('[BLE Service] Connection failed:', error);
      this.handleConnectionError(error instanceof Error ? error : new Error('Connection failed'));
    }
  }

  /**
   * Exchange profiles with connected peer
   */
  private async exchangeProfiles(isInitiator: boolean): Promise<void> {
    if (this.cancelled || !this.connectedDevice || !this.userProfile) return;

    console.log('[BLE Service] Exchanging profiles...');
    this.setState('exchanging');
    this.setStatus('ble-exchanging');

    try {
      // Filter our profile by sharing category
      const filteredProfile = filterProfileByCategory(this.userProfile, this.sharingCategory);

      // Prepare BLE profile payload
      const ourPayload: BLEProfilePayload = {
        userId: this.userProfile.userId,
        profileImage: this.userProfile.profileImage,
        backgroundColors: this.userProfile.backgroundColors,
        contactEntries: filteredProfile.contactEntries,
      };

      // Write our profile to peer
      await writeProfileToDevice(this.connectedDevice, ourPayload);
      console.log('[BLE Service] Wrote our profile to peer');

      // Read peer's profile
      const peerPayload = await readProfileFromDevice(this.connectedDevice);
      if (!peerPayload) {
        throw new Error('Failed to read peer profile');
      }
      console.log('[BLE Service] Read peer profile');

      // Disconnect after exchange
      if (this.connectionMonitor) {
        this.connectionMonitor.cancel();
        this.connectionMonitor = null;
      }
      await disconnectDevice(this.connectedDevice);
      this.connectedDevice = null;

      // Build match result
      const matchResult: BLEMatchResult = {
        token: generateBLEMatchToken(),
        youAre: isInitiator ? 'A' : 'B',
        profile: {
          userId: peerPayload.userId,
          shortCode: '', // Not sent over BLE
          profileImage: peerPayload.profileImage,
          backgroundImage: '', // Not sent over BLE
          backgroundColors: peerPayload.backgroundColors,
          lastUpdated: Date.now(),
          contactEntries: peerPayload.contactEntries,
        },
        matchType: 'ble',
      };

      // Success!
      this.handleMatchSuccess(matchResult);

    } catch (error) {
      console.error('[BLE Service] Profile exchange failed:', error);
      this.handleConnectionError(error instanceof Error ? error : new Error('Exchange failed'));
    }
  }

  /**
   * Handle successful match
   */
  private handleMatchSuccess(match: BLEMatchResult): void {
    console.log('[BLE Service] Match successful!', match.token);

    // Clear timeout
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    this.setState('completed');
    this.setStatus('ble-matched');

    // Emit animation event
    emitMatchFound(match.profile.backgroundColors);

    // Notify callback
    this.callbacks.onMatch?.(match);
  }

  /**
   * Handle scan error
   */
  private handleScanError(error: Error): void {
    console.error('[BLE Service] Scan error:', error);
    // Don't fail completely on scan error, just log it
    // The timeout will eventually handle giving up
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: Error): void {
    console.error('[BLE Service] Connection error:', error);

    // Cleanup
    if (this.connectionMonitor) {
      this.connectionMonitor.cancel();
      this.connectionMonitor = null;
    }
    if (this.connectedDevice) {
      disconnectDevice(this.connectedDevice);
      this.connectedDevice = null;
    }

    // Resume scanning for other peers
    if (!this.cancelled && this.state !== 'completed') {
      console.log('[BLE Service] Resuming scan after connection error...');
      this.setState('scanning');
      this.setStatus('ble-scanning');
      this.startScanning();
    }
  }

  /**
   * Handle connection lost
   */
  private handleConnectionLost(): void {
    console.log('[BLE Service] Connection lost');

    this.connectedDevice = null;
    if (this.connectionMonitor) {
      this.connectionMonitor.cancel();
      this.connectionMonitor = null;
    }

    // Resume scanning
    if (!this.cancelled && this.state !== 'completed') {
      console.log('[BLE Service] Resuming scan after connection lost...');
      this.setState('scanning');
      this.setStatus('ble-scanning');
      this.startScanning();
    }
  }

  /**
   * Update internal state
   */
  private setState(state: BLEExchangeState): void {
    if (this.state !== state) {
      console.log(`[BLE Service] State: ${this.state} -> ${state}`);
      this.state = state;
      this.callbacks.onStateChange?.(state);
    }
  }

  /**
   * Update exchange status (for UI)
   */
  private setStatus(status: ExchangeStatus): void {
    if (this.status !== status) {
      console.log(`[BLE Service] Status: ${this.status} -> ${status}`);
      this.status = status;
      this.callbacks.onStatusChange?.(status);
    }
  }
}

/**
 * Create a new BLE exchange service instance
 */
export function createBLEExchangeService(callbacks?: BLEServiceCallbacks): BLEExchangeService {
  return new BLEExchangeService(callbacks);
}
