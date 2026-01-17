/**
 * iOS Firebase Firestore Service
 * Uses Firebase JS SDK for Firestore operations
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase-init';
import { UserProfile, SavedContact } from '@nektus/shared-types';

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
      const profileData = removeUndefinedValues({
        ...profile,
        lastUpdated: Date.now()
      }) as Partial<UserProfile>;

      // Add timeout to Firestore operation to prevent hanging
      const savePromise = setDoc(
        doc(db, 'profiles', profile.userId),
        profileData,
        { merge: true }
      );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore save timeout')), 15000)
      );

      await Promise.race([savePromise, timeoutPromise]);
    } catch (error) {
      const firestoreError = error as { code?: string };
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
   * Updates specific fields of a user profile
   * @param userId The ID of the user to update
   * @param updates The fields to update
   * @returns Promise that resolves when the operation completes
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const updateData = {
        ...updates,
        lastUpdated: Date.now()
      };

      console.log('Updating profile:', { userId });
      await updateDoc(doc(db, 'profiles', userId), updateData);
    } catch (error) {
      const firestoreError = error as { code?: string };
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
      const profileDoc = await getDoc(doc(db, 'profiles', userId));

      if (!profileDoc.exists()) {
        return null;
      }

      const profileData = profileDoc.data() as UserProfile;
      return profileData;
    } catch (error) {
      const firestoreError = error as { code?: string };
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
  subscribeToProfile(userId: string, callback: (profile: UserProfile | null) => void): Unsubscribe {
    try {
      console.log('Setting up profile subscription for user:', userId);

      const unsubscribe = onSnapshot(
        doc(db, 'profiles', userId),
        (snap) => {
          if (snap.exists()) {
            callback(snap.data() as UserProfile);
          } else {
            callback(null);
          }
        },
        (error) => {
          console.error('Error in profile subscription:', error);
          const firestoreError = error as { code?: string };
          if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
            console.warn('Permission denied for profile subscription. User may need to sign in.');
          }
          callback(null);
        }
      );

      return unsubscribe;
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
      await deleteDoc(doc(db, 'profiles', userId));
      console.log('Deleted profile for user:', userId);
    } catch (error) {
      const firestoreError = error as { code?: string };
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
      // Use the contact's userId as the document ID to prevent duplicates
      await setDoc(
        doc(db, 'profiles', userId, 'contacts', contact.userId),
        contact
      );
      console.log('Saved contact for user:', userId);
    } catch (error) {
      const firestoreError = error as { code?: string };
      if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when saving contact. User may not have sufficient permissions.');
      } else {
        console.error('Failed to save contact:', error);
      }
      throw error;
    }
  },

  /**
   * Gets all contacts for a user
   */
  async getContacts(userId: string): Promise<SavedContact[]> {
    try {
      // Note: For getting all docs in a subcollection, we need to use getDocs with collection
      const { getDocs } = await import('firebase/firestore');
      const snapshot = await getDocs(collection(db, 'profiles', userId, 'contacts'));

      const contacts = snapshot.docs.map(doc => {
        const data = doc.data() as SavedContact;
        return data;
      });

      return contacts;
    } catch (error) {
      const firestoreError = error as { code?: string };
      if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when getting contacts. User may not have sufficient permissions.');
        return [];
      } else {
        console.error('Failed to get contacts:', error);
        return [];
      }
    }
  },

  /**
   * Gets a single contact by ID from the user's contacts collection
   */
  async getContactById(userId: string, contactUserId: string): Promise<SavedContact | null> {
    try {
      const docSnap = await getDoc(doc(db, 'profiles', userId, 'contacts', contactUserId));

      if (!docSnap.exists()) {
        console.warn('Contact not found:', contactUserId);
        return null;
      }

      return docSnap.data() as SavedContact;
    } catch (error) {
      const firestoreError = error as { code?: string };
      if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when getting contact.');
        return null;
      } else {
        console.error('Failed to get contact:', error);
        return null;
      }
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
      await deleteDoc(doc(db, 'profiles', userId, 'contacts', contactUserId));
      console.log('Deleted contact for user:', userId, 'contactUserId:', contactUserId);
    } catch (error) {
      const firestoreError = error as { code?: string };
      if (firestoreError.code === ERROR_CODES.PERMISSION_DENIED) {
        console.warn('Permission denied when deleting contact. User may not have sufficient permissions.');
      } else {
        console.error('Failed to delete contact:', error);
      }
      throw error;
    }
  }
};
