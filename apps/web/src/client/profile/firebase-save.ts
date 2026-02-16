import { db } from '@/client/config/firebase';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  FirestoreError,
  collection
} from 'firebase/firestore';
import { UserProfile } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';

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

/**
 * Recursively removes undefined values from an object
 * Firestore doesn't allow undefined values, only null
 */
function removeUndefinedValues(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item));
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    return cleaned;
  }

  return obj;
}

export const ClientProfileService = {
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

      const profileData = removeUndefinedValues({
        ...profile,
        lastUpdated: Date.now()
      }) as Partial<UserProfile>;

      // Add timeout to Firestore operation to prevent hanging
      const savePromise = setDoc(doc(firestore, 'profiles', profile.userId), profileData, { merge: true });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore save timeout')), 15000)
      );

      await Promise.race([savePromise, timeoutPromise]);
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError.code === ERROR_CODES.UNAVAILABLE) {
        console.warn('Firebase is not available. Profile will be saved locally only.');
      } else if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when saving profile. User may not be authenticated with Firebase Auth.');
        console.warn('This is expected if Firebase Auth sign-in failed. Profile will not be saved to Firebase.');
      } else {
        console.error('Failed to save profile:', error);
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
        return null;
      }
      
      const profileData = profileSnap.data() as UserProfile;
      return profileData;
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when accessing profile. User may not be authenticated with Firebase Auth.');
        console.warn('This is expected if Firebase Auth sign-in failed. The app will continue with limited functionality.');
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
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when deleting profile. User may not have sufficient permissions.');
      } else {
        console.error('Failed to delete profile:', error);
      }
      throw error;
    }
  },

  /**
   * Saves a contact to the user's contacts collection
   */
  async saveContact(userId: string, contact: SavedContact): Promise<void> {
    try {
      const firestore = await ensureInitialized();
      if (!firestore) {
        console.warn('Cannot save contact: Firebase not initialized');
        return;
      }
      
      // Use the contact's userId as the document ID to prevent duplicates
      const contactRef = doc(firestore, 'profiles', userId, 'contacts', contact.userId);
      await setDoc(contactRef, contact);
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when saving contact. User may not have sufficient permissions.');
      } else {
        console.error('Failed to save contact:', error);
      }
      throw error;
    }
  },

  /**
   * Subscribes to real-time updates for a user's contacts collection
   * @param userId The ID of the user to subscribe to
   * @param callback Function to call when contacts update
   * @returns Unsubscribe function
   */
  subscribeToContacts(userId: string, callback: (contacts: SavedContact[]) => void): () => void {
    if (!db) {
      console.warn('Cannot subscribe to contacts: Firebase not initialized');
      return () => {};
    }

    try {
      const contactsRef = collection(db, 'profiles', userId, 'contacts');
      return onSnapshot(
        contactsRef,
        (snapshot) => {
          const contacts = snapshot.docs.map(doc => doc.data() as SavedContact);
          callback(contacts);
        },
        (error: FirestoreError) => {
          console.error('Error in contacts subscription:', error);
          if (error.code === ERROR_CODES.PERMISSION_DENIED) {
            console.warn('Permission denied for contacts subscription. User may need to sign in.');
          }
          callback([]);
        }
      );
    } catch (error) {
      console.error('Failed to set up contacts subscription:', error);
      return () => {};
    }
  },

  /**
   * Deletes a contact from the user's contacts collection
   * @param userId The ID of the user who owns the contact list
   * @param contactUserId The ID of the contact to delete
   * @returns Promise that resolves when the operation completes
   */
  async deleteContact(userId: string, contactUserId: string): Promise<void> {
    try {
      const firestore = await ensureInitialized();
      if (!firestore) {
        console.warn('Cannot delete contact: Firebase not initialized');
        return;
      }

      const contactRef = doc(firestore, 'profiles', userId, 'contacts', contactUserId);
      await deleteDoc(contactRef);
    } catch (error) {
      const firestoreError = error as FirestoreError;
      if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when deleting contact. User may not have sufficient permissions.');
      } else {
        console.error('Failed to delete contact:', error);
      }
      throw error;
    }
  }
}; 