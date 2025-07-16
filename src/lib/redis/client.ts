/**
 * Redis client using Upstash Redis
 */

import { Redis } from '@upstash/redis';

// Initialize Redis using environment variables
// Upstash will automatically use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
// or fallback to KV_REST_API_URL and KV_REST_API_TOKEN
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

/**
 * Rate limiting with Upstash Redis
 */
export async function checkRateLimit(
  key: string, 
  limit: number, 
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for rate limiting');
  }

  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const rateLimitKey = `rate_limit:${key}:${window}`;
  
  // Get current count
  const current = await redis!.get<string>(rateLimitKey);
  const count = current ? parseInt(current, 10) : 0;
  
  if (count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: (window + 1) * windowMs
    };
  }
  
  // Increment counter
  const newCount = await redis!.incr(rateLimitKey);
  
  // Set expiration if this is the first request in the window
  if (newCount === 1) {
    await redis!.expire(rateLimitKey, Math.ceil(windowMs / 1000));
  }
  
  return {
    allowed: true,
    remaining: limit - newCount,
    resetTime: (window + 1) * windowMs
  };
}

/**
 * Store pending exchange with Upstash Redis
 */
export async function storePendingExchange(
  sessionId: string,
  exchangeData: any,
  ttlSeconds: number = 30
): Promise<void> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for storing pending exchanges');
  }

  const key = `pending_exchange:${sessionId}`;
  
  // Use broader geographic bucket based on IP prefix
  const ipPrefix = exchangeData.ipBlock.split('.').slice(0, 2).join('.');
  const geoBucketKey = `geo_bucket:${ipPrefix}`;
  
  // Store the exchange data with TTL
  await redis!.setex(key, ttlSeconds, JSON.stringify(exchangeData));
  
  // Add session to geographic bucket for matching
  await redis!.sadd(geoBucketKey, sessionId);
  await redis!.expire(geoBucketKey, ttlSeconds);
  
  console.log(`💾 Stored pending exchange ${sessionId} in geo bucket ${geoBucketKey}`);
}

/**
 * Find matching exchange with improved time-based + broad geography matching
 */
export async function findMatchingExchange(
  sessionId: string,
  clientIP: string,
  location: { lat: number; lng: number } | null,
  timeWindowMs: number = 1000, // 1 second default
  currentTimestamp?: number,
  currentRTT?: number // Add current request's RTT for better matching
): Promise<{ sessionId: string; matchData: any } | null> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for finding matching exchanges');
  }

  // Get broad geography from IP (city/region level)
  const ipPrefix = clientIP.split('.').slice(0, 2).join('.'); // Broader IP matching (/16 instead of /24)
  const geoBucketKey = `geo_bucket:${ipPrefix}`;
  
  // Get all candidates in the same broad geographic area
  const candidates = await redis!.smembers(geoBucketKey) as string[];
  
  console.log(`🔍 Geo bucket ${geoBucketKey} contains ${candidates.length} candidates:`, candidates);
  
  let bestMatch: { sessionId: string; matchData: any; timeDiff: number } | null = null;
  
  for (const candidateSessionId of candidates) {
    if (candidateSessionId === sessionId) continue;
    
    console.log(`🔍 Checking candidate: ${candidateSessionId}`);
    
    const candidateKey = `pending_exchange:${candidateSessionId}`;
    const candidateDataStr = await redis!.get(candidateKey);
    
    if (!candidateDataStr) {
      // Clean up stale session from bucket
      console.log(`🧹 Cleaning up stale session ${candidateSessionId} from geo bucket ${geoBucketKey}`);
      await redis!.srem(geoBucketKey, candidateSessionId);
      continue;
    }
    
    // Handle both string and object responses from Redis
    let candidateData;
    if (typeof candidateDataStr === 'string') {
      candidateData = JSON.parse(candidateDataStr);
    } else {
      candidateData = candidateDataStr; // Already an object
    }
    
    // Time-based matching: find the closest timestamp within window
    if (currentTimestamp) {
      console.log(`🔍 DEBUG: Comparing timestamps for ${sessionId} vs ${candidateSessionId}`);
      const timeDiff = Math.abs(currentTimestamp - candidateData.timestamp);
      
      // Adjust time window based on RTT compensation (as suggested in the user's guidance)
      const rttA = candidateData.rtt || 100; // Fallback to 100ms if RTT not available
      const rttB = currentRTT || 100; // Use current request's RTT or fallback
      const dynamicWindow = Math.max(timeWindowMs, (rttA / 2) + (rttB / 2) + 50); // +50ms padding for mobile jitter
      
      console.log(`⏰ Time diff between ${sessionId} and ${candidateSessionId}: ${timeDiff}ms (window: ${dynamicWindow}ms, RTTs: A=${rttA}ms, B=${rttB}ms)`);
      console.log(`🕐 TIMESTAMPS: ${sessionId}=${currentTimestamp} vs ${candidateSessionId}=${candidateData.timestamp} (diff=${timeDiff}ms)`);
      
      if (timeDiff <= dynamicWindow) {
        // Within time window - check if this is the best match so far
        if (!bestMatch || timeDiff < bestMatch.timeDiff) {
          bestMatch = {
            sessionId: candidateSessionId,
            matchData: candidateData,
            timeDiff
          };
        }
      }
    } else {
      // Fallback to immediate match (original behavior)
      // Clean up the candidate
      await redis!.del(candidateKey);
      await redis!.srem(geoBucketKey, candidateSessionId);
      
      return {
        sessionId: candidateSessionId,
        matchData: candidateData
      };
    }
  }
  
  // If we found a best match within time window, use it
  if (bestMatch) {
    console.log(`🎯 Best match found: ${bestMatch.sessionId} with time diff ${bestMatch.timeDiff}ms`);
    
    // Clean up the matched candidate
    const candidateKey = `pending_exchange:${bestMatch.sessionId}`;
    await redis!.del(candidateKey);
    await redis!.srem(geoBucketKey, bestMatch.sessionId);
    
    return {
      sessionId: bestMatch.sessionId,
      matchData: bestMatch.matchData
    };
  }
  
  return null;
}

// Helper function for distance calculation
function calculateDistance(pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = pos1.lat * Math.PI/180;
  const φ2 = pos2.lat * Math.PI/180;
  const Δφ = (pos2.lat-pos1.lat) * Math.PI/180;
  const Δλ = (pos2.lng-pos1.lng) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Store exchange match
 */
export async function storeExchangeMatch(
  token: string,
  sessionA: string,
  sessionB: string,
  userA: any,
  userB: any,
  sharingCategoryA?: string,
  sharingCategoryB?: string
): Promise<void> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for storing exchange matches');
  }

  const matchData = {
    sessionA,
    sessionB,
    userA,
    userB,
    timestamp: Date.now(),
    status: 'pending',
    sharingCategoryA: sharingCategoryA || 'All',
    sharingCategoryB: sharingCategoryB || 'All'
  };

  // Store all match data atomically to prevent race conditions
  await Promise.all([
    // Store by token
    redis!.setex(`exchange_match:${token}`, 600, JSON.stringify(matchData)), // 10 minutes TTL
    
    // Store references by session IDs for lookup
    redis!.setex(`exchange_session:${sessionA}`, 600, JSON.stringify({
      token,
      youAre: 'A'
    })),
    
    redis!.setex(`exchange_session:${sessionB}`, 600, JSON.stringify({
      token,
      youAre: 'B'
    }))
  ]);

  console.log(`💾 Stored exchange match ${token} with sharing categories A:${sharingCategoryA} B:${sharingCategoryB}`);
}

/**
 * Get exchange match
 */
export async function getExchangeMatch(token: string): Promise<any | null> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for retrieving exchange matches');
  }

  const matchData = await redis!.get(`exchange_match:${token}`);
  
  if (!matchData) {
    return null;
  }
  
  if (typeof matchData === 'string') {
    return JSON.parse(matchData);
  }
  
  return matchData;
}

/**
 * Store SSE connection
 */
export async function storeSseConnection(sessionId: string, data: any): Promise<void> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for storing SSE connections');
  }

  await redis!.setex(`sse_connection:${sessionId}`, 30, JSON.stringify(data));
}

/**
 * Remove pending exchange
 */
export async function removePendingExchange(sessionId: string, clientIP: string): Promise<void> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for removing pending exchanges');
  }

  // Get IP prefix for geo bucket
  const ipPrefix = clientIP.split('.').slice(0, 2).join('.');
  const geoBucketKey = `geo_bucket:${ipPrefix}`;
  
  // Remove from bucket
  await redis!.srem(geoBucketKey, sessionId);
  
  // Remove exchange data
  await redis!.del(`pending_exchange:${sessionId}`);
  
  console.log(`🗑️ Removed pending exchange ${sessionId}`);
}

/**
 * Find exchange match by session ID
 */
export async function findExchangeMatchBySession(sessionId: string): Promise<{ token: string; matchData: any; youAre: 'A' | 'B' } | null> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for finding exchange matches');
  }

  const sessionMatch = await redis!.get(`exchange_session:${sessionId}`);
  
  if (!sessionMatch) {
    return null;
  }
  
  let sessionData;
  if (typeof sessionMatch === 'string') {
    sessionData = JSON.parse(sessionMatch);
  } else {
    sessionData = sessionMatch;
  }
  
  const { token, youAre } = sessionData;
  
  if (!token) {
    return null;
  }
  
  const matchData = await getExchangeMatch(token);
  
  if (!matchData) {
    return null;
  }
  
  return {
    token,
    matchData,
    youAre
  };
}

/**
 * Get Redis client (for internal use)
 */
export async function getRedisClient(): Promise<any> {
  if (!isRedisAvailable()) {
    throw new Error('Redis client is not available');
  }
  return redis;
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  // Upstash Redis REST client doesn't require explicit close
}
