import { Redis } from '@upstash/redis';

// Initialize Redis using environment variables
let redis: Redis | null = null;

try {
  redis = Redis.fromEnv();
} catch (error) {
  console.error('Failed to initialize Upstash Redis:', error);
  redis = null;
}

// Check if Upstash Redis is available
function isRedisAvailable(): boolean {
  return redis !== null;
}

interface IncrementalAuthState {
  userId: string;
  returnUrl: string;
  contactSaveToken: string;
  profileId: string;
  timestamp: number;
}

interface ContactsTokenData {
  accessToken: string;
  refreshToken?: string;
  timestamp: number;
}

/**
 * Store incremental auth state temporarily during OAuth flow
 */
export async function storeIncrementalAuthState(state: string, data: IncrementalAuthState): Promise<void> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for incremental auth');
  }

  try {
    await redis!.setex(`incremental_auth_state:${state}`, 600, JSON.stringify(data)); // 10 minutes
    console.log(`✅ Stored incremental auth state: ${state}`);
  } catch (error) {
    console.error('❌ Failed to store incremental auth state:', error);
    throw error;
  }
}

/**
 * Retrieve incremental auth state
 */
export async function getIncrementalAuthState(state: string): Promise<IncrementalAuthState | null> {
  if (!isRedisAvailable()) {
    console.error('❌ Redis is not available for incremental auth');
    return null;
  }

  try {
    const data = await redis!.get(`incremental_auth_state:${state}`);
    
    if (!data) {
      console.warn(`⚠️ No incremental auth state found for: ${state}`);
      return null;
    }
    
    // Handle both string and object responses from Redis
    let parsedData: IncrementalAuthState;
    if (typeof data === 'string') {
      parsedData = JSON.parse(data);
    } else {
      parsedData = data as IncrementalAuthState;
    }
    
    // Check if state is expired (older than 10 minutes)
    if (Date.now() - parsedData.timestamp > 600000) {
      console.warn(`⚠️ Incremental auth state expired: ${state}`);
      await deleteIncrementalAuthState(state);
      return null;
    }
    
    return parsedData;
  } catch (error) {
    console.error('❌ Failed to get incremental auth state:', error);
    return null;
  }
}

/**
 * Delete incremental auth state after use
 */
export async function deleteIncrementalAuthState(state: string): Promise<void> {
  if (!isRedisAvailable()) {
    return; // Silently fail if Redis is not available
  }

  try {
    await redis!.del(`incremental_auth_state:${state}`);
    console.log(`✅ Deleted incremental auth state: ${state}`);
  } catch (error) {
    console.error('❌ Failed to delete incremental auth state:', error);
    // Don't throw - this is cleanup
  }
}

/**
 * Store Google Contacts access token for a user
 */
export async function storeContactsAccessToken(
  userId: string, 
  accessToken: string, 
  refreshToken?: string
): Promise<void> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for storing contacts token');
  }

  try {
    const tokenData: ContactsTokenData = {
      accessToken,
      refreshToken,
      timestamp: Date.now()
    };
    
    // Store for 50 minutes (Google tokens last 1 hour, but we want buffer)
    await redis!.setex(`contacts_token:${userId}`, 3000, JSON.stringify(tokenData));
    console.log(`✅ Stored contacts access token for user: ${userId}`);
  } catch (error) {
    console.error('❌ Failed to store contacts access token:', error);
    throw error;
  }
}

/**
 * Get Google Contacts access token for a user
 */
export async function getContactsAccessToken(userId: string): Promise<string | null> {
  if (!isRedisAvailable()) {
    console.error('❌ Redis is not available for getting contacts token');
    return null;
  }

  try {
    const data = await redis!.get(`contacts_token:${userId}`);
    
    if (!data) {
      console.log(`ℹ️ No contacts access token found for user: ${userId}`);
      return null;
    }
    
    // Handle both string and object responses from Redis
    let tokenData: ContactsTokenData;
    if (typeof data === 'string') {
      tokenData = JSON.parse(data);
    } else {
      tokenData = data as ContactsTokenData;
    }
    
    // Check if token is expired (older than 50 minutes)
    if (Date.now() - tokenData.timestamp > 3000000) {
      console.warn(`⚠️ Contacts access token expired for user: ${userId}`);
      await deleteContactsAccessToken(userId);
      return null;
    }
    
    return tokenData.accessToken;
  } catch (error) {
    console.error('❌ Failed to get contacts access token:', error);
    return null;
  }
}

/**
 * Delete Google Contacts access token for a user
 */
export async function deleteContactsAccessToken(userId: string): Promise<void> {
  if (!isRedisAvailable()) {
    return; // Silently fail if Redis is not available
  }

  try {
    await redis!.del(`contacts_token:${userId}`);
    console.log(`✅ Deleted contacts access token for user: ${userId}`);
  } catch (error) {
    console.error('❌ Failed to delete contacts access token:', error);
    // Don't throw - this is cleanup
  }
}

 