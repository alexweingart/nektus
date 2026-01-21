/**
 * Contact save service for iOS
 * Adapted from: apps/web/src/client/contacts/save.ts
 *
 * Changes from web:
 * - Uses react-native-contacts for native contact saving (full app only)
 * - Falls back to vCard for App Clip (no contacts access)
 * - Simplified flow (no Google Contacts integration on iOS)
 * - Me Card extraction when permission is granted
 */

import Contacts, { Contact } from 'react-native-contacts';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import type { UserProfile } from '@nektus/shared-types';
import { getApiBaseUrl, getIdToken } from '../auth/firebase';
import { getFieldValue } from '@nektus/shared-client';
import { isAppClip } from '../auth/session-handoff';
import { openVCard } from './vcard';
import { getMeCard, getMeCardImage } from '../native/MeCardWrapper';

export interface ContactSaveResult {
  success: boolean;
  firebase: { success: boolean; error?: string };
  native: { success: boolean; error?: string; usedVCard?: boolean };
}

export interface MeCardData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  imageBase64?: string;
}

/**
 * Request contacts permission
 */
async function requestContactsPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const permission = await Contacts.requestPermission();
    return permission === 'authorized';
  } else {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
}

/**
 * Save contact to native contacts app
 */
async function saveToNativeContacts(profile: UserProfile): Promise<{ success: boolean; error?: string }> {
  try {
    const hasPermission = await requestContactsPermission();
    if (!hasPermission) {
      return { success: false, error: 'Contacts permission denied' };
    }

    const name = getFieldValue(profile.contactEntries, 'name') || '';
    const email = getFieldValue(profile.contactEntries, 'email') || '';
    const phone = getFieldValue(profile.contactEntries, 'phone') || '';

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const newContact: Partial<Contact> = {
      givenName: firstName,
      familyName: lastName,
      emailAddresses: email ? [{ label: 'home', email }] : [],
      phoneNumbers: phone ? [{ label: 'mobile', number: phone }] : [],
      note: `Added via Nekt on ${new Date().toLocaleDateString()}`,
    };

    await Contacts.addContact(newContact as Contact);
    return { success: true };
  } catch (error) {
    console.error('Failed to save to native contacts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save contact to Firebase
 */
async function saveToFirebase(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const idToken = await getIdToken();

    const response = await fetch(`${apiBaseUrl}/api/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token, skipGoogleContacts: true }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.firebase || { success: true };
  } catch (error) {
    console.error('Failed to save to Firebase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main contact save flow
 *
 * Flow:
 * - App Clip: Firebase save + vCard (no native contacts access)
 * - Full App: Firebase save + request permission + native contacts (vCard fallback if denied)
 */
export async function saveContactFlow(
  profile: UserProfile,
  token: string,
  options: { saveToNative?: boolean; onMeCardExtracted?: (data: MeCardData) => void } = {}
): Promise<ContactSaveResult> {
  const { saveToNative = true, onMeCardExtracted } = options;

  console.log('🔍 Starting iOS contact save flow');
  console.log(`📱 Running in: ${isAppClip() ? 'App Clip' : 'Full App'}`);

  // Save to Firebase first
  const firebaseResult = await saveToFirebase(token);

  if (!firebaseResult.success) {
    return {
      success: false,
      firebase: firebaseResult,
      native: { success: false, error: 'Skipped due to Firebase failure' },
    };
  }

  console.log('✅ Firebase save successful');

  // App Clip: Use vCard only (no contacts access available)
  if (isAppClip()) {
    console.log('📱 App Clip: Using vCard fallback');
    const vCardOpened = await openVCard(profile);
    return {
      success: true,
      firebase: firebaseResult,
      native: {
        success: vCardOpened,
        error: vCardOpened ? undefined : 'Failed to open vCard',
        usedVCard: true,
      },
    };
  }

  // Full App: Try native contacts with permission request
  if (!saveToNative) {
    return {
      success: true,
      firebase: firebaseResult,
      native: { success: false, error: 'Skipped by user preference' },
    };
  }

  // Request contacts permission
  const nativeResult = await saveToNativeContacts(profile);

  // If native save succeeded, extract Me Card data for user's profile
  if (nativeResult.success && onMeCardExtracted) {
    console.log('📇 Extracting Me Card data...');
    extractMeCardData().then(meCardData => {
      if (meCardData) {
        console.log('📇 Me Card data extracted');
        onMeCardExtracted(meCardData);
      }
    }).catch(err => {
      console.warn('📇 Failed to extract Me Card:', err);
    });
  }

  // If permission denied, fall back to vCard
  if (!nativeResult.success && nativeResult.error === 'Contacts permission denied') {
    console.log('📱 Permission denied, falling back to vCard');
    const vCardOpened = await openVCard(profile);
    return {
      success: true,
      firebase: firebaseResult,
      native: {
        success: vCardOpened,
        error: vCardOpened ? 'Permission denied, used vCard' : 'Failed to open vCard',
        usedVCard: true,
      },
    };
  }

  return {
    success: true,
    firebase: firebaseResult,
    native: nativeResult,
  };
}

/**
 * Extract Me Card data for auto-filling user's profile
 * Only call this after contacts permission has been granted
 */
export async function extractMeCardData(): Promise<MeCardData | null> {
  try {
    const meCard = await getMeCard();
    if (!meCard) {
      return null;
    }

    const data: MeCardData = {
      firstName: meCard.firstName,
      lastName: meCard.lastName,
      phone: meCard.phoneNumbers?.[0],
      email: meCard.emails?.[0],
    };

    // Get image if available
    if (meCard.hasImage) {
      const imageBase64 = await getMeCardImage();
      if (imageBase64) {
        data.imageBase64 = imageBase64;
      }
    }

    return data;
  } catch (error) {
    console.error('Failed to extract Me Card data:', error);
    return null;
  }
}

/**
 * Prompt user to save contact to their phone
 */
export function promptSaveToContacts(
  profile: UserProfile,
  onSave: () => void,
  onSkip: () => void
): void {
  const name = getFieldValue(profile.contactEntries, 'name') || 'this contact';

  Alert.alert(
    'Save to Contacts',
    `Would you like to add ${name} to your phone's contacts?`,
    [
      { text: 'Skip', style: 'cancel', onPress: onSkip },
      { text: 'Save', onPress: onSave },
    ]
  );
}
