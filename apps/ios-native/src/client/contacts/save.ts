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
  /** file:// URI to a temp JPEG of the Me card photo */
  imageFileUri?: string;
}

/**
 * Generate the Nekt profile URL for a contact
 */
function getContactUrl(profile: UserProfile): string | undefined {
  if (!profile.shortCode) return undefined;
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/c/${profile.shortCode}`;
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
    const bio = getFieldValue(profile.contactEntries, 'bio') || '';
    const contactUrl = getContactUrl(profile);

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Build URL addresses: Nekt link first, then social/custom links
    const urlAddresses: { url: string; label: string }[] = [];
    if (contactUrl) {
      urlAddresses.push({ url: contactUrl, label: 'Nekt' });
    }

    const SOCIAL_URLS: Record<string, { url: string; label: string }> = {
      instagram: { url: 'https://instagram.com/', label: 'Instagram' },
      x: { url: 'https://x.com/', label: 'X' },
      twitter: { url: 'https://twitter.com/', label: 'X' },
      linkedin: { url: 'https://linkedin.com/in/', label: 'LinkedIn' },
      facebook: { url: 'https://facebook.com/', label: 'Facebook' },
      tiktok: { url: 'https://tiktok.com/@', label: 'TikTok' },
      youtube: { url: 'https://youtube.com/@', label: 'YouTube' },
      snapchat: { url: 'https://snapchat.com/add/', label: 'Snapchat' },
      threads: { url: 'https://threads.net/@', label: 'Threads' },
      github: { url: 'https://github.com/', label: 'GitHub' },
      telegram: { url: 'https://t.me/', label: 'Telegram' },
      whatsapp: { url: 'https://wa.me/', label: 'WhatsApp' },
      wechat: { url: 'https://weixin.qq.com/r/', label: 'WeChat' },
    };

    if (profile.contactEntries) {
      for (const entry of profile.contactEntries) {
        if (!entry.value || !entry.isVisible) continue;
        if (['name', 'bio', 'phone', 'email'].includes(entry.fieldType)) continue;

        const social = SOCIAL_URLS[entry.fieldType.toLowerCase()];
        if (social) {
          urlAddresses.push({ url: `${social.url}${entry.value}`, label: social.label });
        } else if (entry.value) {
          // Custom link or unknown type — treat as URL
          let url = entry.value;
          if (!url.toLowerCase().startsWith('http')) {
            url = `https://${url}`;
          }
          try {
            const hostname = new URL(url).hostname.replace('www.', '');
            const domainLabel = hostname.split('.')[0];
            urlAddresses.push({
              url,
              label: domainLabel.charAt(0).toUpperCase() + domainLabel.slice(1),
            });
          } catch {
            // Not a valid URL — skip
          }
        }
      }
    }

    const newContact: Partial<Contact> = {
      givenName: firstName,
      familyName: lastName,
      emailAddresses: email ? [{ label: 'home', email }] : [],
      phoneNumbers: phone ? [{ label: 'mobile', number: phone }] : [],
      urlAddresses,
      note: [
        bio,
        contactUrl
          ? `Added via Nekt on ${new Date().toLocaleDateString()} | ${contactUrl}`
          : `Added via Nekt on ${new Date().toLocaleDateString()}`,
      ].filter(Boolean).join('\n\n'),
    };

    // Set profile image URL — the native iOS Contacts bridge fetches it directly
    if (profile.profileImage) {
      newContact.thumbnailPath = profile.profileImage;
    }

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

    console.log('🔐 [iOS Save] ID Token present:', !!idToken, idToken ? `(length: ${idToken.length})` : '(null)');

    if (!idToken) {
      console.error('🔐 [iOS Save] No ID token available - user may not be signed into Firebase');
      return { success: false, error: 'Not authenticated with Firebase' };
    }

    const response = await fetch(`${apiBaseUrl}/api/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token, skipGoogleContacts: true }),
    });

    if (!response.ok) {
      // Try to get error details from response body
      let errorDetails = '';
      try {
        const errorBody = await response.json();
        errorDetails = errorBody.message || JSON.stringify(errorBody);
        console.error('🔐 [iOS Save] Server error response:', errorBody);
      } catch {
        errorDetails = await response.text().catch(() => 'Unknown error');
      }
      throw new Error(`API request failed: ${response.status} - ${errorDetails}`);
    }

    const result = await response.json();
    console.log('🔐 [iOS Save] Success:', result);
    return result.firebase || { success: true };
  } catch (error) {
    console.error('🔐 [iOS Save] Failed to save to Firebase:', error);
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
    const contactUrl = getContactUrl(profile);
    const vCardOpened = await openVCard(profile, { includePhoto: true, contactUrl });
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
        console.log('📇 Me Card data extracted:', {
          firstName: meCardData.firstName,
          lastName: meCardData.lastName,
          hasPhone: !!meCardData.phone,
          hasEmail: !!meCardData.email,
          hasImage: !!meCardData.imageFileUri,
        });
        onMeCardExtracted(meCardData);
      } else {
        console.log('📇 No Me Card found — is "My Card" configured in iOS Contacts settings?');
      }
    }).catch(err => {
      console.warn('📇 Failed to extract Me Card:', err);
    });
  } else if (nativeResult.success) {
    console.log('📇 Native save succeeded but no onMeCardExtracted callback');
  }

  // If permission denied, fall back to vCard
  if (!nativeResult.success && nativeResult.error === 'Contacts permission denied') {
    console.log('📱 Permission denied, falling back to vCard');
    const contactUrl = getContactUrl(profile);
    const vCardOpened = await openVCard(profile, { includePhoto: true, contactUrl });
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

    // Get image file if available (native module writes to temp JPEG file)
    if (meCard.hasImage) {
      const imageFileUri = await getMeCardImage();
      if (imageFileUri) {
        data.imageFileUri = imageFileUri;
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
  const name = getFieldValue(profile.contactEntries, 'name') || 'They-who-must-not-be-named';

  Alert.alert(
    'Save to Contacts',
    `Would you like to add ${name} to your phone's contacts?`,
    [
      { text: 'Skip', style: 'cancel', onPress: onSkip },
      { text: 'Save', onPress: onSave },
    ]
  );
}
