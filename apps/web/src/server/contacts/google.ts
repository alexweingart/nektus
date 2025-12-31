/**
 * Google Contacts API service for saving contacts to user's Google Contacts
 */

import type { UserProfile } from '@/types/profile';
import { getFieldValue, generateSocialUrl } from '@/client/profile/transforms';

interface GoogleContactsCreateResponse {
  success: boolean;
  contactId?: string;
  error?: string;
}

interface GoogleContactsPhotoResponse {
  success: boolean;
  error?: string;
}

/**
 * Creates a contact in Google Contacts using the People API
 */
export async function createGoogleContact(
  accessToken: string, 
  profile: UserProfile
): Promise<GoogleContactsCreateResponse> {
  try {
    // Format the contact data for Google People API
    const contactData = {
      names: [
        {
          givenName: getFieldValue(profile.contactEntries, 'name').split(' ')[0] || getFieldValue(profile.contactEntries, 'name'),
          familyName: getFieldValue(profile.contactEntries, 'name').split(' ').slice(1).join(' ') || '',
        }
      ],
      emailAddresses: (() => {
        const emailEntry = profile.contactEntries?.find(e => e.fieldType === 'email');
        return emailEntry?.value ? [
          {
            value: emailEntry.value,
            type: 'other'
          }
        ] : [];
      })(),
      phoneNumbers: (() => {
        const phoneEntry = profile.contactEntries?.find(e => e.fieldType === 'phone');
        return phoneEntry?.value ? [
          {
            value: phoneEntry.value,
            type: 'mobile'
          }
        ] : [];
      })(),
      biographies: getFieldValue(profile.contactEntries, 'bio') ? [
        {
          value: getFieldValue(profile.contactEntries, 'bio'),
          contentType: 'TEXT_PLAIN'
        }
      ] : [],
      urls: [] as Array<{ value: string; type: string }>
    };

    // Add social media URLs from contactEntries
    const socialEntries = profile.contactEntries || [];
    const socialPlatforms = ['instagram', 'linkedin', 'x', 'facebook', 'snapchat'];
    
    socialPlatforms.forEach(platform => {
      const entry = socialEntries.find(e => e.fieldType === platform);
      if (entry?.value) {
        // Generate the URL for the social platform
        const url = generateSocialUrl(platform, entry.value);
        if (url) {
          contactData.urls.push({ value: url, type: 'other' });
        }
      }
    });

    const response = await fetch('https://people.googleapis.com/v1/people:createContact', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Google Contacts API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Contact created in Google Contacts:', result.resourceName);

    return {
      success: true,
      contactId: result.resourceName
    };

  } catch (error) {
    console.error('❌ Failed to create Google contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Updates a contact's photo in Google Contacts
 */
export async function updateGoogleContactPhoto(
  accessToken: string,
  contactId: string,
  photoUrl: string
): Promise<GoogleContactsPhotoResponse> {
  try {
    if (!photoUrl || !contactId) {
      return { success: true }; // No photo to update
    }

    // Download the photo and convert to base64
    const photoResponse = await fetch(photoUrl);
    if (!photoResponse.ok) {
      throw new Error('Failed to download profile photo');
    }

    const photoBuffer = await photoResponse.arrayBuffer();
    const base64Photo = btoa(String.fromCharCode(...new Uint8Array(photoBuffer)));

    const response = await fetch(`https://people.googleapis.com/v1/${contactId}:updateContactPhoto`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photoBytes: base64Photo
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Photo update error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    console.log('✅ Contact photo updated in Google Contacts');
    return { success: true };

  } catch (error) {
    console.error('⚠️ Failed to update Google contact photo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Photo update failed'
    };
  }
}

/**
 * Main function to save a contact to Google Contacts
 */
export async function saveToGoogleContacts(
  accessToken: string,
  profile: UserProfile
): Promise<GoogleContactsCreateResponse> {
  const createResult = await createGoogleContact(accessToken, profile);

  if (!createResult.success || !createResult.contactId) {
    return createResult;
  }

  // Fire-and-forget photo upload in background (non-blocking)
  if (profile.profileImage) {
    updateGoogleContactPhoto(
      accessToken,
      createResult.contactId,
      profile.profileImage
    ).then(photoResult => {
      if (photoResult.success) {
        console.log('✅ Photo uploaded successfully in background');
      } else {
        console.warn('⚠️ Background photo upload failed:', photoResult.error);
      }
    }).catch(err => {
      console.error('❌ Background photo upload error:', err);
    });
  }

  return createResult;
}
