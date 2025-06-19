/**
 * Redis client using Upstash Redis with in-memory fallback
 */

import { Redis } from '@upstash/redis';

// Initialize Redis using environment variables
// Upstash will automatically use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
// or fallback to KV_REST_API_URL and KV_REST_API_TOKEN
let redis: Redis | null = null;

try {
  redis = Redis.fromEnv();
} catch (error) {
  console.warn('Failed to initialize Upstash Redis:', error);
  redis = null;
}

// Check if Upstash Redis is available
function isRedisAvailable(): boolean {
  return redis !== null;
}

/**
 * Rate limiting with Upstash Redis or fallback
 */
export async function checkRateLimit(
  key: string, 
  limit: number, 
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  try {
    // Use Upstash Redis if available
    if (isRedisAvailable()) {
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

    // Fallback to in-memory rate limiting
    throw new Error('Using fallback rate limiting');
    
  } catch (error) {
    console.warn('Redis rate limiting failed, using fallback:', error);
    // Use fallback in-memory rate limiting
    const { checkRateLimitFallback } = await import('@/lib/services/fallbackExchangeService');
    return checkRateLimitFallback(key, limit, windowMs);
  }
}

/**
 * Store pending exchange with Upstash Redis or fallback
 */
export async function storePendingExchange(
  sessionId: string,
  exchangeData: any,
  ttlSeconds: number = 30
): Promise<void> {
  try {
    // Use Upstash Redis if available
    if (isRedisAvailable()) {
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
      return;
    }

    // Fallback to in-memory storage
    throw new Error('Using fallback storage');
    
  } catch (error) {
    console.warn('Redis storage failed, using fallback:', error);
    const { storePendingExchangeFallback } = await import('@/lib/services/fallbackExchangeService');
    storePendingExchangeFallback(sessionId, exchangeData);
  }
}

/**
 * Find matching exchange with improved time-based + broad geography matching
 */
export async function findMatchingExchange(
  sessionId: string,
  clientIP: string,
  location: { lat: number; lng: number } | null,
  timeWindowMs: number = 1000, // 1 second default
  currentTimestamp?: number
): Promise<{ sessionId: string; matchData: any } | null> {
  try {
    // Use Upstash Redis if available
    if (isRedisAvailable()) {
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
          console.log(`🧹 Cleaning up stale session ${candidateSessionId} from geo bucket`);
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
          const timeDiff = Math.abs(currentTimestamp - candidateData.timestamp);
          console.log(`⏰ Time diff between ${sessionId} and ${candidateSessionId}: ${timeDiff}ms`);
          
          if (timeDiff <= timeWindowMs) {
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

    // Fallback to in-memory matching
    throw new Error('Using fallback matching');
    
  } catch (error) {
    console.warn('Redis matching failed, using fallback:', error);
    const { findMatchingExchangeFallback } = await import('@/lib/services/fallbackExchangeService');
    const fallbackResult = findMatchingExchangeFallback(
      sessionId, 
      { clientIP, location, timeWindowMs, currentTimestamp }
    );
    
    // Convert fallback result to match expected format
    if (fallbackResult) {
      return {
        sessionId: fallbackResult,
        matchData: { userId: 'fallback-user', clientIP }
      };
    }
    return null;
  }
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
 * Store exchange match with Upstash Redis or fallback
 */
export async function storeExchangeMatch(
  token: string,
  sessionA: string,
  sessionB: string,
  userA: any,
  userB: any
): Promise<void> {
  try {
    // Use Upstash Redis if available
    if (isRedisAvailable()) {
      const matchData = {
        sessionA,
        sessionB,
        userA,
        userB,
        createdAt: Date.now()
      };
      
      const key = `exchange_match:${token}`;
      await redis!.setex(key, 600, JSON.stringify(matchData)); // 10 minute expiry
      return;
    }

    // Fallback to in-memory storage
    throw new Error('Using fallback match storage');
    
  } catch (error) {
    console.warn('Redis match storage failed, using fallback:', error);
    const { storeExchangeMatchFallback } = await import('@/lib/services/fallbackExchangeService');
    storeExchangeMatchFallback(token, sessionA, sessionB, userA, userB);
  }
}

/**
 * Get exchange match with Upstash Redis or fallback
 */
export async function getExchangeMatch(token: string): Promise<any | null> {
  try {
    // Use Upstash Redis if available
    if (isRedisAvailable()) {
      const key = `exchange_match:${token}`;
      console.log(`🔍 Getting exchange match for token: ${token}`);
      
      const matchDataStr = await redis!.get(key);
      
      if (!matchDataStr) {
        console.log(`❌ No match found for token: ${token}`);
        return null;
      }
      
      console.log(`📄 Raw match data from Redis:`, typeof matchDataStr, matchDataStr);
      
      // Handle both string and object responses from Redis
      if (typeof matchDataStr === 'string') {
        try {
          const parsed = JSON.parse(matchDataStr);
          console.log(`✅ Successfully parsed match data:`, parsed);
          return parsed;
        } catch (parseError) {
          console.error(`❌ JSON parse error for match data:`, parseError);
          console.error(`❌ Problematic data:`, matchDataStr);
          throw parseError;
        }
      } else {
        console.log(`✅ Match data already an object:`, matchDataStr);
        return matchDataStr; // Already an object
      }
    }

    // Fallback to in-memory storage
    throw new Error('Using fallback match retrieval');
    
  } catch (error) {
    console.warn('Redis match retrieval failed, using fallback:', error);
    const { getExchangeMatchFallback } = await import('@/lib/services/fallbackExchangeService');
    return getExchangeMatchFallback(token);
  }
}

/**
 * Store SSE connection info with Upstash Redis or fallback
 */
export async function storeSseConnection(sessionId: string, data: any): Promise<void> {
  try {
    // Use Upstash Redis if available
    if (isRedisAvailable()) {
      const key = `sse_connection:${sessionId}`;
      await redis!.setex(key, 3600, JSON.stringify(data)); // 1 hour expiry
      return;
    }

    // Fallback to in-memory storage (no-op for now)
    console.log('SSE connection stored in fallback mode:', sessionId);
    
  } catch (error) {
    console.warn('SSE connection storage failed:', error);
  }
}

/**
 * Remove a pending exchange from Redis
 */
export async function removePendingExchange(sessionId: string, clientIP: string): Promise<void> {
  try {
    if (isRedisAvailable()) {
      const key = `pending_exchange:${sessionId}`;
      const ipPrefix = clientIP.split('.').slice(0, 2).join('.');
      const geoBucketKey = `geo_bucket:${ipPrefix}`;
      
      // Remove the pending exchange data
      await redis!.del(key);
      
      // Remove from geographic bucket
      await redis!.srem(geoBucketKey, sessionId);
      
      console.log(`🗑️ Removed pending exchange ${sessionId} from geo bucket ${geoBucketKey}`);
      return;
    }

    // Fallback: no-op (in-memory storage will naturally expire)
    console.log(`🗑️ Fallback: skipping removal for session ${sessionId}`);
    
  } catch (error) {
    console.warn('Redis removal failed:', error);
  }
}

// Legacy functions for compatibility
export async function getRedisClient(): Promise<any> {
  throw new Error('Redis client not used - using Upstash Redis instead');
}

export async function closeRedisConnection(): Promise<void> {
  // No-op since we're using Upstash Redis
}
