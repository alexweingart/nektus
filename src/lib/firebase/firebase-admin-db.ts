// Calendar-specific Firebase Admin DB helpers for CalConnect merge
import { getFirebaseAdmin } from './adminConfig';
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
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.error(`User with ID ${userId} not found`);
      return null;
    }

    const userData = userDoc.data();
    return userData?.email || null;
  } catch (error) {
    console.error('Error fetching user email by ID (admin):', error);
    return null;
  }
};

export const adminGetUserTimezoneById = async (userId: string): Promise<string | null> => {
  try {
    const { db } = await getFirebaseAdmin();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.error(`User with ID ${userId} not found`);
      return null;
    }

    const userData = userDoc.data();
    return userData?.timezone || null;
  } catch (error) {
    console.error('Error fetching user timezone by ID (admin):', error);
    return null;
  }
};

// Batch function to get all user data for multiple users in parallel
export const adminGetMultipleUserData = async (userIds: string[]) => {
  try {
    console.log(`📊 Batching data for ${userIds.length} users: ${userIds.join(', ')}`);

    // Step 1: Get all user emails in parallel
    const userEmailPromises = userIds.map(id => adminGetUserEmailById(id));
    const userEmails = await Promise.all(userEmailPromises);

    // Step 2: Filter out null emails and create user data map
    const validUsers: Array<{ userId: string; email: string }> = [];
    userIds.forEach((userId, index) => {
      const email = userEmails[index];
      if (email) {
        validUsers.push({ userId, email });
      }
    });

    if (validUsers.length === 0) {
      console.warn('No valid users found');
      return {};
    }

    // Step 3: Get tokens and providers for all valid users in parallel
    const dataPromises = validUsers.flatMap(({ email }) => [
      adminGetCalendarTokens(email),
      adminGetUserCalendarProviders(email).catch(() => []) // Fallback to empty array
    ]);

    const allResults = await Promise.all(dataPromises);

    // Step 4: Structure the results back into user-keyed format
    const userData: Record<string, {
      email: string;
      tokens: CalendarTokens[];
      providers: Calendar[];
    }> = {};

    validUsers.forEach(({ userId, email }, index) => {
      const tokensIndex = index * 2;
      const providersIndex = index * 2 + 1;

      userData[userId] = {
        email,
        tokens: allResults[tokensIndex] as CalendarTokens[],
        providers: allResults[providersIndex] as Calendar[]
      };
    });

    console.log(`✅ Batched data retrieval complete for ${Object.keys(userData).length} users`);
    return userData;

  } catch (error) {
    console.error('Error in batch user data retrieval:', error);
    return {};
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
