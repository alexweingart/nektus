import { UserProfile } from '@/types/profile';
import { ProfileService } from './profileService';

/**
 * SyncManager handles offline/online synchronization of profile data.
 * Firebase Firestore has built-in offline persistence, so this is now a lightweight
 * wrapper around Firebase's capabilities.
 */
class SyncManager {
  private static instance: SyncManager;
  private isOnline = typeof window !== 'undefined' ? navigator.onLine : true;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private handleOnline = () => {
    this.isOnline = true;
    // Firebase will automatically handle reconnection and sync
  };

  private handleOffline = () => {
    this.isOnline = false;
  };

  /**
   * Saves the profile to Firestore with offline persistence
   */
  public async saveProfile(profile: UserProfile): Promise<void> {
    try {
      await ProfileService.saveProfile(profile);
    } catch (error) {
      console.error('Failed to save profile:', error);
      throw error;
    }
  }

  /**
   * Updates a profile in Firestore with offline persistence
   */
  public async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      await ProfileService.updateProfile(userId, updates);
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const syncManager = SyncManager.getInstance();

// For backward compatibility
export const sync = {
  queueUpdate: (profile: UserProfile) => syncManager.saveProfile(profile),
  initializeLastSynced: async () => { /* no-op */ }
};
