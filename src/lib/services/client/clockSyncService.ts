/**
 * Client-Server Clock Synchronization Utility
 * 
 * This utility implements a simple NTP-style clock sync to normalize
 * timestamps between client and server, eliminating device clock skew
 * that causes timestamp mismatches in bump detection.
 */

interface ClockSyncData {
  serverTime: number;      // Server timestamp when sync was performed
  clientT0: number;        // Client performance.now() when sync was performed
  roundTripTime?: number;  // Measured RTT for diagnostics
}

let clockSyncData: ClockSyncData | null = null;

/**
 * Perform clock synchronization with the server
 */
export async function initializeClockSync(): Promise<boolean> {
  try {
    const t0 = performance.now();
    
    const response = await fetch('/api/system/sync-clock', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const t1 = performance.now();
    
    if (!response.ok) {
      console.error('Clock sync failed:', response.statusText);
      return false;
    }

    const data = await response.json();
    const roundTripTime = t1 - t0;
    
    clockSyncData = {
      serverTime: data.serverTime,
      clientT0: t0,
      roundTripTime
    };

    return true;
  } catch (error) {
    console.error('Clock sync initialization failed:', error);
    return false;
  }
}

/**
 * Get the current server time based on synchronized clock
 * Falls back to local time if sync hasn't been performed
 */
export function getServerNow(): number {
  if (!clockSyncData) {
    console.warn('Clock sync not initialized, using local time');
    return Date.now();
  }

  const clientElapsed = performance.now() - clockSyncData.clientT0;
  const serverNow = clockSyncData.serverTime + clientElapsed;
  
  return Math.round(serverNow);
}

/**
 * Get diagnostic information about the clock sync
 */
export function getClockSyncInfo(): ClockSyncData | null {
  return clockSyncData;
}

/**
 * Check if clock sync is initialized
 */
export function isClockSyncInitialized(): boolean {
  return clockSyncData !== null;
}

