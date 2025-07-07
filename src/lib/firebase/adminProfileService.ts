import { getFirebaseAdmin } from './adminConfig';
import { UserProfile } from '@/types/profile';

export const AdminProfileService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { db } = await getFirebaseAdmin();
      const profileRef = db.collection('profiles').doc(userId);
      const profileSnap = await profileRef.get();

      if (!profileSnap.exists) {
        return null;
      }

      const profileData = profileSnap.data() as UserProfile;
      return profileData;
    } catch (error) {
      console.error('[Admin] Failed to get profile:', error);
      return null;
    }
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      console.log(`[Admin] Updating profile for user ${userId} with:`, Object.keys(updates));
      const { db } = await getFirebaseAdmin();
      const profileRef = db.collection('profiles').doc(userId);
      const updateData = {
        ...updates,
        lastUpdated: Date.now()
      };
      
      console.log(`[Admin] About to call profileRef.update() for user ${userId}`);
      
      // Check if document exists first
      const docSnapshot = await profileRef.get();
      if (!docSnapshot.exists) {
        console.log(`[Admin] Profile document doesn't exist for user ${userId}, using set() instead of update()`);
        await profileRef.set(updateData, { merge: true });
      } else {
        await profileRef.update(updateData);
      }
      
      console.log(`[Admin] Successfully updated profile for user ${userId}`);
    } catch (error) {
      console.error(`[Admin] Failed to update profile for user ${userId}:`, error);
      console.error('[Admin] Error details:', {
        code: (error as any).code,
        message: (error as any).message,
        stack: (error as any).stack
      });
      throw error;
    }
  },
  
  // Added debugging method to fix phone-related social media
  async fixPhoneBasedSocialMedia(userId: string): Promise<boolean> {
    try {
      const { db } = await getFirebaseAdmin();
      const profileRef = db.collection('profiles').doc(userId);
      const profileSnap = await profileRef.get();
      
      if (!profileSnap.exists) {
        console.log('[Admin] No profile found to fix for user:', userId);
        return false;
      }
      
      const profileData = profileSnap.data() as UserProfile;
      if (!profileData.contactChannels?.phoneInfo?.internationalPhone) {
        console.log('[Admin] No phone number found for user:', userId);
        return false;
      }
      
      const phoneNumber = profileData.contactChannels.phoneInfo.internationalPhone;
      const cleanPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
      
      // Update WhatsApp, Telegram, and WeChat profiles
      const updates: Partial<UserProfile> = {
        contactChannels: {
          ...profileData.contactChannels,
          whatsapp: {
            username: cleanPhone,
            url: `https://wa.me/${cleanPhone}`,
            userConfirmed: false
          },
          telegram: {
            username: cleanPhone,
            url: `https://t.me/${cleanPhone}`,
            userConfirmed: false
          },
          wechat: {
            username: cleanPhone,
            url: `weixin://dl/chat?${cleanPhone}`,
            userConfirmed: false
          }
        }
      };
      
      console.log('[Admin] Fixing phone-based social media for user:', userId);
      await profileRef.update(updates);
      console.log('[Admin] Successfully fixed phone-based social media');
      return true;
    } catch (error) {
      console.error('[Admin] Failed to fix phone-based social media:', error);
      return false;
    }
  }
}; 