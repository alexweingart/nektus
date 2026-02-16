/**
 * Session handoff between App Clip and Full App
 *
 * This module handles storing and retrieving session data
 * to enable seamless transition from App Clip to full app.
 *
 * Uses shared Keychain/App Group for cross-app data sharing.
 */

import * as SecureStore from "expo-secure-store";
import { CACHE_TTL } from "@nektus/shared-client";

const SESSION_KEY = "nekt_session_handoff";

// Extended options type for iOS keychain access group sharing (App Clip <-> Full App)
// expo-secure-store doesn't expose this in types but it works at runtime on iOS
interface SecureStoreOptionsWithAccessGroup extends SecureStore.SecureStoreOptions {
  keychainAccessGroup?: string;
}

// Lazy-load isClip to handle when native module isn't available (dev client/simulator)
let isClipFn: (() => boolean) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const appClip = require("react-native-app-clip");
  isClipFn = appClip.isClip;
} catch {
  // Native module not available (dev client without App Clip support)
  console.log("[session-handoff] react-native-app-clip not available, assuming full app");
}

function isClip(): boolean {
  return isClipFn?.() ?? false;
}

// App Group for shared access between App Clip and full app
// Must match the groupIdentifier in app.json
const APP_GROUP = "group.com.nektus.app";

/**
 * Session data structure for handoff
 */
export interface HandoffSession {
  firebaseToken: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  phone: string | null;
  timestamp: number;
}

/**
 * Store session for handoff to full app
 *
 * Called from App Clip after successful Sign in with Apple.
 * The full app will retrieve this on first launch.
 */
export async function storeSessionForHandoff(
  session: Omit<HandoffSession, "timestamp">
): Promise<void> {
  const data: HandoffSession = {
    ...session,
    timestamp: Date.now(),
  };

  console.log("[session-handoff] Storing session for handoff, userId:", session.userId);

  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data), {
      keychainAccessGroup: APP_GROUP,
    } as SecureStoreOptionsWithAccessGroup);
    console.log("[session-handoff] Session stored successfully");
  } catch (error) {
    console.error("[session-handoff] Failed to store session:", error);
    throw error;
  }
}

/**
 * Retrieve handoff session
 *
 * Called by full app on first launch to check for a session
 * from the App Clip.
 *
 * Returns null if:
 * - No handoff session exists
 * - Session has expired (older than 1 hour)
 * - Running in App Clip (only retrieve in full app)
 */
export async function retrieveHandoffSession(): Promise<HandoffSession | null> {
  // Only retrieve in main app, not App Clip
  if (isClip()) {
    console.log("[session-handoff] Running in App Clip, skipping retrieval");
    return null;
  }

  try {
    const data = await SecureStore.getItemAsync(SESSION_KEY, {
      keychainAccessGroup: APP_GROUP,
    } as SecureStoreOptionsWithAccessGroup);

    if (!data) {
      console.log("[session-handoff] No handoff session found");
      return null;
    }

    const session: HandoffSession = JSON.parse(data);

    // Check if session is still valid (within 1 hour)
    if (Date.now() - session.timestamp > CACHE_TTL.LONG_MS) {
      console.log("[session-handoff] Handoff session expired");
      await clearHandoffSession();
      return null;
    }

    console.log("[session-handoff] Retrieved handoff session, userId:", session.userId);
    return session;
  } catch (error) {
    console.error("[session-handoff] Failed to retrieve session:", error);
    return null;
  }
}

/**
 * Clear handoff session
 *
 * Called after successful migration to full app to clean up
 * the temporary handoff data.
 */
export async function clearHandoffSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY, {
      keychainAccessGroup: APP_GROUP,
    } as SecureStoreOptionsWithAccessGroup);
    console.log("[session-handoff] Handoff session cleared");
  } catch (error) {
    console.error("[session-handoff] Failed to clear session:", error);
  }
}

/**
 * Check if we're running in an App Clip
 */
export function isAppClip(): boolean {
  return isClip();
}

/**
 * Check if we're running in the full app
 */
export function isFullApp(): boolean {
  return !isClip();
}
