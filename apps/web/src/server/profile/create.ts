import { getFirebaseAdmin } from '@/server/config/firebase';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { UserProfile, ContactEntry } from '@/types/profile';
import { generateProfileColors } from '@/shared/colors';

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
        // Reserve a shortCode before creating the profile so it's included in the initial write
        const shortCode = await AdminProfileService.generateAndReserveShortCode(userId);

        // Create new profile with default fields (includes shortCode)
        const defaultProfile = this.createDefaultProfile(userId, userInfo, shortCode);

        await profileRef.set(defaultProfile);
        console.log('[ServerProfileService] Created new profile for user:', userId);

        return {
          profile: defaultProfile,
          needsSetup: true // New profile always needs setup
        };
      }
    } catch (error) {
      console.error('[ServerProfileService] Error getting/creating profile:', error);
      // Fallback - attempt to create profile anyway
      let shortCode: string;
      try {
        shortCode = await AdminProfileService.generateAndReserveShortCode(userId);
      } catch (scError) {
        console.error('[ServerProfileService] Recovery: Failed to reserve shortCode:', scError);
        // Last resort — generate a local code; reverse index will be missing but profile won't crash
        shortCode = Math.random().toString(36).slice(2, 10);
      }

      const defaultProfile = this.createDefaultProfile(userId, userInfo, shortCode);

      // Try to save the profile as a recovery mechanism
      try {
        const { db } = await getFirebaseAdmin();
        await db.collection('profiles').doc(userId).set(defaultProfile);
        console.log('[ServerProfileService] Recovery: Created profile for user:', userId);
      } catch (saveError) {
        console.error('[ServerProfileService] Recovery save also failed:', saveError);
      }

      return {
        profile: defaultProfile,
        needsSetup: true
      };
    }
  }

  /**
   * Find a profile by email address
   * Used for linking Apple accounts to existing Google accounts by email
   */
  static async findProfileByEmail(email: string): Promise<{ userId: string; profile: UserProfile } | null> {
    try {
      const { db } = await getFirebaseAdmin();
      // Query profiles where any contactEntry has the matching email
      const profilesRef = db.collection('profiles');
      const snapshot = await profilesRef.get();

      for (const doc of snapshot.docs) {
        const profile = doc.data() as UserProfile;
        const emailEntry = profile.contactEntries?.find(
          e => e.fieldType === 'email' && e.value?.toLowerCase() === email.toLowerCase()
        );
        if (emailEntry) {
          console.log('[ServerProfileService] Found existing profile by email:', doc.id);
          return { userId: doc.id, profile };
        }
      }

      return null;
    } catch (error) {
      console.error('[ServerProfileService] Error finding profile by email:', error);
      return null;
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
    userInfo: { name?: string | null; email?: string | null; image?: string | null },
    shortCode: string
  ): UserProfile {
    const email = userInfo.email || '';
    const isPrivateRelay = email.endsWith('@privaterelay.appleid.com');
    // Private relay emails are auth-only — don't expose in contactEntries
    const contactEmail = isPrivateRelay ? '' : email;

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
        confirmed: true
      },
      {
        fieldType: 'phone',
        value: '',
        section: 'personal',
        order: 0,
        isVisible: true,
        confirmed: true
      },
      {
        fieldType: 'email',
        value: contactEmail,
        section: 'personal',
        order: 1,
        isVisible: true,
        confirmed: true
      },
      {
        fieldType: 'phone',
        value: '',
        section: 'work',
        order: 0,
        isVisible: true,
        confirmed: true
      },
      {
        fieldType: 'email',
        value: contactEmail,
        section: 'work',
        order: 1,
        isVisible: true,
        confirmed: true
      }
    ];

    // Generate profile colors from name (seeded, deterministic)
    const name = userInfo.name || 'User';
    const backgroundColors = generateProfileColors(name);
    console.log('[ServerProfileService] Creating profile with name:', name, '-> colors:', backgroundColors);

    return {
      userId,
      shortCode,
      authEmail: email || undefined,
      profileImage: userInfo.image || '',
      backgroundImage: '',
      backgroundColors,
      lastUpdated: Date.now(),
      contactEntries: baseFields
    };
  }
}