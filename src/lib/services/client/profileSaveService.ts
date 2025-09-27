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
      // Ensure contactEntries have unique orders if they're being updated
      let processedUpdates = updates;
      if (updates.contactEntries) {
        const contactEntriesWithUniqueOrder = this.assignUniqueOrders(updates.contactEntries);
        
        processedUpdates = {
          ...updates,
          contactEntries: contactEntriesWithUniqueOrder
        };
        
      }
      
      // Determine merge strategy
      const merged = options.directUpdate 
        ? { 
            ...currentProfile, 
            ...processedUpdates, 
            userId, 
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
   * Save ContactEntry[] and images directly (for form submissions)
   */
  static async saveContactEntries(
    userId: string,
    currentProfile: UserProfile | null,
    contactEntries: ContactEntry[],
    images: { profileImage?: string; backgroundImage?: string } = {}
  ): Promise<SaveProfileResult> {
    
    // Ensure unique order numbers before saving to Firebase
    const contactEntriesWithUniqueOrder = this.assignUniqueOrders(contactEntries);
    
    const updates: Partial<UserProfile> = {
      contactEntries: contactEntriesWithUniqueOrder,
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
      profileImage: '',
      backgroundImage: '',
      lastUpdated: Date.now(),
      contactEntries: []
    };
  }
}