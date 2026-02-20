// Calendar-specific Firebase Admin DB helpers for CalConnect merge
import { getFirebaseAdmin } from '@/server/config/firebase';
import type { Calendar, SchedulableHours, CalendarTokens } from '@/types';

// Calendar Provider Functions (Admin SDK)
export const adminGetUserCalendarProviders = async (userEmail: string): Promise<Calendar[]> => {
  try {
    const { db } = await getFirebaseAdmin();
    const snapshot = await db
      .collection('calendarProviders')
      .where('userEmail', '==', userEmail)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { createdAt: _createdAt, updatedAt: _updatedAt, userEmail: _userEmail, ...calendarData } = data;
      return {
        ...calendarData,
        id: doc.id,
      } as Calendar;
    });
  } catch (error) {
    console.error('Error fetching user calendar providers (admin):', error);
    return [];
  }
};

export const adminGetCalendarProviderByUserAndType = async (
  userEmail: string,
  provider: 'google' | 'microsoft' | 'apple'
): Promise<Calendar | null> => {
  try {
    const { db } = await getFirebaseAdmin();
    const snapshot = await db
      .collection('calendarProviders')
      .where('userEmail', '==', userEmail)
      .where('type', '==', provider)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { createdAt: _createdAt, updatedAt: _updatedAt, userEmail: _userEmail, ...calendarData } = data;
    return {
      ...calendarData,
      id: doc.id,
    } as Calendar;
  } catch (error) {
    console.error('Error fetching calendar provider (admin):', error);
    return null;
  }
};

// Calendar Tokens Functions (Admin SDK)
export const adminGetCalendarTokens = async (userEmail: string): Promise<CalendarTokens[]> => {
  try {
    const { db } = await getFirebaseAdmin();
    const snapshot = await db
      .collection('calendarTokens')
      .where('userEmail', '==', userEmail)
      .get();

    const tokens: CalendarTokens[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const tokenData: CalendarTokens = {
        email: data.email,
        provider: data.provider,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt?.toDate(),
      };

      // Only add Apple-specific fields if they exist and have valid values
      if (data.appleId && typeof data.appleId === 'string' && data.appleId.trim() !== '') {
        tokenData.appleId = data.appleId;
      }
      if (data.appSpecificPassword && typeof data.appSpecificPassword === 'string' && data.appSpecificPassword.trim() !== '') {
        tokenData.appSpecificPassword = data.appSpecificPassword;
      }

      tokens.push(tokenData);
    });

    console.log(`Found ${tokens.length} calendar tokens for user: ${userEmail} (admin)`);
    return tokens;
  } catch (error) {
    console.error('Error fetching calendar tokens (admin):', error);
    return [];
  }
};

export const adminGetValidTokensForProvider = async (
  userEmail: string,
  provider: 'google' | 'microsoft' | 'apple'
): Promise<CalendarTokens[]> => {
  const allTokens = await adminGetCalendarTokens(userEmail);
  const providerTokens = allTokens.filter(t => t.provider === provider);

  // For now, return as-is. Later we can add refresh logic if needed
  return providerTokens;
};

export const adminHasValidTokens = async (
  userEmail: string,
  provider?: 'google' | 'microsoft' | 'apple'
): Promise<boolean> => {
  const allTokens = await adminGetCalendarTokens(userEmail);

  if (provider) {
    return allTokens.some(t => t.provider === provider);
  }

  return allTokens.length > 0;
};

// Update Microsoft tokens after refresh
export const adminUpdateMicrosoftTokens = async (
  userEmail: string,
  accessToken: string,
  expiresAt: Date
): Promise<boolean> => {
  try {
    const { db } = await getFirebaseAdmin();
    const snapshot = await db
      .collection('calendarTokens')
      .where('userEmail', '==', userEmail)
      .where('provider', '==', 'microsoft')
      .get();

    if (snapshot.empty) {
      console.warn(`No Microsoft tokens found for user: ${userEmail}`);
      return false;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        accessToken,
        expiresAt,
        updatedAt: new Date(),
      });
    });

    await batch.commit();
    console.log(`Updated Microsoft tokens for user: ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Error updating Microsoft tokens (admin):', error);
    return false;
  }
};

// Update Google tokens after refresh
export const adminUpdateGoogleTokens = async (
  userEmail: string,
  accessToken: string,
  expiresAt: Date
): Promise<boolean> => {
  try {
    const { db } = await getFirebaseAdmin();
    const snapshot = await db
      .collection('calendarTokens')
      .where('userEmail', '==', userEmail)
      .where('provider', '==', 'google')
      .get();

    if (snapshot.empty) {
      console.warn(`No Google tokens found for user: ${userEmail}`);
      return false;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        accessToken,
        expiresAt,
        updatedAt: new Date(),
      });
    });

    await batch.commit();
    console.log(`Updated Google tokens for user: ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Error updating Google tokens (admin):', error);
    return false;
  }
};

// Helper function to get user email from user ID
export const adminGetUserEmailById = async (userId: string): Promise<string | null> => {
  try {
    const { db } = await getFirebaseAdmin();
    const profileDoc = await db.collection('profiles').doc(userId).get();

    if (!profileDoc.exists) {
      console.error(`Profile with ID ${userId} not found`);
      return null;
    }

    const profileData = profileDoc.data();
    // Extract email from contactEntries array
    const emailEntry = profileData?.contactEntries?.find((entry: { fieldType: string }) => entry.fieldType === 'email');
    const email = emailEntry?.value || null;

    if (!email) {
      console.error(`No email found in profile for user ${userId}`);
    }

    return email;
  } catch (error) {
    console.error('Error fetching user email by ID (admin):', error);
    return null;
  }
};

export const adminGetUserTimezoneById = async (userId: string): Promise<string | null> => {
  try {
    const { db } = await getFirebaseAdmin();
    console.log(`[adminGetUserTimezoneById] Fetching timezone for user: ${userId}`);
    const profileDoc = await db.collection('profiles').doc(userId).get();

    if (!profileDoc.exists) {
      console.error(`[adminGetUserTimezoneById] Profile with ID ${userId} not found`);
      return null;
    }

    const profileData = profileDoc.data();
    console.log(`[adminGetUserTimezoneById] Profile data keys:`, Object.keys(profileData || {}));
    console.log(`[adminGetUserTimezoneById] Timezone value:`, profileData?.timezone);
    const timezone = profileData?.timezone || null;
    console.log(`[adminGetUserTimezoneById] Returning timezone:`, timezone);
    return timezone;
  } catch (error) {
    console.error('[adminGetUserTimezoneById] Error fetching user timezone by ID:', error);
    return null;
  }
};

// Batch function to get all user data for multiple users in parallel
export const adminGetMultipleUserData = async (userIds: string[]) => {
  try {
    console.log(`📊 Batching data for ${userIds.length} users: ${userIds.join(', ')}`);

    const { db } = await getFirebaseAdmin();

    // Get all profile documents in parallel
    const profilePromises = userIds.map(id => db.collection('profiles').doc(id).get());
    const profileDocs = await Promise.all(profilePromises);

    const userData: Record<string, {
      email: string;
      tokens: CalendarTokens[];
      providers: Calendar[];
      deviceBusyTimes?: { slots: { start: string; end: string }[]; updatedAt: number; windowStart: string; windowEnd: string };
      timezone?: string;
    }> = {};

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const profileDoc = profileDocs[i];

      if (!profileDoc.exists) {
        console.warn(`Profile not found for user ${userId}`);
        continue;
      }

      const profileData = profileDoc.data();

      // Extract email from contactEntries
      const emailEntry = profileData?.contactEntries?.find((entry: { fieldType: string }) => entry.fieldType === 'email');
      const email = emailEntry?.value;

      if (!email) {
        console.warn(`No email found for user ${userId}`);
        continue;
      }

      // Get calendars from profile.calendars array
      const calendars = profileData?.calendars || [];

      // Convert profile calendars to CalendarTokens format
      const tokens: CalendarTokens[] = calendars
        .filter((cal: { accessToken?: string }) => cal.accessToken) // Only include calendars with tokens
        .map((cal: { email?: string; provider: string; accessToken: string; refreshToken?: string; tokenExpiry?: string }) => {
          console.log(`[adminGetMultipleUserData] User ${userId} calendar ${cal.provider} - has refreshToken: ${!!cal.refreshToken}, refreshToken length: ${cal.refreshToken?.length || 0}`);
          return {
            email: cal.email || email,
            provider: cal.provider,
            accessToken: cal.accessToken,
            refreshToken: cal.refreshToken,
            expiresAt: cal.tokenExpiry ? new Date(cal.tokenExpiry) : undefined,
          };
        });

      userData[userId] = {
        email,
        tokens,
        providers: calendars, // Use the calendars from profile as providers
        deviceBusyTimes: profileData?.deviceBusyTimes || undefined,
        timezone: profileData?.timezone || undefined,
      };
    }

    console.log(`✅ Batched data retrieval complete for ${Object.keys(userData).length} users`);
    return userData;

  } catch (error) {
    console.error('Error in batch user data retrieval:', error);
    return {};
  }
};

/**
 * Update calendar tokens in a user's profile after token refresh
 * This is the Nektus-specific version that updates profile.calendars array
 */
export const adminUpdateCalendarTokens = async (
  userId: string,
  provider: string,
  accessToken: string,
  expiresAt: Date,
  refreshToken?: string
): Promise<boolean> => {
  try {
    const { db } = await getFirebaseAdmin();
    const profileRef = db.collection('profiles').doc(userId);
    const profileDoc = await profileRef.get();

    if (!profileDoc.exists) {
      console.error(`Profile not found for user ${userId}`);
      return false;
    }

    const profileData = profileDoc.data();
    const calendars = profileData?.calendars || [];

    // Find the calendar with matching provider
    const calendarIndex = calendars.findIndex((cal: { provider: string }) => cal.provider === provider);

    if (calendarIndex === -1) {
      console.error(`Calendar with provider ${provider} not found for user ${userId}`);
      return false;
    }

    // Update the calendar tokens
    calendars[calendarIndex].accessToken = accessToken;
    calendars[calendarIndex].tokenExpiry = expiresAt.toISOString();
    if (refreshToken) {
      calendars[calendarIndex].refreshToken = refreshToken;
    }

    // Save back to Firestore
    await profileRef.update({ calendars });

    console.log(`✅ Updated ${provider} tokens for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error updating calendar tokens:', error);
    return false;
  }
};

// Helper function to get default schedulable hours
export const adminGetDefaultSchedulableHours = (category: 'work' | 'personal'): SchedulableHours => {
  if (category === 'work') {
    return {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [],
      sunday: [],
    };
  } else {
    return {
      monday: [{ start: '10:00', end: '22:00' }],
      tuesday: [{ start: '10:00', end: '22:00' }],
      wednesday: [{ start: '10:00', end: '22:00' }],
      thursday: [{ start: '10:00', end: '22:00' }],
      friday: [{ start: '10:00', end: '22:00' }],
      saturday: [{ start: '08:00', end: '22:00' }],
      sunday: [{ start: '08:00', end: '22:00' }],
    };
  }
};
