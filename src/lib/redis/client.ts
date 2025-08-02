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
export function isRedisAvailable(): boolean {
  return redis !== null;
}

// Export redis instance for use in other modules
export { redis };

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
  
  // Use single global bucket for all exchanges
  const globalBucketKey = 'geo_bucket:global';
  
  // Store the exchange data with TTL
  await redis!.setex(key, ttlSeconds, JSON.stringify(exchangeData));
  
  // Add session to global bucket for matching
  await redis!.sadd(globalBucketKey, sessionId);
  await redis!.expire(globalBucketKey, ttlSeconds);
  
  console.log(`💾 Stored pending exchange ${sessionId} in global bucket (VPN: ${exchangeData.location?.isVPN}, confidence: ${exchangeData.location?.confidence})`);
}

/**
 * Atomically store exchange and find matches using Redis transaction
 * This prevents race conditions when multiple exchanges arrive simultaneously
 */
export async function atomicExchangeAndMatch(
  sessionId: string,
  exchangeData: any,
  currentLocation: any,
  currentTimestamp?: number,
  ttlSeconds: number = 30
): Promise<{ sessionId: string; matchData: any } | null> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for atomic exchange operations');
  }

  const globalBucketKey = 'geo_bucket:global';
  const exchangeKey = `pending_exchange:${sessionId}`;
  
  // Check if this session already exists (multiple hits from same session)
  const existingExchangeData = await redis!.get(exchangeKey);
  const sessionAlreadyExists = !!existingExchangeData;
  
  // First, get current candidates before our transaction
  const currentCandidates = await redis!.smembers(globalBucketKey) as string[];
  console.log(`🔍 Pre-transaction: Global bucket contains ${currentCandidates.length} candidates:`, currentCandidates);
  
  if (sessionAlreadyExists) {
    console.log(`🔄 Session ${sessionId} already exists - using existing data for comparison, not overwriting yet`);
  } else {
    // Start Redis transaction - only store if session doesn't exist
    const pipeline = redis!.multi();
    
    // Store our exchange first (part of transaction)
    pipeline.setex(exchangeKey, ttlSeconds, JSON.stringify(exchangeData));
    pipeline.sadd(globalBucketKey, sessionId);
    pipeline.expire(globalBucketKey, ttlSeconds);
    
    // Execute the transaction atomically
    await pipeline.exec();
    console.log(`💾 Atomically stored exchange ${sessionId} in global bucket`);
  }
  
  // Now check for matches among the candidates that existed before our addition
  let bestMatch: { sessionId: string; matchData: any; timeDiff: number; confidence: string } | null = null;
  
  for (const candidateSessionId of currentCandidates) {
    if (candidateSessionId === sessionId) continue;
    
    console.log(`🔍 Checking pre-existing candidate: ${candidateSessionId}`);
    
    const candidateKey = `pending_exchange:${candidateSessionId}`;
    const candidateDataStr = await redis!.get(candidateKey);
    
    if (!candidateDataStr) {
      // Clean up stale session from bucket
      console.log(`🧹 Cleaning up stale session ${candidateSessionId} from global bucket`);
      await redis!.srem(globalBucketKey, candidateSessionId);
      continue;
    }
    
    // Handle both string and object responses from Redis
    let candidateData;
    if (typeof candidateDataStr === 'string') {
      candidateData = JSON.parse(candidateDataStr);
    } else {
      candidateData = candidateDataStr; // Already an object
    }
    
    // Geographic confidence-based matching
    if (currentTimestamp && currentLocation && candidateData.location) {
      console.log(`🔍 Geographic comparison: ${sessionId} vs ${candidateSessionId}`);
      
      if (!candidateData.timestamp) {
        console.log(`❌ Candidate ${candidateSessionId} has no timestamp, skipping`);
        continue;
      }
      
      try {
        const timeDiff = Math.abs(currentTimestamp - candidateData.timestamp);
        
        console.log(`🔍 Starting geographic comparison for ${candidateSessionId}`);
        console.log(`🔍 Current location:`, currentLocation);
        console.log(`🔍 Candidate location:`, candidateData.location);
        
        if (!currentLocation || !candidateData.location) {
          console.log(`❌ Missing location data - current: ${!!currentLocation}, candidate: ${!!candidateData.location}`);
          continue;
        }
        
        // Import and use the geographic matching logic
        const { getMatchConfidence } = await import('@/lib/services/server/ipGeolocationService');
        
        const matchInfo = getMatchConfidence(currentLocation, candidateData.location);
        console.log(`🔍 Match info result:`, matchInfo);
        
        console.log(`📍 Geographic match: ${matchInfo.confidence} (${matchInfo.timeWindow}ms window)`);
        console.log(`⏰ Time diff: ${timeDiff}ms (${timeDiff <= matchInfo.timeWindow ? 'WITHIN' : 'OUTSIDE'} window)`);
        console.log(`🕐 Locations: ${JSON.stringify({
          current: { city: currentLocation.city, state: currentLocation.state, isVPN: currentLocation.isVPN },
          candidate: { city: candidateData.location.city, state: candidateData.location.state, isVPN: candidateData.location.isVPN }
        })}`);
        console.log(`📊 Timestamps: current=${currentTimestamp}, candidate=${candidateData.timestamp}, diff=${timeDiff}ms`);
        
        if (matchInfo.confidence === 'no_match') {
          console.log(`❌ No geographic overlap between ${sessionId} and ${candidateSessionId}`);
          continue;
        }
        
        if (timeDiff <= matchInfo.timeWindow) {
          console.log(`✅ TIMING MATCH: ${timeDiff}ms ≤ ${matchInfo.timeWindow}ms window for ${matchInfo.confidence} match`);
          // Within time window - check if this is the best match so far
          // Priority: 1. Same city > 2. Same state > 3. Same octet > 4. VPN
          // Within same confidence level, prefer shorter time gap
          const confidenceRank: Record<string, number> = { city: 4, state: 3, octet: 2, vpn: 1 };
          const currentRank = confidenceRank[matchInfo.confidence];
          const bestRank = bestMatch ? confidenceRank[bestMatch.confidence] : 0;
          
          if (!bestMatch || currentRank > bestRank || 
              (currentRank === bestRank && timeDiff < bestMatch.timeDiff)) {
            bestMatch = {
              sessionId: candidateSessionId,
              matchData: candidateData,
              timeDiff,
              confidence: matchInfo.confidence
            };
          }
        } else {
          console.log(`❌ TIMING FAILED: ${timeDiff}ms > ${matchInfo.timeWindow}ms window for ${matchInfo.confidence} match`);
        }
      } catch (error) {
        console.log(`❌ Error in geographic matching for ${candidateSessionId}:`, error);
        continue;
      }
    } else {
      // Fallback to immediate match (original behavior)
      // We found a match - clean up both exchanges atomically
      const cleanupPipeline = redis!.multi();
      cleanupPipeline.del(candidateKey);
      cleanupPipeline.srem(globalBucketKey, candidateSessionId);
      cleanupPipeline.del(exchangeKey); // Also remove our just-stored exchange
      cleanupPipeline.srem(globalBucketKey, sessionId);
      await cleanupPipeline.exec();
      
      return {
        sessionId: candidateSessionId,
        matchData: candidateData
      };
    }
  }
  
  // If we found a best match within time window, use it
  if (bestMatch) {
    console.log(`🎯 Best match found: ${bestMatch.sessionId} with time diff ${bestMatch.timeDiff}ms (confidence: ${bestMatch.confidence})`);
    
    // Clean up both the matched candidate and our exchange atomically
    const cleanupPipeline = redis!.multi();
    cleanupPipeline.del(`pending_exchange:${bestMatch.sessionId}`);
    cleanupPipeline.srem(globalBucketKey, bestMatch.sessionId);
    cleanupPipeline.del(exchangeKey); // Also remove our just-stored exchange
    cleanupPipeline.srem(globalBucketKey, sessionId);
    await cleanupPipeline.exec();
    
    return {
      sessionId: bestMatch.sessionId,
      matchData: bestMatch.matchData
    };
  }
  
  // No match found - now it's safe to update exchange data if session already existed
  if (sessionAlreadyExists) {
    console.log(`🔄 No match found, now updating existing session ${sessionId} with newer data`);
    await redis!.setex(exchangeKey, ttlSeconds, JSON.stringify(exchangeData));
    console.log(`💾 Updated exchange ${sessionId} with newer timestamp`);
  }
  
  console.log(`⏳ No match found, exchange ${sessionId} remains in bucket for future matching`);
  return null;
}

/**
 * Legacy function - now just calls atomicExchangeAndMatch for backwards compatibility
 */
export async function findMatchingExchange(
  sessionId: string,
  currentLocation: any,
  currentTimestamp?: number,
  currentRTT?: number
): Promise<{ sessionId: string; matchData: any } | null> {
  // This is now just a wrapper - the real logic is in the hit endpoint
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
 * Clean up all pending exchanges for a specific user
 */
export async function cleanupUserExchanges(userId: string): Promise<void> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for cleaning up user exchanges');
  }

  const globalBucketKey = 'geo_bucket:global';
  
  try {
    // Get all current candidates in the global bucket
    const allCandidates = await redis!.smembers(globalBucketKey) as string[];
    const pipeline = redis!.multi();
    let cleanedCount = 0;
    
    console.log(`🧹 Checking ${allCandidates.length} candidates for cleanup for user ${userId}`);
    
    // Check each candidate to see if it belongs to this user
    for (const candidateSessionId of allCandidates) {
      const candidateKey = `pending_exchange:${candidateSessionId}`;
      const candidateDataStr = await redis!.get(candidateKey);
      
      if (!candidateDataStr) {
        // Remove stale session from bucket
        pipeline.srem(globalBucketKey, candidateSessionId);
        cleanedCount++;
        continue;
      }
      
      // Parse the candidate data to check user ID
      let candidateData;
      if (typeof candidateDataStr === 'string') {
        candidateData = JSON.parse(candidateDataStr);
      } else {
        candidateData = candidateDataStr;
      }
      
      // If this exchange belongs to the user, clean it up
      if (candidateData.userId === userId) {
        console.log(`🧹 Removing old exchange ${candidateSessionId} for user ${userId}`);
        pipeline.del(candidateKey);
        pipeline.srem(globalBucketKey, candidateSessionId);
        cleanedCount++;
      }
    }
    
    // Execute all cleanup operations atomically
    if (cleanedCount > 0) {
      await pipeline.exec();
      console.log(`🧹 Cleaned up ${cleanedCount} old exchanges for user ${userId}`);
    } else {
      console.log(`✅ No old exchanges found for user ${userId}`);
    }
    
  } catch (error) {
    console.error(`❌ Error cleaning up exchanges for user ${userId}:`, error);
  }
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  // Upstash Redis REST client doesn't require explicit close
}
