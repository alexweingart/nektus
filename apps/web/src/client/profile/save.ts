/**
 * Profile Save Service
 * Centralized service for saving profile data with consistent behavior
 *
 * TODO: Refactor to match iOS architecture pattern
 * - Core ProfileSaveService already exists in @nektus/shared-client (lines 1-293 are identical)
 * - Keep web-specific helpers here: generateWhatsAppFromPhone, syncProfileToSession
 * - Import ProfileSaveService from @nektus/shared-client instead of duplicating it
 * - This file will become web-specific helpers only (like iOS save-helpers.ts)
 */

import type { UserProfile, ContactEntry } from '@/types/profile';
import { ClientProfileService } from '@/client/profile/firebase-save';

export interface SaveProfileOptions {
  /** Skip React state updates (for background operations) */
  skipUIUpdate?: boolean;
  /** Direct update without merging */
  directUpdate?: boolean;
}

export interface SaveProfileResult {
  success: boolean;
  profile?: UserProfile;
  error?: string;
}

/**
 * Core profile saving service
 * Handles Firebase operations and data merging
 */
export class ProfileSaveService {
  /**
   * Filter contactEntries to only include saveable fields
   * - Universal: all fields
   * - Personal/Work: only visible fields OR fields with values
   * - Deduplicate by fieldType+section
   * - Mark non-empty fields as confirmed
   */
  private static filterSaveableFields(entries: ContactEntry[]): ContactEntry[] {
    // Separate by section
    const universalFields = entries.filter(f => f.section === 'universal');
    const personalFields = entries.filter(
      f => f.section === 'personal' && (f.isVisible || (f.value && f.value.trim() !== ''))
    );
    const workFields = entries.filter(
      f => f.section === 'work' && (f.isVisible || (f.value && f.value.trim() !== ''))
    );

    // Deduplicate by fieldType+section
    const fieldsMap = new Map<string, ContactEntry>();

    // Add universal fields first
    universalFields.forEach(field => {
      const key = `${field.fieldType}-${field.section}`;
      fieldsMap.set(key, field);
    });

    // Add personal fields (skip if already in universal with same fieldType)
    personalFields.forEach(field => {
      const key = `${field.fieldType}-${field.section}`;
      if (!fieldsMap.has(key)) {
        fieldsMap.set(key, field);
      }
    });

    // Add work fields (skip if already in universal with same fieldType)
    workFields.forEach(field => {
      const key = `${field.fieldType}-${field.section}`;
      if (!fieldsMap.has(key)) {
        fieldsMap.set(key, field);
      }
    });

    return Array.from(fieldsMap.values());
  }

  /**
   * Save profile data to Firebase
   */
  static async saveProfile(
    userId: string,
    currentProfile: UserProfile | null,
    updates: Partial<UserProfile>,
    options: SaveProfileOptions = {}
  ): Promise<SaveProfileResult> {
    if (!userId) {
      return { success: false, error: 'User ID required' };
    }

    try {
      // Filter and deduplicate contactEntries if they're being updated
      let processedUpdates = updates;
      if (updates.contactEntries) {
        const filteredEntries = this.filterSaveableFields(updates.contactEntries);
        const contactEntriesWithUniqueOrder = this.assignUniqueOrders(filteredEntries);

        processedUpdates = {
          ...updates,
          contactEntries: contactEntriesWithUniqueOrder
        };

      }

      // Validate image fields - prevent saving base64 data URLs to Firestore
      // Base64 data URLs can exceed Firestore's 1MB field limit
      if (processedUpdates.backgroundImage && processedUpdates.backgroundImage.startsWith('data:image/')) {
        console.warn('[ProfileSaveService] Skipping base64 backgroundImage - waiting for upload to complete');
        delete processedUpdates.backgroundImage;
      }
      if (processedUpdates.profileImage && processedUpdates.profileImage.startsWith('data:image/')) {
        console.warn('[ProfileSaveService] Skipping base64 profileImage - waiting for upload to complete');
        delete processedUpdates.profileImage;
      }
      
      // Determine merge strategy
      const merged = options.directUpdate
        ? {
            ...currentProfile,
            ...processedUpdates,
            userId,
            shortCode: processedUpdates.shortCode || currentProfile?.shortCode || '',
            lastUpdated: Date.now(),
            profileImage: processedUpdates.profileImage || currentProfile?.profileImage || '',
            backgroundImage: processedUpdates.backgroundImage || currentProfile?.backgroundImage || '',
            contactEntries: processedUpdates.contactEntries || currentProfile?.contactEntries || []
          }
        : this.mergeNonEmpty(currentProfile, processedUpdates, userId);

      // Save to Firebase
      await ClientProfileService.saveProfile(merged);

      return { success: true, profile: merged };
    } catch (error) {
      console.error('[ProfileSaveService] Save failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Save failed'
      };
    }
  }

  /**
   * Merge objects intelligently, preserving existing data
   */
  private static mergeNonEmpty(
    target: UserProfile | null,
    source: Partial<UserProfile>,
    userId: string
  ): UserProfile {
    const result = target ? { ...target } : this.createDefaultProfile(userId);

    for (const key in source) {
      const sourceValue = source[key as keyof UserProfile];
      if (sourceValue !== undefined && sourceValue !== null) {
        // Special handling for contactEntries to merge array properly
        if (key === 'contactEntries' && Array.isArray(sourceValue)) {
          const targetEntries = (result[key as keyof UserProfile] as ContactEntry[]) || [];
          const sourceEntries = sourceValue as ContactEntry[];

          // Create a copy of target entries to avoid mutation
          const mergedEntries = [...targetEntries];

          // Merge entries by fieldType - preserve existing entries and add/update new ones
          for (const sourceEntry of sourceEntries) {
            const existingIndex = mergedEntries.findIndex(
              (entry: ContactEntry) => entry.fieldType === sourceEntry.fieldType && entry.section === sourceEntry.section
            );

            if (existingIndex >= 0) {
              // Merge the existing entry with new data, preserving existing fields
              mergedEntries[existingIndex] = {
                ...mergedEntries[existingIndex],
                ...sourceEntry
              };
            } else {
              // Add new entry
              mergedEntries.push(sourceEntry);
            }
          }

          (result as unknown as Record<string, unknown>)[key] = mergedEntries;
        } else if (typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
          (result as unknown as Record<string, unknown>)[key] = {
            ...((result as unknown as Record<string, unknown>)[key] || {}),
            ...(sourceValue as Record<string, unknown>)
          };
        } else {
          (result as unknown as Record<string, unknown>)[key] = sourceValue;
        }
      }
    }

    return { ...result, userId, lastUpdated: Date.now() };
  }

  /**
   * Assign unique orders while preserving semantic values for priority fields
   */
  private static assignUniqueOrders(entries: ContactEntry[]): ContactEntry[] {
    const result: ContactEntry[] = [];
    let currentOrder = 0;

    // First pass: handle priority fields with fixed orders (ONLY for universal section)
    entries.forEach(entry => {
      if (entry.section === 'universal') {
        if (entry.fieldType === 'name') {
          result.push({ ...entry, order: -2 });
        } else if (entry.fieldType === 'bio') {
          result.push({ ...entry, order: -1 });
        } else if (entry.fieldType === 'phone') {
          result.push({ ...entry, order: 0 });
        } else if (entry.fieldType === 'email') {
          result.push({ ...entry, order: 1 });
        } else {
          // Universal non-priority fields will be handled in second pass
          result.push({ ...entry });
        }
      } else {
        // Personal/work fields will be handled in second pass to get unique sequential orders
        result.push({ ...entry });
      }
    });
    
    // Second pass: assign sequential orders to remaining fields (starting from 2)
    currentOrder = 2;
    result.forEach((entry, index) => {
      // For universal fields: skip priority fields that already have orders
      // For personal/work fields: assign sequential orders to ALL fields
      const isUniversalPriorityField = entry.section === 'universal' && ['name', 'bio', 'phone', 'email'].includes(entry.fieldType);

      if (!isUniversalPriorityField && entry.order === undefined) {
        result[index] = { ...entry, order: currentOrder };
        currentOrder++;
      }
    });

    return result;
  }

  /**
   * Create default profile structure
   */
  private static createDefaultProfile(userId: string): UserProfile {
    return {
      userId,
      shortCode: '',
      profileImage: '',
      backgroundImage: '',
      lastUpdated: Date.now(),
      contactEntries: []
    };
  }
}

/**
 * Verification result from phone-based social generation
 */
interface VerificationResult {
  platform: string;
  verified: boolean;
}

/**
 * Generate and verify WhatsApp profile from phone number
 * Saves to Firebase and returns updated contact entries
 */
export async function generateWhatsAppFromPhone(
  phoneNumber: string,
  profileRef: React.MutableRefObject<UserProfile | null>,
  session: { user?: { id?: string } } | null,
  setProfile: (profile: UserProfile) => void,
  setStreamingSocialContacts: (contacts: ContactEntry[] | null) => void
): Promise<void> {
  try {
    // Generate and verify WhatsApp profile
    const response = await fetch('/api/profile/generate/verify-phone-socials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        platforms: ['whatsapp']
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      console.error('[ProfileSave] WhatsApp verification API failed:', response.status);
      return;
    }

    const data = await response.json();
    const whatsappResult = data.results?.find((r: VerificationResult) => r.platform === 'whatsapp');

    if (whatsappResult && whatsappResult.verified) {
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
        confirmed: true
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
          // Update React state for immediate UI feedback
          profileRef.current = saveResult.profile;
          setProfile(saveResult.profile);
          setStreamingSocialContacts(updatedEntries);
        } else {
          console.error('[ProfileSave] Failed to save phone-based socials:', saveResult.error);
        }
      }
    }
  } catch (error) {
    console.error('[ProfileSave] WhatsApp verification request failed:', error);
  }
}

/**
 * Session profile structure for NextAuth
 */
interface SessionProfile {
  contactChannels?: {
    entries?: Array<{
      platform: string;
      section?: string;
      userConfirmed?: boolean;
      internationalPhone?: string;
      nationalPhone?: string;
    }>;
  };
}

/**
 * Sync profile data to NextAuth session
 * Updates phone and background image in session if changed
 */
export async function syncProfileToSession(
  merged: UserProfile,
  session: { user?: { backgroundImage?: string | null }; profile?: SessionProfile } | null,
  wasFormSubmission: boolean,
  update?: (data: Record<string, unknown>, options?: { broadcast?: boolean }) => Promise<unknown>
): Promise<void> {
  if (!update) return;

  // Update session with new phone info ONLY for form submissions
  const currentSessionPhoneEntry = session?.profile?.contactChannels?.entries?.find(
    e => e.platform === 'phone'
  );
  const newPhoneEntry = merged.contactEntries?.find(e => e.fieldType === 'phone');

  const shouldUpdateSession = wasFormSubmission &&
    newPhoneEntry?.value &&
    currentSessionPhoneEntry?.internationalPhone !== newPhoneEntry.value;

  const currentSessionBg = session?.user?.backgroundImage;
  const newBg = merged.backgroundImage;

  // Build session update payload
  const sessionUpdateData: Record<string, unknown> = {};

  // Include phone data if phone changed via form submission
  if (shouldUpdateSession && newPhoneEntry) {
    sessionUpdateData.profile = {
      contactChannels: {
        entries: [
          {
            platform: 'phone',
            section: newPhoneEntry.section || 'universal',
            userConfirmed: newPhoneEntry.confirmed || false,
            internationalPhone: newPhoneEntry.value,
            nationalPhone: newPhoneEntry.value || ''
          }
        ]
      }
    };
  }

  // Include background image if it changed
  if (newBg && newBg !== currentSessionBg) {
    sessionUpdateData.backgroundImage = newBg;
  }

  // Perform session update if we have data to send
  if (Object.keys(sessionUpdateData).length) {
    try {
      const sessionUpdatePromise = (update as (data: Record<string, unknown>, options?: { broadcast?: boolean }) => Promise<unknown>)(
        sessionUpdateData,
        { broadcast: false }
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session update timeout')), 10000)
      );
      await Promise.race([sessionUpdatePromise, timeoutPromise]);
    } catch (error) {
      console.error('[ProfileSave] Error updating session:', error);
      // Non-fatal
    }
  }
}

