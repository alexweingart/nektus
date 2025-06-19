/**
 * Real-time contact exchange service using Server-Sent Events
 * Replaces the simulated exchange with real server communication
 */

import { MotionDetector } from '@/lib/utils/motionDetector';
import type { 
  ContactExchangeRequest, 
  ContactExchangeResponse,
  ContactExchangeState,
  ExchangeStatus,
  SavedContact,
  ContactExchangeMessage
} from '@/types/contactExchange';
import type { UserProfile } from '@/types/profile';

// Generate a unique session ID
function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export { generateSessionId };

export class RealTimeContactExchangeService {
  private eventSource: EventSource | null = null;
  private sessionId: string;
  private state: ContactExchangeState;
  private onStateChange?: (state: ContactExchangeState) => void;
  private motionDetectionCancelled: boolean = false;

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
   * Start the contact exchange process with real-time communication
   */
  async startExchange(permissionAlreadyGranted: boolean = false): Promise<void> {
    try {
      console.log('🚀 Starting exchange process...');
      
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

      // Establish real-time connection
      console.log('🔗 Connecting to event stream...');
      await this.logToServer('event_stream_connecting', 'Connecting to SSE');
      await this.connectToEventStream();
      await this.logToServer('event_stream_connected', 'SSE connection established');
      
      // Start listening for motion (but don't send hit yet)
      this.updateState({ status: 'waiting-for-bump' });
      console.log('✅ Ready for motion detection - waiting for bump...');
      await this.logToServer('waiting_for_bump', 'Now waiting for motion detection');
      
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
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
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

  private async connectToEventStream(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const eventSourceUrl = `/api/exchange/events?session=${this.sessionId}`;
        this.eventSource = new EventSource(eventSourceUrl);

        this.eventSource.onopen = () => {
          console.log('Real-time connection established');
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const message: ContactExchangeMessage = JSON.parse(event.data);
            this.handleServerMessage(message);
          } catch (error) {
            console.error('Failed to parse server message:', error);
          }
        };

        this.eventSource.onerror = (error) => {
          console.error('EventSource error:', error);
          this.eventSource?.close();
          this.eventSource = null;
          reject(new Error('Failed to establish real-time connection'));
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleServerMessage(message: ContactExchangeMessage): void {
    console.log('Received server message:', message);

    switch (message.type) {
      case 'connected':
        console.log('Server connection confirmed');
        break;
        
      case 'match':
        // We got a match! Load the matched user's profile
        this.handleMatch(message.token, message.youAre);
        break;
        
      case 'accept':
        if (message.profile) {
          this.updateState({
            status: 'matched',
            match: {
              token: '', // Will be updated when we have the token
              youAre: 'A',
              profile: message.profile
            }
          });
        }
        break;
        
      case 'reject':
        this.updateState({ status: 'rejected' });
        break;
        
      case 'timeout':
        this.updateState({ status: 'timeout' });
        break;
        
      case 'error':
        this.updateState({ 
          status: 'error', 
          error: message.message || 'Server error' 
        });
        break;
        
      default:
        console.warn('Unknown message type:', message);
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
        
        // Prepare exchange request - use the timestamp from when motion was actually detected
        const request: ContactExchangeRequest = {
          ts: motionResult.timestamp || Date.now(), // Use motion detection timestamp, fallback to now
          mag: motionResult.magnitude,
          session: this.sessionId
        };

        // Add vector hash if motion was detected
        if (motionResult.acceleration) {
          request.vector = await MotionDetector.hashAcceleration(motionResult.acceleration);
        }

        // Add RTT estimate
        request.rtt = await this.estimateRTT();

        // Send hit to server (only now, after motion is detected)
        this.updateState({ status: 'processing' });
        const response = await this.sendHit(request);

        // If we got an immediate match, handle it
        if (response.matched && response.token) {
          await this.handleMatch(response.token, response.youAre || 'A');
        }
        // Otherwise, wait for real-time notification via EventSource
        
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
        const { ProfileService } = await import('@/lib/firebase/profileService');
        await ProfileService.saveContact(session.user.email, contact);
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
    // Simple RTT estimation
    const start = Date.now();
    
    try {
      await fetch('/api/ping', { method: 'HEAD' });
      return Date.now() - start;
    } catch {
      return 100; // Default fallback
    }
  }

  private async logToServer(event: string, message: string): Promise<void> {
    try {
      await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event, 
          message, 
          sessionId: this.sessionId,
          timestamp: Date.now() 
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
