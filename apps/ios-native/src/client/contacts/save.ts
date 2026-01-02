/**
 * Contact save service for iOS
 * Adapted from: apps/web/src/client/contacts/save.ts
 *
 * Changes from web:
 * - Uses react-native-contacts for native contact saving
 * - Simplified flow (no Google Contacts integration on iOS)
 * - Firebase-only save with optional native contacts
 */

import Contacts, { Contact } from 'react-native-contacts';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import type { UserProfile } from '@nektus/shared-types';
import { getApiBaseUrl, getIdToken } from '../auth/firebase';
import { getFieldValue } from '@nektus/shared-client';

export interface ContactSaveResult {
  success: boolean;
  firebase: { success: boolean; error?: string };
  native: { success: boolean; error?: string };
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
 */
export async function saveContactFlow(
  profile: UserProfile,
  token: string,
  saveToNative: boolean = true
): Promise<ContactSaveResult> {
  console.log('🔍 Starting iOS contact save flow');

  // Save to Firebase first
  const firebaseResult = await saveToFirebase(token);

  if (!firebaseResult.success) {
    return {
      success: false,
      firebase: firebaseResult,
      native: { success: false, error: 'Skipped due to Firebase failure' },
    };
  }

  // Optionally save to native contacts
  let nativeResult: { success: boolean; error?: string } = { success: false, error: 'Skipped' };
  if (saveToNative) {
    nativeResult = await saveToNativeContacts(profile);
  }

  return {
    success: true,
    firebase: firebaseResult,
    native: nativeResult,
  };
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
