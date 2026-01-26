import { getFirebaseAdmin } from '@/server/config/firebase';
import { UserProfile } from '@/types/profile';

/**
 * Generate a random 8-char base62 short code
 */
function generateShortCode(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export const AdminProfileService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { db } = await getFirebaseAdmin();
      const doc = await db.collection('profiles').doc(userId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return doc.data() as UserProfile;
    } catch (error) {
      console.error('Error getting profile:', error);
      return null;
    }
  },
  
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const { db } = await getFirebaseAdmin();
      await db.collection('profiles').doc(userId).update(updates);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },
  
  async saveProfile(profile: UserProfile): Promise<void> {
    try {
      const { db } = await getFirebaseAdmin();
      await db.collection('profiles').doc(profile.userId).set(profile);
    } catch (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  },
  
  async deleteProfile(userId: string): Promise<void> {
    try {
      const { db } = await getFirebaseAdmin();
      await db.collection('profiles').doc(userId).delete();
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  },

  /**
   * Generate a unique shortCode for a user and store the mapping
   * @param userId The user ID to generate a shortCode for
   * @returns The generated shortCode
   */
  async generateAndSaveShortCode(userId: string): Promise<string> {
    const { db } = await getFirebaseAdmin();
    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const shortCode = generateShortCode();
      const shortCodeRef = db.collection('shortCodes').doc(shortCode);

      try {
        // Use a transaction to ensure atomic check-and-set
        await db.runTransaction(async (transaction) => {
          const shortCodeDoc = await transaction.get(shortCodeRef);

          if (shortCodeDoc.exists) {
            throw new Error('COLLISION');
          }

          // Create the shortCode document
          transaction.set(shortCodeRef, { userId });

          // Update the user's profile with the shortCode
          const profileRef = db.collection('profiles').doc(userId);
          transaction.update(profileRef, { shortCode });
        });

        console.log(`Generated shortCode ${shortCode} for user ${userId}`);
        return shortCode;
      } catch (error) {
        if ((error as Error).message === 'COLLISION') {
          console.log(`ShortCode collision, retrying... (attempt ${attempt + 1})`);
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Failed to generate unique shortCode after ${MAX_ATTEMPTS} attempts`);
  },

  /**
   * Look up a userId by shortCode
   * @param shortCode The shortCode to look up
   * @returns The userId if found, null otherwise
   */
  async getUserIdByShortCode(shortCode: string): Promise<string | null> {
    try {
      const { db } = await getFirebaseAdmin();
      const doc = await db.collection('shortCodes').doc(shortCode).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return data?.userId || null;
    } catch (error) {
      console.error('Error looking up shortCode:', error);
      return null;
    }
  },

  /**
   * Ensure a user has a shortCode, generating one if needed
   * @param userId The user ID to ensure has a shortCode
   * @returns The user's shortCode
   */
  async ensureShortCode(userId: string): Promise<string> {
    const profile = await this.getProfile(userId);

    if (profile?.shortCode) {
      return profile.shortCode;
    }

    return this.generateAndSaveShortCode(userId);
  }
}; 