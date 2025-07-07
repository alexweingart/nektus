/**
 * Real-time contact exchange service using Server-Sent Events
 * Replaces the simulated exchange with real server communication
 */

import { MotionDetector } from '@/lib/utils/motionDetector';
import { initializeClockSync, isClockSyncInitialized, getServerNow, getClockSyncInfo } from '@/lib/utils/clockSync';
import type { 
  ContactExchangeRequest, 
  ContactExchangeResponse,
  ContactExchangeState,
  SavedContact
} from '@/types/contactExchange';
import type { UserProfile } from '@/types/profile';

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
  private waitingForBumpTimeout: NodeJS.Timeout | null = null;
  private waitingForMatchTimeout: NodeJS.Timeout | null = null;
  private matchPollingInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(sessionId: string, onStateChange?: (state: ContactExchangeState) => void) {
    this.sessionId = sessionId;
    this.state = { status: 'idle' };
    this.onStateChange = onStateChange;
  }

  /**
   * Get current exchange state
   */
  getState(): ContactExchangeState {
    return { ...this.state };
  }

  /**
   * Start the contact exchange process with polling
   */
  async startExchange(permissionAlreadyGranted: boolean = false): Promise<void> {
    try {
      console.log('🚀 Starting exchange process...');
      
      // Initialize clock sync first thing
      if (!isClockSyncInitialized()) {
        console.log('⏰ Initializing clock synchronization...');
        const syncSuccess = await initializeClockSync();
        if (!syncSuccess) {
          console.warn('⚠️ Clock sync failed, using local time (may cause timestamp issues)');
        } else {
          console.log('✅ Clock synchronization initialized');
        }
      } else {
        console.log('✅ Clock sync already initialized');
      }
      
      // Log to server for debugging
      await this.logToServer('exchange_start', `Exchange started, permission already granted: ${permissionAlreadyGranted}`);
      
      this.updateState({ status: 'requesting-permission', sessionId: this.sessionId });

      // Only request motion permission if it wasn't already granted
      if (!permissionAlreadyGranted) {
        console.log('📱 Requesting motion permission...');
        await this.logToServer('permission_request', 'Requesting motion permission from service');
        
        const permissionResult = await this.requestMotionPermission();
        
        await this.logToServer('permission_result', `Service permission result: ${JSON.stringify(permissionResult)}`);
        
        if (!permissionResult.success) {
          await this.logToServer('permission_denied', `Motion permission denied: ${permissionResult.message}`);
          this.updateState({ 
            status: 'error', 
            error: permissionResult.message || 'Motion permission denied. Please allow motion access in browser settings or try again.' 
          });
          return;
        }
      } else {
        console.log('✅ Motion permission already granted, skipping request');
        await this.logToServer('permission_skipped', 'Permission already granted in button handler');
      }

      // Start listening for motion (but don't send hit yet)
      this.updateState({ status: 'waiting-for-bump' });
      console.log('✅ Ready for motion detection - waiting for bump...');
      await this.logToServer('waiting_for_bump', 'Now waiting for motion detection');
      
      // Set 30-second timeout for waiting for bump
      this.waitingForBumpTimeout = setTimeout(() => {
        console.log('⏰ Waiting for bump timed out after 30 seconds');
        this.logToServer('bump_timeout', 'Waiting for bump timed out after 30 seconds');
        this.updateState({ status: 'timeout' });
        this.disconnect();
      }, 30000); // 30 seconds
      
      // Start the motion detection loop
      await this.waitForBump(true);

    } catch (error) {
      console.error('Exchange failed:', error);
      await this.logToServer('exchange_error', `Exchange failed: ${error}`);
      this.updateState({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Exchange failed' 
      });
    }
  }

  /**
   * Accept a matched contact
   */
  async acceptContact(token: string): Promise<SavedContact | null> {
    try {
      const response = await fetch(`/api/exchange/pair/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept: true })
      });

      if (!response.ok) {
        throw new Error('Failed to accept contact');
      }

      const result = await response.json();
      
      if (result.success && result.profile) {
        // Save to Firebase
        const savedContact = await this.saveContact(result.profile, token);
        this.updateState({ status: 'accepted' });
        return savedContact;
      }

      throw new Error(result.message || 'Failed to accept contact');

    } catch (error) {
      console.error('Failed to accept contact:', error);
      this.updateState({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to accept contact' 
      });
      return null;
    }
  }

  /**
   * Reject a matched contact
   */
  async rejectContact(token: string): Promise<void> {
    try {
      await fetch(`/api/exchange/pair/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept: false })
      });

      this.updateState({ status: 'rejected' });

    } catch (error) {
      console.error('Failed to reject contact:', error);
    }
  }

  /**
   * Reset the exchange state
   */
  reset(): void {
    this.disconnect();
    this.updateState({ status: 'idle' });
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    // Clear any active timeouts
    if (this.waitingForBumpTimeout) {
      clearTimeout(this.waitingForBumpTimeout);
      this.waitingForBumpTimeout = null;
    }
    if (this.waitingForMatchTimeout) {
      clearTimeout(this.waitingForMatchTimeout);
      this.waitingForMatchTimeout = null;
    }
    if (this.matchPollingInterval) {
      clearInterval(this.matchPollingInterval);
      this.matchPollingInterval = null;
    }
  }

  private async requestMotionPermission(): Promise<{ success: boolean; message?: string }> {
    // For iOS, this should only be called if permission wasn't already granted in button handler
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      // This should not happen if we're doing it right, but just in case
      console.warn('⚠️ Motion permission being requested again for iOS - this should have been done in button handler');
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        if (permission === 'granted') {
          return { success: true };
        } else {
          return { success: false, message: 'Motion permission denied' };
        }
      } catch (error) {
        console.warn('Permission check failed:', error);
        return { success: false, message: `Permission check failed: ${error}` };
      }
    }
    
    // For non-iOS, use the MotionDetector method
    return await MotionDetector.requestPermission();
  }

  /**
   * Start polling for matches after sending hit
   */
  private async startMatchPolling(): Promise<void> {
    console.log('🔄 Starting match polling...');
    
    // Poll every 1 second for up to 10 seconds
    let pollCount = 0;
    const maxPolls = 10;
    
    this.matchPollingInterval = setInterval(async () => {
      pollCount++;
      console.log(`🔍 Polling for match (attempt ${pollCount}/${maxPolls})...`);
      
      try {
        const response = await fetch(`/api/exchange/status/${this.sessionId}`);
        
        if (!response.ok) {
          throw new Error('Failed to check match status');
        }
        
        const result = await response.json();
        
        if (result.success && result.hasMatch && result.match) {
          // Found a match!
          console.log('🎉 Match found via polling!', result.match);
          
          // Clear polling and timeout
          this.clearPolling();
          
          // Handle the match
          await this.handleMatch(result.match.token, result.match.youAre);
          return;
        }
        
        // No match yet, continue polling unless we've reached max attempts
        if (pollCount >= maxPolls) {
          console.log('⏰ Polling timeout - no match found');
          this.clearPolling();
          this.updateState({ status: 'timeout' });
        }
        
      } catch (error) {
        console.error('Polling error:', error);
        this.clearPolling();
        this.updateState({ 
          status: 'error', 
          error: 'Failed to check for matches' 
        });
      }
    }, 1000); // Poll every 1 second
  }

  /**
   * Clear polling interval and timeout
   */
  private clearPolling(): void {
    if (this.matchPollingInterval) {
      clearInterval(this.matchPollingInterval);
      this.matchPollingInterval = null;
    }
    if (this.waitingForMatchTimeout) {
      clearTimeout(this.waitingForMatchTimeout);
      this.waitingForMatchTimeout = null;
    }
  }

  private async handleMatch(token: string, youAre: 'A' | 'B'): Promise<void> {
    try {
      // Fetch the matched user's profile
      console.log(`🔍 CLIENT: Fetching profile for token: ${token}`);
      const response = await fetch(`/api/exchange/pair/${token}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch matched profile');
      }
      
      const result = await response.json();
      console.log(`📋 CLIENT: Received pair response:`, result);
      
      if (result.success && result.profile) {
        console.log(`👤 CLIENT: Setting matched profile:`, {
          name: result.profile.name,
          userId: result.profile.userId,
          bio: result.profile.bio?.substring(0, 50) + '...'
        });
        this.updateState({
          status: 'matched',
          match: {
            token,
            youAre,
            profile: result.profile
          }
        });
      } else {
        throw new Error('Invalid match response');
      }
      
    } catch (error) {
      console.error('Failed to handle match:', error);
      this.updateState({ 
        status: 'error', 
        error: 'Failed to load matched profile' 
      });
    }
  }

  private async waitForBump(hasPermission: boolean): Promise<void> {
    while (true) { // Keep waiting for motion until user cancels or motion is detected
      try {
        console.log('🔍 Starting motion detection... (no server hit until motion detected)');
        
        // Detect motion/bump - this will wait until actual motion is detected
        const motionResult = await MotionDetector.detectMotion();
        
        if (!motionResult.hasMotion) {
          console.log('⏰ Motion detection timed out - no bump detected, restarting detection...');
          // Don't send hit, don't show error, just restart detection
          continue; // Restart the motion detection loop
        }

        console.log('🎯 Motion detected! Sending hit to server...');
        
        // Clear the waiting for bump timeout since we detected motion
        if (this.waitingForBumpTimeout) {
          clearTimeout(this.waitingForBumpTimeout);
          this.waitingForBumpTimeout = null;
        }
        
        // Prepare exchange request - use the timestamp from when motion was actually detected
        const tSent = performance.now(); // Capture when we're about to send
        const request: ContactExchangeRequest = {
          ts: motionResult.timestamp || getServerNow(), // Use motion detection timestamp (already synchronized)
          mag: motionResult.magnitude,
          session: this.sessionId,
          // Add diagnostic timing fields (for performance analysis)
          tSent: tSent // When we're sending the request
        };

        // Add vector hash if motion was detected
        if (motionResult.acceleration) {
          request.vector = await MotionDetector.hashAcceleration(motionResult.acceleration);
        }

        // Add RTT estimate
        request.rtt = await this.estimateRTT();

        // Send hit to server (only now, after motion is detected)
        this.updateState({ status: 'processing' });
        
        // Set 3-second timeout for waiting for match after sending hit
        this.waitingForMatchTimeout = setTimeout(() => {
          console.log('⏰ Waiting for match timed out after 3 seconds');
          this.logToServer('match_timeout', 'Waiting for match timed out after 3 seconds');
          this.updateState({ status: 'timeout' });
          this.disconnect();
        }, 3000); // 3 seconds
        
        const response = await this.sendHit(request);

        // If we got an immediate match, handle it and clear timeout
        if (response.matched && response.token) {
          if (this.waitingForMatchTimeout) {
            clearTimeout(this.waitingForMatchTimeout);
            this.waitingForMatchTimeout = null;
          }
          await this.handleMatch(response.token, response.youAre || 'A');
        } else {
          // Start polling as fallback in case SSE fails
          await this.logToServer('polling_start', 'Starting polling fallback for match detection');
          this.startMatchPolling();
        }
        // SSE will also notify if available, but polling ensures we don't miss matches
        
        break; // Exit the loop after successful motion detection and hit
        
      } catch (error) {
        console.error('❌ Error in waitForBump:', error);
        this.updateState({ 
          status: 'error', 
          error: 'Motion detection failed - please try again' 
        });
        break; // Exit loop on error
      }
    }
  }

  private async sendHit(request: ContactExchangeRequest): Promise<ContactExchangeResponse> {
    const response = await fetch('/api/exchange/hit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error('Failed to send exchange request');
    }

    const result: ContactExchangeResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Exchange request failed');
    }

    return result;
  }

  private async saveContact(profile: UserProfile, matchToken: string): Promise<SavedContact> {
    const contact: SavedContact = {
      ...profile,
      addedAt: Date.now(),
      matchToken
    };

    try {
      // Get current user session directly
      const response = await fetch('/api/auth/session');
      if (!response.ok) {
        throw new Error('Failed to get session');
      }
      
      const session = await response.json();
      if (!session?.user?.email) {
        throw new Error('User not authenticated');
      }

      // Save to Firebase using dynamic import to avoid server-side bundling issues
      try {
        const { ClientProfileService } = await import('@/lib/firebase/clientProfileService');
        await ClientProfileService.saveContact(session.user.email, contact);
        console.log('Contact saved to Firebase:', contact);
      } catch (firebaseError) {
        console.warn('Failed to save to Firebase, continuing anyway:', firebaseError);
      }
      
      return contact;
    } catch (error) {
      console.error('Failed to save contact to Firebase:', error);
      // Still return the contact object even if Firebase save fails
      return contact;
    }
  }

  private async estimateRTT(): Promise<number> {
    // Use clock sync RTT if available, otherwise measure fresh
    const clockSyncInfo = getClockSyncInfo();
    if (clockSyncInfo?.roundTripTime) {
      console.log(`📊 Using clock sync RTT: ${clockSyncInfo.roundTripTime.toFixed(1)}ms`);
      return clockSyncInfo.roundTripTime;
    }
    
    // Fallback to fresh measurement
    const start = performance.now();
    try {
      await fetch('/api/system/ping', { method: 'HEAD' });
      const rtt = performance.now() - start;
      console.log(`📊 Measured fresh RTT: ${rtt.toFixed(1)}ms`);
      return rtt;
    } catch {
      console.log('📊 RTT measurement failed, using fallback: 100ms');
      return 100; // Default fallback
    }
  }

  private async logToServer(event: string, message: string): Promise<void> {
    try {
      await fetch('/api/system/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event, 
          message, 
          sessionId: this.sessionId,
          timestamp: getServerNow() 
        })
      });
    } catch (error) {
      // Ignore logging errors
      console.warn('Failed to log to server:', error);
    }
  }

  private updateState(updates: Partial<ContactExchangeState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }

}
