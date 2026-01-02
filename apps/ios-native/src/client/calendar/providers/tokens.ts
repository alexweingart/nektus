/**
 * Calendar Token Management for iOS
 * Adapted from: apps/web/src/client/calendar/providers/tokens.ts
 *
 * Changes from web:
 * - Uses @react-native-firebase/firestore instead of web firebase
 */

import firestore from '@react-native-firebase/firestore';

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
    const querySnapshot = await firestore()
      .collection(TOKENS_COLLECTION)
      .where('userEmail', '==', userEmail)
      .get();

    const tokens: CalendarTokens[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
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
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    // Only add refreshToken if it exists (some providers might not have one)
    if (tokens.refreshToken) {
      tokenData.refreshToken = tokens.refreshToken;
    }

    // Only add expiresAt if it exists (not for Apple CalDAV)
    if (tokens.expiresAt) {
      tokenData.expiresAt = firestore.Timestamp.fromDate(tokens.expiresAt);
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

    await firestore().collection(TOKENS_COLLECTION).doc(docId).set(tokenData);

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
    await firestore().collection(TOKENS_COLLECTION).doc(docId).delete();

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
