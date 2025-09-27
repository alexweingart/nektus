import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';
import { UserProfile, ContactEntry } from '@/types/profile';

/**
 * Server-side profile service using Firebase Admin SDK
 * Handles profile creation and phone number checking for redirects
 */
export class ServerProfileService {
  /**
   * Get or create a user profile, returns whether setup is needed
   */
  static async getOrCreateProfile(
    userId: string,
    userInfo: { name?: string | null; email?: string | null; image?: string | null }
  ): Promise<{ profile: UserProfile; needsSetup: boolean }> {
    try {
      const { db } = await getFirebaseAdmin();
      const profileRef = db.collection('profiles').doc(userId);
      const profileDoc = await profileRef.get();

      if (profileDoc.exists) {
        // Profile exists - check if has phone number
        const profileData = profileDoc.data() as UserProfile;
        const phoneEntry = profileData.contactEntries?.find(e => e.fieldType === 'phone');
        const hasPhone = phoneEntry?.value && phoneEntry.value.trim() !== '';

        return {
          profile: profileData,
          needsSetup: !hasPhone
        };
      } else {
        // Create new profile with default fields
        const defaultProfile = this.createDefaultProfile(userId, userInfo);

        await profileRef.set(defaultProfile);
        console.log('[ServerProfileService] Created new profile for user:', userId);

        return {
          profile: defaultProfile,
          needsSetup: true // New profile always needs setup
        };
      }
    } catch (error) {
      console.error('[ServerProfileService] Error getting/creating profile:', error);
      // Fallback - assume needs setup if we can't check
      const defaultProfile = this.createDefaultProfile(userId, userInfo);
      return {
        profile: defaultProfile,
        needsSetup: true
      };
    }
  }

  /**
   * Check if a profile has a phone number (for redirect decisions)
   */
  static async profileHasPhone(userId: string): Promise<boolean> {
    try {
      const { db } = await getFirebaseAdmin();
      const profileDoc = await db.collection('profiles').doc(userId).get();

      if (!profileDoc.exists) {
        return false;
      }

      const profileData = profileDoc.data() as UserProfile;
      const phoneEntry = profileData.contactEntries?.find(e => e.fieldType === 'phone');
      return !!(phoneEntry?.value && phoneEntry.value.trim() !== '');
    } catch (error) {
      console.error('[ServerProfileService] Error checking phone:', error);
      return false; // Assume no phone if error
    }
  }

  /**
   * Create a default profile structure
   */
  private static createDefaultProfile(
    userId: string,
    userInfo: { name?: string | null; email?: string | null; image?: string | null }
  ): UserProfile {
    const baseFields: ContactEntry[] = [
      {
        fieldType: 'name',
        value: userInfo.name || '',
        section: 'universal',
        order: -2,
        isVisible: true,
        confirmed: true
      },
      {
        fieldType: 'bio',
        value: '',
        section: 'universal',
        order: -1,
        isVisible: true,
        confirmed: false
      },
      {
        fieldType: 'phone',
        value: '',
        section: 'universal',
        order: 0,
        isVisible: true,
        confirmed: false
      },
      {
        fieldType: 'email',
        value: userInfo.email || '',
        section: 'universal',
        order: 1,
        isVisible: true,
        confirmed: !!userInfo.email
      }
    ];

    return {
      userId,
      profileImage: userInfo.image || '',
      backgroundImage: '',
      lastUpdated: Date.now(),
      contactEntries: baseFields
    };
  }
}