/**
 * Profile Save Service
 * Centralized service for saving profile data with consistent behavior
 */

import type { UserProfile, ContactEntry } from '@/types/profile';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';

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
      // Determine merge strategy
      const merged = options.directUpdate 
        ? { 
            ...currentProfile, 
            ...updates, 
            userId, 
            lastUpdated: Date.now(),
            profileImage: updates.profileImage || currentProfile?.profileImage || '',
            backgroundImage: updates.backgroundImage || currentProfile?.backgroundImage || '',
            contactEntries: updates.contactEntries || currentProfile?.contactEntries || []
          }
        : this.mergeNonEmpty(currentProfile, updates, userId);

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
   * Save ContactEntry[] and images directly (for form submissions)
   */
  static async saveContactEntries(
    userId: string,
    currentProfile: UserProfile | null,
    contactEntries: ContactEntry[],
    images: { profileImage?: string; backgroundImage?: string } = {}
  ): Promise<SaveProfileResult> {
    const updates: Partial<UserProfile> = {
      contactEntries,
      ...images
    };

    return this.saveProfile(userId, currentProfile, updates, { directUpdate: true });
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
          
          (result as any)[key] = mergedEntries;
        } else if (typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
          (result as any)[key] = {
            ...((result as any)[key] || {}),
            ...(sourceValue as object)
          };
        } else {
          (result as any)[key] = sourceValue;
        }
      }
    }
    
    return { ...result, userId, lastUpdated: Date.now() };
  }

  /**
   * Create default profile structure
   */
  private static createDefaultProfile(userId: string): UserProfile {
    return {
      userId,
      profileImage: '',
      backgroundImage: '',
      lastUpdated: Date.now(),
      contactEntries: []
    };
  }
}