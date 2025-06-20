/**
 * Client-side service for managing contact exchange flow
 */

import { MotionDetector } from '@/lib/utils/motionDetector';
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

export class ContactExchangeService {
  private sessionId: string;
  private state: ContactExchangeState;
  private onStateChange?: (state: ContactExchangeState) => void;

  constructor(onStateChange?: (state: ContactExchangeState) => void) {
    this.sessionId = generateSessionId();
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
   * Start the contact exchange process
   */
  async startExchange(): Promise<void> {
    try {
      this.updateState({ status: 'requesting-permission', sessionId: this.sessionId });

      // Request motion permission first (iOS)
      const hasPermission = await this.requestMotionPermission();
      
      // WebSocket connection completely disabled for testing
      // Using simulated exchange flow instead
      console.log('Starting simulated exchange flow...');
      
      // Start listening for motion
      this.updateState({ status: 'waiting-for-bump' });
      await this.waitForBump(hasPermission);

    } catch (error) {
      console.error('Exchange failed:', error);
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
    this.sessionId = generateSessionId();
    this.updateState({ status: 'idle' });
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    // WebSocket connection fully disabled - no cleanup needed
    console.log('Disconnecting exchange service (no-op in simulation mode)');
  }

  private async requestMotionPermission(): Promise<boolean> {
    // For now, assume permission is granted
    // The actual motion detection will handle permission requests
    return true;
  }

  private async waitForBump(hasPermission: boolean): Promise<void> {
    try {
      console.log('🔍 Starting motion detection...');
      
      // Detect motion/bump
      const motionResult = await MotionDetector.detectMotion();
      console.log('🎯 Motion detection result:', motionResult);
      
      // In simulation mode, skip the server call entirely
      this.updateState({ status: 'processing' });
      console.log('🎭 Simulation mode: Skipping server call, going directly to match simulation...');

      // For testing purposes, simulate a match after a short delay
      // In production, this would be handled by WebSocket notifications
      console.log('⏱️ Starting 2-second simulation timer...');
      setTimeout(() => {
        console.log('🎉 Simulation timer fired, calling simulateMatch()...');
        this.simulateMatch();
      }, 2000);

    } catch (error) {
      console.error('❌ Error in waitForBump:', error);
      throw new Error('Failed to detect motion or send hit');
    }
  }

  private simulateMatch(): void {
    console.log('🎭 simulateMatch() called - creating mock profile...');
    
    // Simulate receiving a match notification
    const mockProfile = {
      userId: 'mock-user-123',
      name: 'John Doe',
      bio: 'Software Engineer passionate about technology and innovation.',
      profileImage: '',
      backgroundImage: '',
      lastUpdated: Date.now(),
      contactChannels: {
        phoneInfo: {
          internationalPhone: '+1234567890',
          nationalPhone: '(123) 456-7890',
          userConfirmed: true
        },
        email: {
          email: 'john.doe@example.com',
          userConfirmed: true
        },
        facebook: { username: '', url: '', userConfirmed: false },
        instagram: { username: 'johndoe', url: 'https://instagram.com/johndoe', userConfirmed: true },
        x: { username: 'john_doe', url: 'https://x.com/john_doe', userConfirmed: true },
        linkedin: { username: 'johndoe', url: 'https://linkedin.com/in/johndoe', userConfirmed: true },
        snapchat: { username: '', url: '', userConfirmed: false },
        whatsapp: { username: '', url: '', userConfirmed: false },
        telegram: { username: '', url: '', userConfirmed: false },
        wechat: { username: '', url: '', userConfirmed: false }
      }
    };

    console.log('🎯 Updating state to matched with profile:', mockProfile.name);

    this.updateState({
      status: 'matched',
      match: {
        token: 'mock-token-123',
        youAre: 'A',
        profile: mockProfile
      }
    });
    
    console.log('✅ State updated - should trigger navigation to /connect');
  }

  private async sendHit(request: ContactExchangeRequest): Promise<void> {
    try {
      console.log('📡 Making request to /api/exchange/hit with:', request);
      
      const response = await fetch('/api/exchange/hit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📡 Server error response:', errorText);
        throw new Error(`Failed to send exchange request: ${response.status} ${errorText}`);
      }

      const result: ContactExchangeResponse = await response.json();
      console.log('📡 Server response data:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Exchange request failed');
      }
      
      console.log('✅ Hit sent successfully');
    } catch (error) {
      console.error('❌ Error in sendHit:', error);
      throw error;
    }
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

  private updateState(updates: Partial<ContactExchangeState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }
}
