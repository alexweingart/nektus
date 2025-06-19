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
      const ipBucketKey = `ip_bucket:${exchangeData.clientIP}`;
      
      // Store the exchange data with TTL
      await redis!.setex(key, ttlSeconds, JSON.stringify(exchangeData));
      
      // Add session to IP bucket for matching
      await redis!.sadd(ipBucketKey, sessionId);
      await redis!.expire(ipBucketKey, ttlSeconds);
      return;
    }

    // Fallback to in-memory storage
    throw new Error('Using fallback storage');
    
  } catch (error) {
    console.warn('Redis storage failed, using fallback:', error);
    const { storePendingExchangeFallback } = await import('@/lib/services/fallbackExchangeService');
    storePendingExchangeFallback(sessionId, exchangeData, ttlSeconds);
  }
}

/**
 * Find matching exchange with Upstash Redis or fallback
 */
export async function findMatchingExchange(
  sessionId: string,
  clientIP: string,
  location: { lat: number; lng: number } | null,
  toleranceMeters: number = 50
): Promise<{ sessionId: string; matchData: any } | null> {
  try {
    // Use Upstash Redis if available
    if (isRedisAvailable()) {
      const ipBucketKey = `ip_bucket:${clientIP}`;
      
      // Get all candidates with the same IP
      const candidates = await redis!.smembers(ipBucketKey) as string[];
      
      for (const candidateSessionId of candidates) {
        if (candidateSessionId === sessionId) continue;
        
        const candidateKey = `pending_exchange:${candidateSessionId}`;
        const candidateDataStr = await redis!.get<string>(candidateKey);
        
        if (!candidateDataStr) {
          // Clean up stale session from bucket
          await redis!.srem(ipBucketKey, candidateSessionId);
          continue;
        }
        
        const candidateData = JSON.parse(candidateDataStr);
        
        // Check location tolerance if both have locations
        if (location && candidateData.location) {
          const distance = calculateDistance(location, candidateData.location);
          if (distance > toleranceMeters) {
            continue;
          }
        }
        
        // Found a match! Clean up the candidate
        await redis!.del(candidateKey);
        await redis!.srem(ipBucketKey, candidateSessionId);
        
        return {
          sessionId: candidateSessionId,
          matchData: candidateData
        };
      }
      
      return null;
    }

    // Fallback to in-memory matching
    throw new Error('Using fallback matching');
    
  } catch (error) {
    console.warn('Redis matching failed, using fallback:', error);
    const { findMatchingExchangeFallback } = await import('@/lib/services/fallbackExchangeService');
    return findMatchingExchangeFallback(sessionId, clientIP, location, toleranceMeters);
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
      const matchDataStr = await redis!.get<string>(key);
      
      if (!matchDataStr) {
        return null;
      }
      
      return JSON.parse(matchDataStr);
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

// Legacy functions for compatibility
export async function getRedisClient(): Promise<any> {
  throw new Error('Redis client not used - using Upstash Redis instead');
}

export async function closeRedisConnection(): Promise<void> {
  // No-op since we're using Upstash Redis
}
