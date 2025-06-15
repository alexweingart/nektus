import { db } from './clientConfig';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot,
  FirestoreError
} from 'firebase/firestore';
import { UserProfile } from '@/types/profile';

/**
 * Ensures Firebase is initialized and returns the Firestore instance
 * Returns null if Firebase is not available
 */
async function ensureInitialized() {
  if (typeof window === 'undefined') {
    console.warn('Firebase operations are only available on the client side');
    return null;
  }
  
  if (!db) {
    console.warn('Firebase is not initialized. Profile operations will be skipped.');
    return null;
  }
  
  return db;
}

// Error codes for Firebase operations
const ERROR_CODES = {
  UNAVAILABLE: 'unavailable',
  PERMISSION_DENIED: 'permission-denied',
} as const;

export const ProfileService = {
  /**
   * Saves a user profile to Firestore
   * @param profile The profile data to save
   * @returns Promise that resolves when the operation completes
   */
  async saveProfile(profile: UserProfile): Promise<void> {
    try {
      const firestore = await ensureInitialized();
      if (!firestore) {
        console.warn('Cannot save profile: Firebase not initialized');
        return;
      }
      
      const profileData = {
        ...profile,
        lastUpdated: Date.now()
      };
      
      console.log('[Firebase] Saving profile to Firestore for user:', profile.userId);
      await setDoc(doc(firestore, 'profiles', profile.userId), profileData, { merge: true });
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError.code === ERROR_CODES.UNAVAILABLE) {
        console.warn('Firebase is not available. Profile will be saved locally only.');
      } else {
        console.error('Failed to save profile:', error);
        throw error;
      }
    }
  },

  /**
   * Updates specific fields of a user profile
   * @param userId The ID of the user to update
   * @param updates The fields to update
   * @returns Promise that resolves when the operation completes
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const firestore = await ensureInitialized();
      if (!firestore) {
        console.warn('Cannot update profile: Firebase not initialized');
        return;
      }
      
      const profileRef = doc(firestore, 'profiles', userId);
      const updateData = {
        ...updates,
        lastUpdated: Date.now()
      };
      
      console.log('Updating profile:', { userId });
      await updateDoc(profileRef, updateData);
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError.code === ERROR_CODES.UNAVAILABLE) {
        console.warn('Firebase is not available. Profile update will be skipped.');
      } else {
        console.error('Failed to update profile:', error);
        throw error;
      }
    }
  },

  /**
   * Retrieves a user profile from Firestore
   * @param userId The ID of the user to retrieve
   * @returns The user profile if found, null otherwise
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const firestore = await ensureInitialized();
      if (!firestore) {
        console.warn('Cannot get profile: Firebase not initialized');
        return null;
      }
      
      const profileRef = doc(firestore, 'profiles', userId);
      const profileSnap = await getDoc(profileRef);
      
      if (!profileSnap.exists()) {
        console.log('[Firebase] No profile found for user:', userId);
        return null;
      }
      
      const profileData = profileSnap.data() as UserProfile;
      console.log('Retrieved profile for user:', userId);
      return profileData;
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when accessing profile. User may not be authenticated.');
      } else {
        console.error('Failed to get profile:', error);
      }
      return null;
    }
  },

  /**
   * Subscribes to real-time updates for a user profile
   * @param userId The ID of the user to subscribe to
   * @param callback Function to call when the profile updates
   * @returns Unsubscribe function
   */
  subscribeToProfile(userId: string, callback: (profile: UserProfile | null) => void): () => void {
    if (!db) {
      console.warn('Cannot subscribe to profile: Firebase not initialized');
      return () => {};
    }
    
    try {
      const profileRef = doc(db, 'profiles', userId);
      console.log('Setting up profile subscription for user:', userId);
      
      return onSnapshot(
        profileRef,
        (snap) => {
          if (snap.exists()) {
            callback(snap.data() as UserProfile);
          } else {
            callback(null);
          }
        },
        (error: FirestoreError) => {
          console.error('Error in profile subscription:', error);
          if (error.code === ERROR_CODES.PERMISSION_DENIED) {
            console.warn('Permission denied for profile subscription. User may need to sign in.');
          }
          callback(null);
        }
      );
    } catch (error) {
      console.error('Failed to set up profile subscription:', error);
      return () => {};
    }
  },

  /**
   * Deletes a user profile from Firestore
   * @param userId The ID of the user to delete
   * @returns Promise that resolves when the operation completes
   */
  async deleteProfile(userId: string): Promise<void> {
    try {
      const firestore = await ensureInitialized();
      if (!firestore) {
        console.warn('Cannot delete profile: Firebase not initialized');
        return;
      }
      
      await deleteDoc(doc(firestore, 'profiles', userId));
      console.log('Deleted profile for user:', userId);
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when deleting profile. User may not have sufficient permissions.');
      } else {
        console.error('Failed to delete profile:', error);
      }
      throw error;
    }
  }
};