/**
 * Client-Server Clock Synchronization Utility
 * 
 * This utility implements a simple NTP-style clock sync to normalize
 * timestamps between client and server, eliminating device clock skew
 * that causes timestamp mismatches in bump detection.
 */

interface ClockSyncData {
  clockOffset: number;     // Calculated offset between client and server clocks
  clientT0: number;        // Client performance.now() when sync was performed
  roundTripTime: number;   // Measured RTT for diagnostics
  syncAccuracy: number;    // Estimated accuracy of the sync (half of RTT)
}

let clockSyncData: ClockSyncData | null = null;

/**
 * Perform clock synchronization with the server
 */
async function performSingleSync(): Promise<{ offset: number; rtt: number } | null> {
  try {
    // Record client timestamp when request is sent
    const t0 = performance.now();
    
    const response = await fetch('/api/system/sync-clock', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Record client timestamp when response is received
    const clientReceiveTime = Date.now();
    const t1 = performance.now();
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const serverTime = data.serverTime;
    const roundTripTime = t1 - t0;
    
    // Calculate clock offset using NTP algorithm
    // Assume network delay is symmetric (half RTT each way)
    const networkDelay = roundTripTime / 2;
    const estimatedServerTimeWhenReceived = serverTime + networkDelay;
    const clockOffset = estimatedServerTimeWhenReceived - clientReceiveTime;
    
    return { offset: clockOffset, rtt: roundTripTime };
  } catch {
    return null;
  }
}

export async function initializeClockSync(): Promise<boolean> {
  try {
    console.log('⏰ Starting clock synchronization...');
    
    // Perform multiple sync attempts and use the one with lowest RTT
    const syncAttempts = [];
    for (let i = 0; i < 3; i++) {
      const result = await performSingleSync();
      if (result) {
        syncAttempts.push(result);
      }
      // Small delay between attempts
      if (i < 2) await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (syncAttempts.length === 0) {
      console.error('Clock sync failed: no successful attempts');
      return false;
    }
    
    // Use the sync with the lowest RTT (most accurate)
    const bestSync = syncAttempts.reduce((best, current) => 
      current.rtt < best.rtt ? current : best
    );
    
    clockSyncData = {
      clockOffset: bestSync.offset,
      clientT0: performance.now(),
      roundTripTime: bestSync.rtt,
      syncAccuracy: bestSync.rtt / 2
    };

    console.log(`⏰ Clock sync completed: offset=${bestSync.offset}ms, RTT=${bestSync.rtt}ms, accuracy=±${bestSync.rtt/2}ms (${syncAttempts.length} attempts)`);
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

  // Apply the calculated clock offset to current local time
  const serverNow = Date.now() + clockSyncData.clockOffset;
  
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

