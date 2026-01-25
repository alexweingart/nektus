/**
 * Real-time contact exchange service using Server-Sent Events
 * Replaces the simulated exchange with real server communication
 */

import type { 
  ContactExchangeRequest, 
  ContactExchangeResponse,
  ContactExchangeState
} from '@/types/contactExchange';

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
  private matchPollingInterval: NodeJS.Timeout | null = null;
  private motionDetector?: typeof import('@/client/contacts/motion').MotionDetector;
  private matchToken: string | null = null;

  constructor(sessionId: string, onStateChange?: (state: ContactExchangeState) => void) {
    this.sessionId = sessionId;
    this.state = { status: 'idle' };
    this.onStateChange = onStateChange;
  }

  /**
   * Get MotionDetector module (caches after first import)
   */
  private async getMotionDetector() {
    if (!this.motionDetector) {
      const motionModule = await import('@/client/contacts/motion');
      this.motionDetector = motionModule.MotionDetector;
    }
    return this.motionDetector;
  }

  /**
   * Get current exchange state
   */
  getState(): ContactExchangeState {
    return { ...this.state };
  }

  /**
   * Get current match token (for QR code display)
   */
  getMatchToken(): string | null {
    return this.matchToken;
  }

  /**
   * Start the contact exchange process with single timeout control
   */
  async startExchange(
    _permissionAlreadyGranted: boolean = false,
    sharingCategory: 'All' | 'Personal' | 'Work' = 'All'
  ): Promise<void> {
    try {
      const msg = `Starting exchange (${sharingCategory}) with session ${this.sessionId}`;
      console.log(`🎯 ${msg}`);

      // Send to debug logs
      fetch('/api/debug/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'exchange_start_method',
          message: msg,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});

      // Note: Old user exchanges are now cleaned up server-side in the /api/exchange/hit endpoint

      // Initialize exchange and get token for QR code display
      const initiateResponse = await fetch('/api/exchange/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          sharingCategory
        })
      });

      if (!initiateResponse.ok) {
        throw new Error('Failed to initiate exchange');
      }

      const { token } = await initiateResponse.json();
      this.matchToken = token;

      // Emit event with token for ProfileView to show QR code
      window.dispatchEvent(new CustomEvent('exchange-initiated', {
        detail: { token }
      }));

      console.log(`🎫 Exchange initiated with token: ${token.substring(0, 8)}...`);

      // Reset cancellation flag and motion state for new exchange
      this.motionDetectionCancelled = false;

      // Send debug log before calling startNewSession
      fetch('/api/debug/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'before_session_start',
          message: `About to call MotionDetector.startNewSession()`,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});

      // Start fresh motion detection session
      const MotionDetector = await this.getMotionDetector();
      MotionDetector.startNewSession(); // Clears any priming state and prepares for detection

      // Send debug log after calling startNewSession
      fetch('/api/debug/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'after_session_start',
          message: `MotionDetector.startNewSession() completed`,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});
      
      
      // Permission is always handled by ExchangeButton - no need to check again
      console.log('✅ Service using permission granted by ExchangeButton');

      // Start listening for motion (but don't send hit yet)
      this.updateState({ status: 'waiting-for-bump' });
      console.log('👂 Waiting for bump (20s timeout)...');

      // Start polling immediately for QR scan matches (not just after motion detected)
      this.startMatchPolling();
      console.log('🔄 Started polling for QR scan matches');

      // Set single 20-second timeout for entire exchange process
      // Will be extended to 60s if QR scan detected (User B signing in)
      this.waitingForBumpTimeout = setTimeout(async () => {
        console.log('⏰ Exchange timed out after 20 seconds');

        // Stop motion detection and polling immediately
        await this.disconnect();

        // Only show timeout if we haven't found a match
        if (this.state.status !== 'matched') {
          console.log('⏰ Showing timeout UI');
          this.updateState({ status: 'timeout' });
        } else {
          console.log('✅ Match found - not showing timeout');
        }
      }, 20000);
      
      // Start the motion detection loop
      await this.waitForBump(true, sharingCategory);

    } catch (error) {
      console.error('Exchange failed:', error);
      this.updateState({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Exchange failed' 
      });
    }
  }



  /**
   * Reset the exchange state
   */
  async reset(): Promise<void> {
    await this.disconnect();
    this.updateState({ status: 'idle' });
  }

  /**
   * Disconnect and cleanup - now includes motion state cleanup
   */
  async disconnect(): Promise<void> {
    // Cancel motion detection
    this.motionDetectionCancelled = true;
    
    // End motion detection session completely
    const MotionDetector = await this.getMotionDetector();
    MotionDetector.endSession(); // This cancels detection AND clears all state
    
    // Clear any active timeouts
    if (this.waitingForBumpTimeout) {
      clearTimeout(this.waitingForBumpTimeout);
      this.waitingForBumpTimeout = null;
    }
    if (this.matchPollingInterval) {
      clearInterval(this.matchPollingInterval);
      this.matchPollingInterval = null;
    }
  }

  private async requestMotionPermission(): Promise<{ success: boolean; message?: string }> {
    // For iOS, check current permission state first to avoid duplicate requests
    if (typeof (DeviceMotionEvent as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
      try {
        // Check current permission state first
        const permission = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        if (permission === 'granted') {
          return { success: true };
        } else {
          return { success: false, message: 'Motion permission denied. Please allow motion access in Safari settings.' };
        }
      } catch (error) {
        console.warn('iOS permission request failed:', error);
        return { success: false, message: `Permission request failed: ${error}` };
      }
    }
    
    // For non-iOS, use the MotionDetector method
    const MotionDetector = await this.getMotionDetector();
    return await MotionDetector.requestPermission();
  }

  /**
   * Start polling for matches after sending hit - no separate timeout
   */
  private async startMatchPolling(): Promise<void> {
    // Don't start polling if already running
    if (this.matchPollingInterval) {
      console.log('🔄 Polling already running, skipping duplicate start');
      return;
    }

    // Poll every 1 second - controlled by main exchange timeout
    this.matchPollingInterval = setInterval(async () => {
              // Check if exchange has been cancelled/timed out
        if (this.motionDetectionCancelled || this.state.status === 'timeout' || this.state.status === 'error') {
          this.clearPolling();
          return;
        }
      
      try {
        const response = await fetch(`/api/exchange/status/${this.sessionId}`);

        if (!response.ok) {
          // Extract actual error from server response
          let serverMessage = 'Unknown error';
          try {
            const errorBody = await response.json();
            serverMessage = errorBody.message || serverMessage;
          } catch {
            // Response wasn't JSON
          }
          throw new Error(`Status check failed (${response.status}): ${serverMessage}`);
        }

        const result = await response.json();

        // Check for QR scan status updates
        if (result.success && result.scanStatus === 'pending_auth') {
          console.log('⏳ QR scanned - User B is signing in...');

          // Extend timeout to 60 seconds to give User B time to complete OAuth
          if (this.waitingForBumpTimeout) {
            clearTimeout(this.waitingForBumpTimeout);
            console.log('⏰ Extending timeout to 60 seconds for OAuth sign-in');
            this.waitingForBumpTimeout = setTimeout(async () => {
              console.log('⏰ Exchange timed out after 60 seconds (QR scan)');
              await this.disconnect();
              if (this.state.status !== 'matched') {
                this.updateState({ status: 'timeout' });
              }
            }, 60000);
          }

          this.updateState({ status: 'qr-scan-pending' });
          // Continue polling for completion
          return;
        }

        if (result.success && result.hasMatch && result.match) {
          console.log('🎉 Match found!');

          // Check if this is a QR scan match
          if (result.scanStatus === 'completed') {
            console.log('📱 QR scan match completed!');

            // Clear timeout - match found!
            if (this.waitingForBumpTimeout) {
              clearTimeout(this.waitingForBumpTimeout);
              this.waitingForBumpTimeout = null;
              console.log('⏰ Cleared timeout - QR scan match found');
            }

            // Clear polling - no need to keep polling
            this.clearPolling();

            this.updateState({ status: 'qr-scan-matched', qrToken: result.match.token });
          } else {
            // Regular bump match
            // Clear polling
            this.clearPolling();

            // Handle the match
            await this.handleMatch(result.match.token, result.match.youAre);
          }
          return;
        }

        // No match yet, continue polling (controlled by main timeout)
        
      } catch (error) {
        console.error('Polling error:', error);
        // Don't stop polling on single error - let main timeout handle it
      }
    }, 1000); // Poll every 1 second
  }

  /**
   * Clear polling interval - no separate timeout to clear
   */
  private clearPolling(): void {
    if (this.matchPollingInterval) {
      clearInterval(this.matchPollingInterval);
      this.matchPollingInterval = null;
    }
  }

  private async handleMatch(token: string, youAre: 'A' | 'B'): Promise<void> {
    try {
      // Clear the main exchange timeout when match is found
      if (this.waitingForBumpTimeout) {
        clearTimeout(this.waitingForBumpTimeout);
        this.waitingForBumpTimeout = null;
      }
      
      // Fetch the matched user's profile
      const response = await fetch(`/api/exchange/pair/${token}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch matched profile');
      }
      
      const result = await response.json();
      
      if (result.success && result.profile) {
        console.log(`👤 Matched with: ${result.profile.name}`);
        this.updateState({
          status: 'matched',
          match: {
            token,
            youAre,
            profile: result.profile
          }
        });
        
        // Clean up the service after match is found to prevent reuse
        await this.disconnect();
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

  private async waitForBump(hasPermission: boolean, sharingCategory: 'All' | 'Personal' | 'Work'): Promise<void> {
    let hitCount = 0;
    let lastHitTime = 0;
    const HIT_COOLDOWN_MS = 500; // 500ms cooldown between hits

    const MotionDetector = await this.getMotionDetector();

    while (!this.motionDetectionCancelled) { // Keep waiting for motion until exchange is cancelled
      try {
        const isFirstHit = hitCount === 0;

        // Detect motion/bump - this will wait until actual motion is detected or cancelled
        const motionResult = await MotionDetector.detectMotion();
        
        if (!motionResult.hasMotion) {
          return; // Cancelled or timed out
        }

        // Rate limiting: ensure minimum time between hits
        const now = Date.now();
        if (!isFirstHit && (now - lastHitTime) < HIT_COOLDOWN_MS) {
          continue; // Skip this hit, continue listening
        }
        
        hitCount++;
        lastHitTime = now;
        
        console.log(`🚀 Hit #${hitCount} detected (mag=${motionResult.magnitude.toFixed(2)}, ts=${motionResult.timestamp || Date.now()})`);
        
        // Prepare exchange request - use the timestamp from when motion was actually detected
        const tSent = performance.now();
        const request: ContactExchangeRequest = {
          ts: motionResult.timestamp || Date.now(), // Use motion detection timestamp or fallback to Date.now()
          mag: motionResult.magnitude,
          session: this.sessionId,
          sharingCategory: sharingCategory, // Include selected sharing category
          // Add diagnostic timing fields (for performance analysis)
          tSent: tSent, // When we're sending the request
          hitNumber: hitCount // Track hit sequence number
        };

        // Add vector hash if motion was detected
        if (motionResult.acceleration) {
          request.vector = await MotionDetector.hashAcceleration(motionResult.acceleration);
        }


        // Send hit to server (only now, after motion is detected)
        if (isFirstHit) {
          console.log(`🚨 iOS: Setting status to processing (first hit detected)`);
          this.updateState({ status: 'processing' });
        }
        
        console.log(`📤 Sending hit #${hitCount} to server (ts=${request.ts})`);
        const response = await this.sendHit(request);

        // If we got an immediate match, handle it
        if (response.matched && response.token) {
          console.log(`🎉 Instant match!`);
          await this.handleMatch(response.token, response.youAre || 'A');
          return; // Exit after successful match
        } else {
          // Start polling as fallback in case SSE fails (only on first hit)
          if (isFirstHit) {
            this.startMatchPolling();
          }
        }
        
        // Continue listening for more motion instead of breaking
        // This allows sequential detection to maintain primed states
        // and enables multiple hits during the 20-second matching window
        
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
      // Extract actual error from server response
      let serverMessage = 'Unknown error';
      try {
        const errorBody = await response.json();
        serverMessage = errorBody.message || serverMessage;
      } catch {
        // Response wasn't JSON
      }
      throw new Error(`Exchange failed (${response.status}): ${serverMessage}`);
    }

    const result: ContactExchangeResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Exchange request failed');
    }

    return result;
  }




  private updateState(updates: Partial<ContactExchangeState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }

}
