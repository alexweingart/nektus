/**
 * Redis client using Upstash Redis
 */

import { Redis } from '@upstash/redis';
import type { ProcessedLocation } from '@/lib/services/server/ipGeolocationService';
import type { UserProfile } from '@/types/profile';

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

// Exchange data interface
interface ExchangeData {
  userId: string;
  profile: UserProfile;
  timestamp: number; // Client timestamp (kept for backwards compatibility)
  serverTimestamp?: number; // Server receive timestamp (used for matching)
  location?: ProcessedLocation;
  mag: number;
  vector?: string;
  sessionId: string;
  sharingCategory?: string;
}

// Match data interface
interface MatchData {
  sessionA: string;
  sessionB: string;
  userA: UserProfile;
  userB: UserProfile;
  timestamp: number;
  status: string;
  sharingCategoryA?: string;
  sharingCategoryB?: string;
}



/**
 * Check if a candidate matches geographically and temporally
 */
async function checkCandidateMatch(
  candidateSessionId: string,
  candidateData: ExchangeData,
  currentLocation: ProcessedLocation,
  currentServerTimestamp: number,
  sessionId: string,
  isAdditional: boolean = false
): Promise<{ isMatch: boolean; timeDiff: number; confidence: string } | null> {
  const prefix = isAdditional ? 'Additional c' : 'C';
  
  console.log(`🔍 Geographic comparison${isAdditional ? ' (additional)' : ''}: ${sessionId} vs ${candidateSessionId}`);

  // Use server timestamp for matching, fallback to client timestamp for backwards compatibility
  const candidateServerTimestamp = candidateData.serverTimestamp || candidateData.timestamp;

  if (!candidateServerTimestamp) {
    console.log(`❌ ${prefix}andidate ${candidateSessionId} has no timestamp, skipping`);
    console.log(`❌ ${prefix}andidate data:`, JSON.stringify(candidateData, null, 2));
    return null;
  }

  try {
    const timeDiff = Math.abs(currentServerTimestamp - candidateServerTimestamp);
    
    if (!isAdditional) {
      console.log(`🔍 Starting geographic comparison for ${candidateSessionId}`);
      console.log(`🔍 Current location:`, currentLocation);
      console.log(`🔍 Candidate location:`, candidateData.location);
    }
    
    if (!currentLocation || !candidateData.location) {
      console.log(`❌ Missing location data - current: ${!!currentLocation}, candidate: ${!!candidateData.location}`);
      return null;
    }
    
    const { getMatchConfidence } = await import('@/lib/services/server/ipGeolocationService');
    const matchInfo = getMatchConfidence(currentLocation, candidateData.location);
    
    if (!isAdditional) {
      console.log(`🔍 Match info result:`, matchInfo);
    }
    
    console.log(`📍 ${isAdditional ? 'Additional g' : 'G'}eographic match: ${matchInfo.confidence} (${matchInfo.timeWindow}ms window)`);
    console.log(`⏰ ${isAdditional ? 'Additional t' : 'T'}ime diff: ${timeDiff}ms (${timeDiff <= matchInfo.timeWindow ? 'WITHIN' : 'OUTSIDE'} window)`);
    
    if (!isAdditional) {
      console.log(`🕐 Locations: ${JSON.stringify({
        current: { city: currentLocation.city, state: currentLocation.state, isVPN: currentLocation.isVPN },
        candidate: { city: candidateData.location.city, state: candidateData.location.state, isVPN: candidateData.location.isVPN }
      })}`);
      console.log(`📊 Server timestamps: current=${currentServerTimestamp}, candidate=${candidateServerTimestamp}, diff=${timeDiff}ms`);
    }
    
    if (matchInfo.confidence === 'no_match') {
      console.log(`❌ No geographic overlap between ${sessionId} and ${candidateSessionId}`);
      return null;
    }
    
    if (timeDiff <= matchInfo.timeWindow) {
      console.log(`✅ TIMING MATCH${isAdditional ? ' (additional)' : ''}: ${timeDiff}ms ≤ ${matchInfo.timeWindow}ms window for ${matchInfo.confidence} match`);
      return { isMatch: true, timeDiff, confidence: matchInfo.confidence };
    } else {
      console.log(`❌ TIMING FAILED${isAdditional ? ' (additional)' : ''}: ${timeDiff}ms > ${matchInfo.timeWindow}ms window for ${matchInfo.confidence} match`);
      return { isMatch: false, timeDiff, confidence: matchInfo.confidence };
    }
  } catch (error) {
    console.log(`❌ Error in${isAdditional ? ' additional' : ''} geographic matching for ${candidateSessionId}:`, error);
    return null;
  }
}

/**
 * Atomically store exchange and find matches using Redis Lua script
 * This prevents race conditions when multiple exchanges arrive simultaneously
 */
export async function atomicExchangeAndMatch(
  sessionId: string,
  exchangeData: ExchangeData,
  currentLocation: ProcessedLocation,
  currentServerTimestamp?: number,
  ttlSeconds: number = 30
): Promise<{ sessionId: string; matchData: ExchangeData } | null> {
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
  console.log(`🔍 Current session ${sessionId} checking against bucket ${globalBucketKey}`);
  
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
    
    // Double-check that our session was added to the bucket
    const postStoreBucket = await redis!.smembers(globalBucketKey) as string[];
    console.log(`✅ Post-store bucket now contains ${postStoreBucket.length} candidates:`, postStoreBucket);
  }
  
  // Now check for matches among the candidates that existed before our addition
  let bestMatch: { sessionId: string; matchData: ExchangeData; timeDiff: number; confidence: string } | null = null;
  
  console.log(`🔍 Starting candidate loop - checking ${currentCandidates.length} candidates that existed before our session`);
  
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
    if (currentServerTimestamp && currentLocation && candidateData.location) {
      const matchResult = await checkCandidateMatch(
        candidateSessionId,
        candidateData,
        currentLocation,
        currentServerTimestamp,
        sessionId,
        false
      );
      
      if (!matchResult) {
        continue;
      }
      
      if (matchResult.isMatch) {
        // Within time window - check if this is the best match so far
        // Priority: 1. Same city > 2. Same state > 3. Same octet > 4. VPN
        // Within same confidence level, prefer shorter time gap
        const confidenceRank: Record<string, number> = { city: 4, state: 3, octet: 2, vpn: 1 };
        const currentRank = confidenceRank[matchResult.confidence];
        const bestRank = bestMatch ? confidenceRank[bestMatch.confidence] : 0;
        
        if (!bestMatch || currentRank > bestRank || 
            (currentRank === bestRank && matchResult.timeDiff < bestMatch.timeDiff)) {
          bestMatch = {
            sessionId: candidateSessionId,
            matchData: candidateData,
            timeDiff: matchResult.timeDiff,
            confidence: matchResult.confidence
          };
        }
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
  
  // No match found in pre-existing candidates, but let's also check if any new candidates arrived after we stored
  if (!sessionAlreadyExists) {
    console.log(`🔍 Checking for any new candidates that may have arrived after our storage...`);
    const newCandidates = await redis!.smembers(globalBucketKey) as string[];
    const additionalCandidates = newCandidates.filter(c => c !== sessionId && !currentCandidates.includes(c));
    console.log(`🔍 Found ${additionalCandidates.length} additional candidates:`, additionalCandidates);
    
    // Check these additional candidates too
    for (const candidateSessionId of additionalCandidates) {
      console.log(`🔍 Checking additional candidate: ${candidateSessionId}`);
      
      const candidateKey = `pending_exchange:${candidateSessionId}`;
      const candidateDataStr = await redis!.get(candidateKey);
      
      if (!candidateDataStr) {
        console.log(`🧹 Cleaning up stale additional session ${candidateSessionId} from global bucket`);
        await redis!.srem(globalBucketKey, candidateSessionId);
        continue;
      }
      
      // Handle both string and object responses from Redis
      let candidateData;
      if (typeof candidateDataStr === 'string') {
        candidateData = JSON.parse(candidateDataStr);
      } else {
        candidateData = candidateDataStr;
      }
      
      // Geographic confidence-based matching (same logic as above)
      if (currentServerTimestamp && currentLocation && candidateData.location) {
        const matchResult = await checkCandidateMatch(
          candidateSessionId,
          candidateData,
          currentLocation,
          currentServerTimestamp,
          sessionId,
          true
        );
        
        if (matchResult?.isMatch) {
          // Clean up both the matched candidate and our exchange atomically
          const cleanupPipeline = redis!.multi();
          cleanupPipeline.del(`pending_exchange:${candidateSessionId}`);
          cleanupPipeline.srem(globalBucketKey, candidateSessionId);
          cleanupPipeline.del(exchangeKey);
          cleanupPipeline.srem(globalBucketKey, sessionId);
          await cleanupPipeline.exec();
          
          console.log(`🎯 Additional match found: ${candidateSessionId} with time diff ${matchResult.timeDiff}ms (confidence: ${matchResult.confidence})`);
          
          return {
            sessionId: candidateSessionId,
            matchData: candidateData
          };
        }
      }
    }
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
 * Store exchange match
 */
export async function storeExchangeMatch(
  token: string,
  sessionA: string,
  sessionB: string,
  userA: UserProfile,
  userB: UserProfile,
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
export async function getExchangeMatch(token: string): Promise<MatchData | null> {
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
  
  return matchData as MatchData;
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

