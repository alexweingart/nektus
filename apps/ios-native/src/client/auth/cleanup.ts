/**
 * Account cleanup utilities for iOS
 *
 * Clears all local storage when deleting an account,
 * matching the web's comprehensive cleanup approach.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Known AsyncStorage keys used in the app
const ASYNC_STORAGE_KEYS = [
  "nekt-sharing-category",
  "returning-to-history",
  "returning-to-profile",
  "contact-background-url",
  "google_contacts_upsell_dismissed",
  "google_contacts_first_save_completed",
  "google_contacts_permission_granted",
  "google_incremental_auth_state",
];

// Prefixes for dynamic keys
const ASYNC_STORAGE_PREFIXES = [
  "exchange_state_",
  "google_incremental_tokens_",
];

// SecureStore keys
const SECURE_STORE_KEYS = [
  "nekt_session_handoff",
  "apple_refresh_token", // For future Apple token revocation
];

// App Group for shared keychain access
const APP_GROUP = "group.com.nektus.app";

/**
 * Clear all AsyncStorage data
 */
async function clearAsyncStorage(): Promise<void> {
  try {
    // Get all keys to find any dynamic keys we might have missed
    const allKeys = await AsyncStorage.getAllKeys();
    console.log("[cleanup] Found AsyncStorage keys:", allKeys);

    // Clear all known keys
    const keysToRemove = [...ASYNC_STORAGE_KEYS];

    // Add any keys matching our prefixes
    for (const key of allKeys) {
      for (const prefix of ASYNC_STORAGE_PREFIXES) {
        if (key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
    }

    // Remove duplicates
    const uniqueKeys = [...new Set(keysToRemove)];

    if (uniqueKeys.length > 0) {
      await AsyncStorage.multiRemove(uniqueKeys);
      console.log("[cleanup] Removed AsyncStorage keys:", uniqueKeys);
    }

    // Also clear any remaining keys (belt and suspenders)
    if (allKeys.length > 0) {
      await AsyncStorage.clear();
      console.log("[cleanup] AsyncStorage cleared completely");
    }
  } catch (error) {
    console.error("[cleanup] Error clearing AsyncStorage:", error);
  }
}

/**
 * Clear all SecureStore data
 */
async function clearSecureStore(): Promise<void> {
  for (const key of SECURE_STORE_KEYS) {
    try {
      // Try without app group first (regular secure store)
      await SecureStore.deleteItemAsync(key);
      console.log(`[cleanup] Removed SecureStore key: ${key}`);
    } catch (error) {
      // Ignore errors for keys that don't exist
      console.log(`[cleanup] SecureStore key ${key} not found or error:`, error);
    }

    try {
      // Also try with app group (shared keychain)
      // Note: keychainAccessGroup is an iOS-specific option that may not be in TS types
      await SecureStore.deleteItemAsync(key, {
        keychainAccessGroup: APP_GROUP,
      } as SecureStore.SecureStoreOptions);
      console.log(`[cleanup] Removed SecureStore key with app group: ${key}`);
    } catch (error) {
      // Ignore errors for keys that don't exist
      console.log(`[cleanup] SecureStore key ${key} (app group) not found or error:`, error);
    }
  }
}

/**
 * Clear all local storage for account deletion
 *
 * This should be called when deleting an account to ensure
 * no user data remains on the device.
 */
export async function clearAllLocalStorage(): Promise<void> {
  console.log("[cleanup] Starting full local storage cleanup...");

  // Clear AsyncStorage
  await clearAsyncStorage();

  // Clear SecureStore
  await clearSecureStore();

  console.log("[cleanup] Local storage cleanup complete");
}

/**
 * Store Apple refresh token for later revocation
 * Called after successful Apple Sign-in token exchange
 */
export async function storeAppleRefreshToken(
  userId: string,
  refreshToken: string
): Promise<void> {
  try {
    const key = `apple_refresh_token_${userId}`;
    await SecureStore.setItemAsync(key, refreshToken);
    console.log("[cleanup] Stored Apple refresh token for user:", userId);
  } catch (error) {
    console.error("[cleanup] Failed to store Apple refresh token:", error);
  }
}

/**
 * Get Apple refresh token for revocation
 */
export async function getAppleRefreshToken(
  userId: string
): Promise<string | null> {
  try {
    const key = `apple_refresh_token_${userId}`;
    const token = await SecureStore.getItemAsync(key);
    return token;
  } catch (error) {
    console.error("[cleanup] Failed to get Apple refresh token:", error);
    return null;
  }
}

/**
 * Delete Apple refresh token after revocation
 */
export async function deleteAppleRefreshToken(userId: string): Promise<void> {
  try {
    const key = `apple_refresh_token_${userId}`;
    await SecureStore.deleteItemAsync(key);
    console.log("[cleanup] Deleted Apple refresh token for user:", userId);
  } catch (error) {
    console.error("[cleanup] Failed to delete Apple refresh token:", error);
  }
}

export default {
  clearAllLocalStorage,
  storeAppleRefreshToken,
  getAppleRefreshToken,
  deleteAppleRefreshToken,
};
