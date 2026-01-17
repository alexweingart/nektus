/**
 * Calendar Token Management for iOS
 * Adapted from: apps/web/src/client/calendar/providers/tokens.ts
 *
 * Changes from web:
 * - Uses Firebase JS SDK instead of modular firebase imports
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/firebase-init';

export interface CalendarTokens {
  email: string;
  provider: 'google' | 'microsoft' | 'apple';
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  // Apple-specific fields
  appleId?: string;
  appSpecificPassword?: string;
}

const TOKENS_COLLECTION = 'calendarTokens';

/**
 * Get all calendar tokens for a user
 */
export async function getCalendarTokens(userEmail: string): Promise<CalendarTokens[]> {
  try {
    const q = query(
      collection(db, TOKENS_COLLECTION),
      where('userEmail', '==', userEmail)
    );
    const querySnapshot = await getDocs(q);

    const tokens: CalendarTokens[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const tokenData: CalendarTokens = {
        email: data.email,
        provider: data.provider,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt?.toDate(),
      };

      // Only add Apple-specific fields if they exist in the document
      if (data.appleId) {
        tokenData.appleId = data.appleId;
      }
      if (data.appSpecificPassword) {
        tokenData.appSpecificPassword = data.appSpecificPassword;
      }

      tokens.push(tokenData);
    });

    console.log(`[tokens] Found ${tokens.length} calendar tokens for user: ${userEmail}`);
    return tokens;
  } catch (error) {
    console.error('[tokens] Error fetching calendar tokens:', error);
    return [];
  }
}

/**
 * Save calendar tokens for a user
 */
export async function saveCalendarTokens(
  userEmail: string,
  tokens: CalendarTokens
): Promise<void> {
  try {
    const docId = `${userEmail}_${tokens.provider}_${tokens.email}`;

    const tokenData: Record<string, unknown> = {
      userEmail,
      email: tokens.email,
      provider: tokens.provider,
      accessToken: tokens.accessToken,
      updatedAt: serverTimestamp(),
    };

    // Only add refreshToken if it exists (some providers might not have one)
    if (tokens.refreshToken) {
      tokenData.refreshToken = tokens.refreshToken;
    }

    // Only add expiresAt if it exists (not for Apple CalDAV)
    if (tokens.expiresAt) {
      tokenData.expiresAt = Timestamp.fromDate(tokens.expiresAt);
    }

    // Only add Apple-specific fields if they exist and have valid values
    if (
      tokens.appleId &&
      typeof tokens.appleId === 'string' &&
      tokens.appleId.trim() !== ''
    ) {
      tokenData.appleId = tokens.appleId;
    }
    if (
      tokens.appSpecificPassword &&
      typeof tokens.appSpecificPassword === 'string' &&
      tokens.appSpecificPassword.trim() !== ''
    ) {
      tokenData.appSpecificPassword = tokens.appSpecificPassword;
    }

    await setDoc(doc(db, TOKENS_COLLECTION, docId), tokenData);

    console.log(`[tokens] Saved calendar tokens for ${tokens.provider}: ${tokens.email}`);
  } catch (error) {
    console.error('[tokens] Error saving calendar tokens:', error);
    throw error;
  }
}

/**
 * Remove calendar tokens for a user
 */
export async function removeCalendarTokens(
  userEmail: string,
  provider: string,
  email: string
): Promise<void> {
  try {
    const docId = `${userEmail}_${provider}_${email}`;
    await deleteDoc(doc(db, TOKENS_COLLECTION, docId));

    console.log(`[tokens] Removed calendar tokens for ${provider}: ${email}`);
  } catch (error) {
    console.error('[tokens] Error removing calendar tokens:', error);
    throw error;
  }
}

/**
 * Encrypt calendar tokens (placeholder for production encryption)
 */
export async function encryptCalendarTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}> {
  // For now, return tokens as-is since they're stored in Firebase with security rules
  // In production, implement proper encryption here using expo-secure-store
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiry: tokens.tokenExpiry,
  };
}

/**
 * Decrypt calendar tokens (placeholder for production decryption)
 */
export async function decryptCalendarTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}> {
  // For now, return tokens as-is
  // In production, implement proper decryption here
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiry: tokens.tokenExpiry,
  };
}

export default {
  getCalendarTokens,
  saveCalendarTokens,
  removeCalendarTokens,
  encryptCalendarTokens,
  decryptCalendarTokens,
};
