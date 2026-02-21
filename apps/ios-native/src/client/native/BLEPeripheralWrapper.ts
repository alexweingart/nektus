/**
 * JavaScript wrapper for BLEPeripheral native module
 *
 * Provides React Native access to CBPeripheralManager for
 * BLE advertising and GATT server functionality.
 */

import { NativeModules, NativeEventEmitter, Platform } from "react-native";

const { BLEPeripheral } = NativeModules;

let emitter: NativeEventEmitter | null = null;

function getEmitter(): NativeEventEmitter | null {
  if (!BLEPeripheral) return null;
  if (!emitter) {
    emitter = new NativeEventEmitter(BLEPeripheral);
  }
  return emitter;
}

/**
 * Start BLE peripheral advertising with Nektus service UUID.
 */
export function startAdvertising(
  userId: string,
  sharingCategory: "P" | "W",
  buttonPressTimestamp: number
): void {
  if (Platform.OS !== "ios" || !BLEPeripheral) {
    console.warn("[BLEPeripheralWrapper] Not available");
    return;
  }
  BLEPeripheral.startAdvertising(userId, sharingCategory, buttonPressTimestamp);
}

/**
 * Stop BLE peripheral advertising.
 */
export function stopAdvertising(): void {
  if (Platform.OS !== "ios" || !BLEPeripheral) return;
  BLEPeripheral.stopAdvertising();
}

/**
 * Set profile data for GATT read requests from connecting centrals.
 */
export function setProfileData(profileJson: string): void {
  if (Platform.OS !== "ios" || !BLEPeripheral) return;
  BLEPeripheral.setProfileData(profileJson);
}

/**
 * Set up the GATT server with profile + metadata characteristics.
 */
export function setupGATTServer(): void {
  if (Platform.OS !== "ios" || !BLEPeripheral) return;
  BLEPeripheral.setupGATTServer();
}

/**
 * Listen for write events from connecting centrals (responder receives initiator's profile).
 * Returns an unsubscribe function.
 */
export function onWriteReceived(
  callback: (data: { data: string; centralId: string }) => void
): () => void {
  const em = getEmitter();
  if (!em) return () => {};

  const subscription = em.addListener("BLEPeripheralWriteReceived", callback);
  return () => subscription.remove();
}
