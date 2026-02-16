/**
 * BLE Manager for Nektus iOS App
 * Low-level BLE operations (scan, advertise, connect, read/write)
 * Wraps react-native-ble-plx with nektus-specific logic
 */

// react-native-ble-plx types (dynamic import to handle when package is not installed)
type BleManager = any;
type Device = any;
type BleError = any;

// BLE State enum (mirrors react-native-ble-plx State)
const State = {
  Unknown: 'Unknown',
  Resetting: 'Resetting',
  Unsupported: 'Unsupported',
  Unauthorized: 'Unauthorized',
  PoweredOff: 'PoweredOff',
  PoweredOn: 'PoweredOn',
} as const;
type State = typeof State[keyof typeof State];

import { Platform } from 'react-native';
import type { BLEAdvertisementData, BLEProfilePayload } from '@nektus/shared-types';
import { EXCHANGE_TIMEOUT } from '@nektus/shared-client';

// Polyfill for base64 encoding/decoding in React Native
function base64Encode(str: string): string {
  // Simple base64 encoding using btoa-like approach
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new TextEncoder().encode(str);
  let result = '';
  let i = 0;

  while (i < bytes.length) {
    const a = bytes[i++] || 0;
    const b = bytes[i++] || 0;
    const c = bytes[i++] || 0;

    const triplet = (a << 16) | (b << 8) | c;

    result += chars[(triplet >> 18) & 0x3F];
    result += chars[(triplet >> 12) & 0x3F];
    result += i > bytes.length + 1 ? '=' : chars[(triplet >> 6) & 0x3F];
    result += i > bytes.length ? '=' : chars[triplet & 0x3F];
  }

  return result;
}

function base64Decode(str: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];

  // Remove padding
  const cleanStr = str.replace(/=/g, '');

  for (let i = 0; i < cleanStr.length; i += 4) {
    const a = chars.indexOf(cleanStr[i] || 'A');
    const b = chars.indexOf(cleanStr[i + 1] || 'A');
    const c = chars.indexOf(cleanStr[i + 2] || 'A');
    const d = chars.indexOf(cleanStr[i + 3] || 'A');

    const triplet = (a << 18) | (b << 12) | (c << 6) | d;

    bytes.push((triplet >> 16) & 0xFF);
    if (cleanStr[i + 2]) bytes.push((triplet >> 8) & 0xFF);
    if (cleanStr[i + 3]) bytes.push(triplet & 0xFF);
  }

  return new Uint8Array(bytes);
}

// Nektus custom service UUID (generated with uuidgen)
export const NEKTUS_SERVICE_UUID = '8fa1c2d4-e5f6-4a7b-9c0d-1e2f3a4b5c6d';

// GATT Characteristic UUIDs
const NEKTUS_PROFILE_CHAR_UUID = '8fa1c2d5-e5f6-4a7b-9c0d-1e2f3a4b5c6e';  // For profile exchange
const NEKTUS_METADATA_CHAR_UUID = '8fa1c2d6-e5f6-4a7b-9c0d-1e2f3a4b5c6f'; // For advertisement metadata

// BLE MTU size (typical iOS default is 185, but we chunk at 512 for safety)
const MAX_CHUNK_SIZE = 512;

// BLE scan timeout
const SCAN_TIMEOUT_MS = EXCHANGE_TIMEOUT.SLOW_MS;

// Connection timeout
const CONNECTION_TIMEOUT_MS = EXCHANGE_TIMEOUT.MEDIUM_MS;

// Singleton BLE Manager instance
let bleManagerInstance: BleManager | null = null;
let BleManagerClass: any = null;

/**
 * Dynamically load react-native-ble-plx (handles when package is not installed)
 */
async function loadBleManager(): Promise<any> {
  if (BleManagerClass) return BleManagerClass;

  try {
    // Use require for dynamic loading (more forgiving with missing packages)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('react-native-ble-plx');
    BleManagerClass = module.BleManager;
    return BleManagerClass;
  } catch (error) {
    console.warn('[BLE] react-native-ble-plx not available:', error);
    return null;
  }
}

/**
 * Get or create the singleton BLE manager instance
 */
export async function getBleManagerAsync(): Promise<BleManager | null> {
  if (bleManagerInstance) return bleManagerInstance;

  const BleManager = await loadBleManager();
  if (!BleManager) return null;

  bleManagerInstance = new BleManager();
  return bleManagerInstance;
}

/**
 * Get the BLE manager instance (synchronous, may return null if not initialized)
 */
export function getBleManager(): BleManager | null {
  return bleManagerInstance;
}

/**
 * Check if Bluetooth is available and enabled
 */
async function checkBluetoothState(): Promise<{ available: boolean; state: State }> {
  const manager = await getBleManagerAsync();
  if (!manager) {
    return { available: false, state: State.Unsupported };
  }
  const state = await manager.state();
  return {
    available: state === State.PoweredOn,
    state,
  };
}

/**
 * Request Bluetooth permissions (iOS handles this automatically with first scan/advertise)
 */
export async function requestBluetoothPermissions(): Promise<{ granted: boolean; message?: string }> {
  if (Platform.OS === 'ios') {
    // iOS permissions are handled automatically when starting scan/advertise
    // Just check if BLE is available
    const { available, state } = await checkBluetoothState();
    if (!available) {
      if (state === State.PoweredOff) {
        return { granted: false, message: 'Bluetooth is turned off. Please enable Bluetooth.' };
      }
      if (state === State.Unauthorized) {
        return { granted: false, message: 'Bluetooth permission denied. Please enable in Settings.' };
      }
      if (state === State.Unsupported) {
        return { granted: false, message: 'Bluetooth is not supported on this device.' };
      }
      return { granted: false, message: `Bluetooth unavailable: ${state}` };
    }
    return { granted: true };
  }

  return { granted: false, message: 'Platform not supported.' };
}

/**
 * Wait for Bluetooth to be powered on
 */
export async function waitForBluetoothReady(timeoutMs: number = EXCHANGE_TIMEOUT.MEDIUM_MS): Promise<boolean> {
  const manager = await getBleManagerAsync();
  if (!manager) {
    return false;
  }

  return new Promise((resolve) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription.remove();
        resolve(false);
      }
    }, timeoutMs);

    const subscription = manager.onStateChange((state: State) => {
      if (state === State.PoweredOn && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        subscription.remove();
        resolve(true);
      }
    }, true);
  });
}

/**
 * Decode manufacturer-specific data from advertisement
 */
export function decodeAdvertisementData(data: Uint8Array): BLEAdvertisementData | null {
  if (data.length < 13) {
    console.warn('[BLE] Advertisement data too short:', data.length);
    return null;
  }

  try {
    // userId (first 8 chars)
    const userIdBytes = data.slice(0, 8);
    const userId = new TextDecoder().decode(userIdBytes).replace(/\0/g, '');

    // sharingCategory (1 char)
    const sharingCategory = String.fromCharCode(data[8]) as 'P' | 'W';
    if (sharingCategory !== 'P' && sharingCategory !== 'W') {
      console.warn('[BLE] Invalid sharing category:', sharingCategory);
      return null;
    }

    // buttonPressTimestamp (4 bytes, little-endian)
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const buttonPressTimestamp = view.getUint32(9, true);

    return {
      userId,
      sharingCategory,
      buttonPressTimestamp,
    };
  } catch (error) {
    console.error('[BLE] Failed to decode advertisement data:', error);
    return null;
  }
}

/**
 * Start scanning for nearby Nektus devices
 */
export async function startScanning(
  onDeviceDiscovered: (device: Device, advertisementData: BLEAdvertisementData | null) => void,
  onError?: (error: BleError | Error) => void
): Promise<{ stop: () => void }> {
  const manager = await getBleManagerAsync();
  if (!manager) {
    console.warn('[BLE] BLE manager not available');
    onError?.(new Error('BLE not available'));
    return { stop: () => {} };
  }

  let stopped = false;

  console.log('[BLE] Starting scan for Nektus devices...');

  // Scan timeout
  const scanTimeout = setTimeout(() => {
    if (!stopped) {
      console.log('[BLE] Scan timeout reached');
      manager.stopDeviceScan();
    }
  }, SCAN_TIMEOUT_MS);

  manager.startDeviceScan(
    [NEKTUS_SERVICE_UUID],
    { allowDuplicates: false },
    (error: BleError | null, device: Device | null) => {
      if (stopped) return;

      if (error) {
        console.error('[BLE] Scan error:', error);
        onError?.(error);
        return;
      }

      if (device) {
        console.log(`[BLE] Discovered device: ${device.id} (${device.name || 'unnamed'})`);

        // Try to extract advertisement data from manufacturer data
        let advertisementData: BLEAdvertisementData | null = null;
        if (device.manufacturerData) {
          try {
            const data = base64Decode(device.manufacturerData);
            advertisementData = decodeAdvertisementData(data);
          } catch (e) {
            console.warn('[BLE] Failed to parse manufacturer data:', e);
          }
        }

        onDeviceDiscovered(device, advertisementData);
      }
    }
  );

  return {
    stop: () => {
      if (!stopped) {
        stopped = true;
        clearTimeout(scanTimeout);
        manager.stopDeviceScan();
        console.log('[BLE] Scan stopped');
      }
    },
  };
}

/**
 * Connect to a discovered device
 */
export async function connectToDevice(
  device: Device,
  timeoutMs: number = CONNECTION_TIMEOUT_MS
): Promise<Device> {
  console.log(`[BLE] Connecting to device: ${device.id}`);

  const connectedDevice = await Promise.race([
    device.connect({ requestMTU: 512 }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
    ),
  ]);

  console.log(`[BLE] Connected to device: ${device.id}`);

  // Discover services and characteristics
  await connectedDevice.discoverAllServicesAndCharacteristics();
  console.log(`[BLE] Discovered services for device: ${device.id}`);

  return connectedDevice;
}

/**
 * Disconnect from a device
 */
export async function disconnectDevice(device: Device): Promise<void> {
  try {
    const isConnected = await device.isConnected();
    if (isConnected) {
      await device.cancelConnection();
      console.log(`[BLE] Disconnected from device: ${device.id}`);
    }
  } catch (error) {
    console.warn(`[BLE] Error disconnecting from device:`, error);
  }
}

/**
 * Chunk data for BLE transmission
 */
function chunkData(data: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += MAX_CHUNK_SIZE) {
    chunks.push(data.slice(i, i + MAX_CHUNK_SIZE));
  }
  return chunks;
}

/**
 * Write profile data to a connected device (as Central)
 * Uses chunking for large payloads
 */
export async function writeProfileToDevice(
  device: Device,
  profile: BLEProfilePayload
): Promise<void> {
  const jsonData = JSON.stringify(profile);
  const chunks = chunkData(jsonData);

  console.log(`[BLE] Writing profile data (${jsonData.length} bytes, ${chunks.length} chunks)`);

  // Write header with total chunks
  const header = JSON.stringify({ totalChunks: chunks.length, version: 1 });
  await device.writeCharacteristicWithResponseForService(
    NEKTUS_SERVICE_UUID,
    NEKTUS_METADATA_CHAR_UUID,
    base64Encode(header)
  );

  // Write each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunkPayload = JSON.stringify({ index: i, data: chunks[i] });
    await device.writeCharacteristicWithResponseForService(
      NEKTUS_SERVICE_UUID,
      NEKTUS_PROFILE_CHAR_UUID,
      base64Encode(chunkPayload)
    );
    console.log(`[BLE] Wrote chunk ${i + 1}/${chunks.length}`);
  }

  console.log('[BLE] Profile data written successfully');
}

/**
 * Read profile data from a connected device (as Central)
 * Handles chunked data reassembly
 */
export async function readProfileFromDevice(
  device: Device
): Promise<BLEProfilePayload | null> {
  console.log('[BLE] Reading profile data from device...');

  try {
    // Read metadata first to get chunk count
    const metadataChar = await device.readCharacteristicForService(
      NEKTUS_SERVICE_UUID,
      NEKTUS_METADATA_CHAR_UUID
    );

    if (!metadataChar.value) {
      console.error('[BLE] No metadata received');
      return null;
    }

    const metadataBytes = base64Decode(metadataChar.value);
    const metadataJson = new TextDecoder().decode(metadataBytes);
    const metadata = JSON.parse(metadataJson) as { totalChunks: number; version: number };

    console.log(`[BLE] Expecting ${metadata.totalChunks} chunks`);

    // Read all chunks
    const chunks: string[] = new Array(metadata.totalChunks);

    // Subscribe to profile characteristic for chunks
    // Note: In a real implementation, we'd use notifications for efficiency
    // For simplicity, we'll poll/read repeatedly
    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkChar = await device.readCharacteristicForService(
        NEKTUS_SERVICE_UUID,
        NEKTUS_PROFILE_CHAR_UUID
      );

      if (!chunkChar.value) {
        console.error(`[BLE] Missing chunk ${i}`);
        return null;
      }

      const chunkBytes = base64Decode(chunkChar.value);
      const chunkJson = new TextDecoder().decode(chunkBytes);
      const chunk = JSON.parse(chunkJson) as { index: number; data: string };
      chunks[chunk.index] = chunk.data;
      console.log(`[BLE] Read chunk ${chunk.index + 1}/${metadata.totalChunks}`);
    }

    // Reassemble
    const fullJson = chunks.join('');
    const profile = JSON.parse(fullJson) as BLEProfilePayload;

    console.log('[BLE] Profile data read successfully');
    return profile;
  } catch (error) {
    console.error('[BLE] Failed to read profile data:', error);
    return null;
  }
}

/**
 * Monitor connection state for a device
 */
export function monitorConnectionState(
  device: Device,
  onDisconnect: () => void
): { cancel: () => void } {
  const subscription = device.onDisconnected((error: BleError | null, disconnectedDevice: Device | null) => {
    console.log(`[BLE] Device disconnected: ${disconnectedDevice?.id}`, error?.message || '');
    onDisconnect();
  });

  return {
    cancel: () => subscription.remove(),
  };
}

/**
 * Get seconds since midnight UTC (for role determination timestamp)
 */
export function getSecondsSinceMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - midnight.getTime()) / 1000);
}

/**
 * Generate a BLE match token
 */
export function generateBLEMatchToken(): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `ble-${Date.now()}-${randomPart}`;
}
