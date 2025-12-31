/**
 * iOS-specific profile save helpers
 * Platform-specific functions that use ProfileSaveService from shared-lib
 */

import type { UserProfile, ContactEntry } from '@nektus/shared-types';
import { ProfileSaveService } from '@nektus/shared-lib';
import { ClientProfileService } from '../firebase/firebase-save';

/**
 * Verification result from phone-based social generation
 */
interface VerificationResult {
  platform: string;
  verified: boolean;
}

/**
 * Session type for iOS (matches SessionProvider structure)
 */
interface Session {
  user?: {
    id?: string;
  };
}

/**
 * Generate and verify WhatsApp profile from phone number
 * Saves to Firebase and updates profile
 *
 * Adapted from web version for React Native
 */
export async function generateWhatsAppFromPhone(
  phoneNumber: string,
  profileRef: React.MutableRefObject<UserProfile | null>,
  session: Session | null,
  setProfile: (profile: UserProfile) => void,
  apiBaseUrl: string
): Promise<void> {
  console.log('[ProfileSave] Phone saved and WhatsApp empty, triggering WhatsApp generation');

  try {
    // Generate and verify WhatsApp profile
    const response = await fetch(`${apiBaseUrl}/api/profile/generate/verify-phone-socials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        platforms: ['whatsapp']
      }),
    });

    if (!response.ok) {
      console.error('[ProfileSave] WhatsApp verification API failed:', response.status);
      return;
    }

    const data = await response.json();
    const whatsappResult = data.results?.find((r: VerificationResult) => r.platform === 'whatsapp');

    if (whatsappResult && whatsappResult.verified) {
      console.log('[ProfileSave] WhatsApp profile verified:', {
        phoneNumber: phoneNumber,
        verified: true
      });

      // Create WhatsApp profile
      const whatsappProfile = {
        username: phoneNumber.replace(/\D/g, ''),
        url: `https://wa.me/${phoneNumber.replace(/\D/g, '')}`,
        userConfirmed: true
      };

      // Get fresh profile data to avoid overwriting concurrent AI social updates
      const freshProfile = profileRef.current;
      const baseEntries = freshProfile?.contactEntries || [];
      const updatedEntries = [...baseEntries];

      // Add or update WhatsApp entry
      const whatsappIndex = updatedEntries.findIndex(e => e.fieldType === 'whatsapp');
      const whatsappEntry: ContactEntry = {
        fieldType: 'whatsapp',
        value: whatsappProfile.username,
        section: 'personal',
        order: updatedEntries.length,
        isVisible: true,
        confirmed: false // Phone-based generation is unconfirmed
      };

      if (whatsappIndex >= 0) {
        updatedEntries[whatsappIndex] = whatsappEntry;
      } else {
        updatedEntries.push(whatsappEntry);
      }

      // Save to Firebase
      if (session?.user?.id && profileRef.current) {
        const saveResult = await ProfileSaveService.saveProfile(
          session.user.id,
          profileRef.current,
          { contactEntries: updatedEntries },
          { directUpdate: true }
        );

        if (saveResult.success && saveResult.profile) {
          console.log('[ProfileSave] Phone-based socials saved to Firebase');

          // Update React state for immediate UI feedback
          profileRef.current = saveResult.profile;
          setProfile(saveResult.profile);
        } else {
          console.error('[ProfileSave] Failed to save phone-based socials:', saveResult.error);
        }
      }
    } else {
      console.log('[ProfileSave] WhatsApp verification failed or not verified');
    }
  } catch (error) {
    console.error('[ProfileSave] WhatsApp verification request failed:', error);
  }
}

/**
 * Silent save function for background operations
 * Bypasses React state management - only updates Firebase and the profileRef
 *
 * Adapted from web version for React Native
 */
export async function silentSaveToFirebase(
  data: Partial<UserProfile>,
  session: Session | null,
  profileRef: React.MutableRefObject<UserProfile | null>
): Promise<void> {
  try {
    if (!session?.user?.id) return;

    const current = profileRef.current;
    if (!current || !current.userId) return;

    // CRITICAL: Get fresh profile data from Firebase before saving to prevent overwrites
    // This ensures we have the latest bio and other data if they were generated in parallel
    const freshProfile = await ClientProfileService.getProfile(session.user.id);
    const baseProfile = freshProfile || current;

    // Use ProfileSaveService for consistent saving logic
    const saveResult = await ProfileSaveService.saveProfile(
      session.user.id,
      baseProfile,
      data,
      { directUpdate: true }
    );

    if (saveResult.success && saveResult.profile) {
      profileRef.current = saveResult.profile; // Update ref only, no React state
    } else {
      console.error('[ProfileSave] Silent save failed:', saveResult.error);
    }
  } catch (error) {
    console.error('[ProfileSave] Silent save failed:', error);
  }
}
