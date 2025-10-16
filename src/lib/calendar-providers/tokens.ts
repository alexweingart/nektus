// Calendar Token Management

import { collection, doc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase/clientConfig';
import { CalendarTokens } from '@/types';

const TOKENS_COLLECTION = 'calendarTokens';

export async function getCalendarTokens(userEmail: string): Promise<CalendarTokens[]> {
  try {
    const tokensQuery = query(
      collection(db!, TOKENS_COLLECTION),
      where('userEmail', '==', userEmail)
    );

    const querySnapshot = await getDocs(tokensQuery);
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

    console.log(`Found ${tokens.length} calendar tokens for user: ${userEmail}`);
    return tokens;
  } catch (error) {
    console.error('Error fetching calendar tokens:', error);
    return [];
  }
}

export async function saveCalendarTokens(
  userEmail: string,
  tokens: CalendarTokens
): Promise<void> {
  try {
    const docId = `${userEmail}_${tokens.provider}_${tokens.email}`;

    const tokenData: Partial<CalendarTokens> & { userEmail: string; updatedAt: Date } = {
      userEmail,
      email: tokens.email,
      provider: tokens.provider,
      accessToken: tokens.accessToken,
      updatedAt: new Date(),
    };

    // Only add refreshToken if it exists (some providers might not have one)
    if (tokens.refreshToken) {
      tokenData.refreshToken = tokens.refreshToken;
    }

    // Only add expiresAt if it exists (not for Apple CalDAV)
    if (tokens.expiresAt) {
      tokenData.expiresAt = tokens.expiresAt;
    }

    // Only add Apple-specific fields if they exist and have valid values
    if (tokens.appleId && typeof tokens.appleId === 'string' && tokens.appleId.trim() !== '') {
      tokenData.appleId = tokens.appleId;
    }
    if (tokens.appSpecificPassword && typeof tokens.appSpecificPassword === 'string' && tokens.appSpecificPassword.trim() !== '') {
      tokenData.appSpecificPassword = tokens.appSpecificPassword;
    }

    await setDoc(doc(db!, TOKENS_COLLECTION, docId), tokenData);

    console.log(`✅ Saved calendar tokens for ${tokens.provider}: ${tokens.email}`);
  } catch (error) {
    console.error('Error saving calendar tokens:', error);
    throw error;
  }
}


export async function removeCalendarTokens(
  userEmail: string,
  provider: string,
  email: string
): Promise<void> {
  try {
    const docId = `${userEmail}_${provider}_${email}`;
    await deleteDoc(doc(db!, TOKENS_COLLECTION, docId));

    console.log(`🗑️ Removed calendar tokens for ${provider}: ${email}`);
  } catch (error) {
    console.error('Error removing calendar tokens:', error);
    throw error;
  }
}

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
  // In production, implement proper encryption here
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiry: tokens.tokenExpiry
  };
}

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
    tokenExpiry: tokens.tokenExpiry
  };
}



