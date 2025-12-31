import { getFirebaseAdmin } from '@/server/config/firebase';
import { UserProfile } from '@/types/profile';

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
  }
}; 