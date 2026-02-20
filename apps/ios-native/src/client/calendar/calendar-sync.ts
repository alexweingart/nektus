/**
 * JS wrapper for CalendarSyncModule (native Swift module).
 *
 * Provides typed API for configuring background sync, triggering
 * immediate syncs, and managing the EKEventStoreChanged listener.
 */

import { NativeModules } from 'react-native';

const CalendarSync = NativeModules.CalendarSync as {
  configure: (userId: string, idToken: string, apiBaseUrl: string) => void;
  scheduleBackgroundSync: () => void;
  syncNow: () => Promise<{ synced: number }>;
  startListening: () => void;
  stopListening: () => void;
} | undefined;

/**
 * Configure the native module with credentials for background sync.
 * Call on auth state change and periodically to refresh the stored ID token.
 */
export function configureCalendarSync(userId: string, idToken: string, apiBaseUrl: string) {
  CalendarSync?.configure(userId, idToken, apiBaseUrl);
}

/**
 * Trigger an immediate sync: reads EventKit busy times and uploads to server.
 * Returns the number of busy time slots synced, or null if module unavailable.
 */
export async function syncDeviceBusyTimesNow(): Promise<number | null> {
  if (!CalendarSync) return null;
  try {
    const result = await CalendarSync.syncNow();
    return result.synced;
  } catch (error) {
    console.warn('[CalendarSync] Sync failed:', error);
    return null;
  }
}

/**
 * Start listening for EKEventStoreChanged notifications.
 * When a calendar change is detected, the native module auto-syncs.
 */
export function startCalendarChangeListener() {
  CalendarSync?.startListening();
}

/**
 * Stop listening for calendar changes.
 */
export function stopCalendarChangeListener() {
  CalendarSync?.stopListening();
}

/**
 * Schedule periodic background sync via BGAppRefreshTask.
 * iOS controls the actual frequency (~30 min for active apps, longer for inactive).
 */
export function scheduleBackgroundCalendarSync() {
  CalendarSync?.scheduleBackgroundSync();
}
