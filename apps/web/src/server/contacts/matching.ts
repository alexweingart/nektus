/**
 * Contact exchange matching logic using Redis
 */

import { redis, isRedisAvailable } from '@/server/config/redis';
import type { ProcessedLocation } from '@/server/location/ip-geolocation';
import type { UserProfile } from '@/types/profile';
import { CACHE_TTL } from '@nektus/shared-client';

// Re-export for backwards compatibility
export { isRedisAvailable };

// Time window for pending matches (ms)
const PENDING_MATCH_WINDOW = 1500; // 1.5 seconds - both eligibility and isolation window

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
  pendingMatchWith?: string; // Session ID of pending match partner
  pendingMatchCreatedAt?: number; // Server timestamp when pending match was created
}

// Match data interface - supports both waiting and matched states
interface MatchData {
  sessionA: string;
  sessionB: string | null;      // null when waiting for scan
  userA: UserProfile;
  userB: UserProfile | null;    // null when waiting for scan
  timestamp: number;
  status: string;                // 'waiting' | 'matched' | 'pending'
  sharingCategoryA?: string;
  sharingCategoryB?: string | null;
  scanStatus?: 'pending_auth' | 'completed' | null;  // QR scan status
  previewAccessedAt?: number;    // Timestamp when preview was accessed
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

    const { getMatchConfidence } = await import('@/server/location/ip-geolocation');
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
  ttlSeconds: number = CACHE_TTL.SHORT_S
): Promise<{ sessionId: string; matchData: ExchangeData } | null> {
  if (!isRedisAvailable()) {
    throw new Error('Redis is not available for atomic exchange operations');
  }

  const globalBucketKey = 'geo_bucket:global';
  const exchangeKey = `pending_exchange:${sessionId}`;

  // Check if this session already exists (multiple hits from same session)
  const existingExchangeData = await redis!.get(exchangeKey);
  const sessionAlreadyExists = !!existingExchangeData;

  console.log(`🔍 [MATCH DEBUG] Session ${sessionId} - sessionAlreadyExists: ${sessionAlreadyExists}`);
  if (sessionAlreadyExists) {
    console.log(`🔍 [MATCH DEBUG] Existing session data:`, existingExchangeData);
  }

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

    // Check for pending matches that should be cancelled due to this new exchange
    if (currentServerTimestamp) {
      console.log(`🔍 Checking if new exchange ${sessionId} cancels any pending matches`);
      for (const candidateSessionId of currentCandidates) {
        if (candidateSessionId === sessionId) continue;

        const candidateKey = `pending_exchange:${candidateSessionId}`;
        const candidateDataStr = await redis!.get(candidateKey);
        if (!candidateDataStr) continue;

        const candidateData = typeof candidateDataStr === 'string' ? JSON.parse(candidateDataStr) : candidateDataStr;

        // Check if this candidate has a pending match
        if (candidateData.pendingMatchWith) {
          const candidateTimestamp = candidateData.serverTimestamp || candidateData.timestamp;
          if (!candidateTimestamp) continue;

          // Check if our new exchange is within 1.5s of this pending exchange
          const timeDiff = Math.abs(currentServerTimestamp - candidateTimestamp);
          if (timeDiff <= PENDING_MATCH_WINDOW) {
            console.log(`❌ Cancelling pending match for ${candidateSessionId} ↔ ${candidateData.pendingMatchWith} (new exchange within ${timeDiff}ms)`);

            // Cancel pending match for both partners
            const partnerKey = `pending_exchange:${candidateData.pendingMatchWith}`;
            const partnerDataStr = await redis!.get(partnerKey);

            if (partnerDataStr) {
              const partnerData = typeof partnerDataStr === 'string' ? JSON.parse(partnerDataStr) : partnerDataStr;
              delete partnerData.pendingMatchWith;
              delete partnerData.pendingMatchCreatedAt;
              await redis!.setex(partnerKey, ttlSeconds, JSON.stringify(partnerData));
            }

            delete candidateData.pendingMatchWith;
            delete candidateData.pendingMatchCreatedAt;
            await redis!.setex(candidateKey, ttlSeconds, JSON.stringify(candidateData));

            console.log(`🚫 Pending match cancelled`);
          }
        }
      }
    }
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
    console.log(`🔍 [MATCH DEBUG] Checking for additional candidates (sessionAlreadyExists=${sessionAlreadyExists})`);
    console.log(`🔍 Checking for any new candidates that may have arrived after our storage...`);
    const newCandidates = await redis!.smembers(globalBucketKey) as string[];
    const additionalCandidates = newCandidates.filter(c => c !== sessionId && !currentCandidates.includes(c));
    console.log(`🔍 Found ${additionalCandidates.length} additional candidates:`, additionalCandidates);
    console.log(`🔍 [MATCH DEBUG] Pre-existing candidates:`, currentCandidates);
    console.log(`🔍 [MATCH DEBUG] All candidates now:`, newCandidates);

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

  // No immediate match found - check for pending match candidates
  if (!sessionAlreadyExists && currentServerTimestamp && currentLocation) {
    console.log(`🔍 Checking for pending match candidates (within ${PENDING_MATCH_WINDOW}ms but outside immediate window)`);

    let bestPendingCandidate: { sessionId: string; data: ExchangeData; timeDiff: number } | null = null;

    for (const candidateSessionId of currentCandidates) {
      if (candidateSessionId === sessionId) continue;

      const candidateKey = `pending_exchange:${candidateSessionId}`;
      const candidateDataStr = await redis!.get(candidateKey);
      if (!candidateDataStr) continue;

      const candidateData = typeof candidateDataStr === 'string' ? JSON.parse(candidateDataStr) : candidateDataStr;
      const candidateServerTimestamp = candidateData.serverTimestamp || candidateData.timestamp;
      if (!candidateServerTimestamp || !candidateData.location) continue;

      const timeDiff = Math.abs(currentServerTimestamp - candidateServerTimestamp);

      // Check if within pending match window
      if (timeDiff <= PENDING_MATCH_WINDOW) {
        // Check geographic compatibility
        const { getMatchConfidence } = await import('@/server/location/ip-geolocation');
        const matchInfo = getMatchConfidence(currentLocation, candidateData.location);

        if (matchInfo.confidence !== 'no_match' && timeDiff > matchInfo.timeWindow) {
          // This is a pending match candidate (geographic match but outside immediate window)
          if (!bestPendingCandidate || timeDiff < bestPendingCandidate.timeDiff) {
            bestPendingCandidate = { sessionId: candidateSessionId, data: candidateData, timeDiff };
          }
        }
      }
    }

    if (bestPendingCandidate) {
      console.log(`🕐 Found pending match candidate: ${bestPendingCandidate.sessionId} (time diff: ${bestPendingCandidate.timeDiff}ms)`);

      // Verify isolation: no other exchanges within 1.5s of EITHER exchange
      const candidateTimestamp = bestPendingCandidate.data.serverTimestamp || bestPendingCandidate.data.timestamp;
      const laterTimestamp = Math.max(currentServerTimestamp, candidateTimestamp!);

      let isolationViolation = false;
      for (const otherSessionId of currentCandidates) {
        if (otherSessionId === sessionId || otherSessionId === bestPendingCandidate.sessionId) continue;

        const otherKey = `pending_exchange:${otherSessionId}`;
        const otherDataStr = await redis!.get(otherKey);
        if (!otherDataStr) continue;

        const otherData = typeof otherDataStr === 'string' ? JSON.parse(otherDataStr) : otherDataStr;
        const otherTimestamp = otherData.serverTimestamp || otherData.timestamp;
        if (!otherTimestamp) continue;

        // Check if other exchange is within 1.5s of EITHER our exchange or the candidate
        const diffFromCurrent = Math.abs(otherTimestamp - currentServerTimestamp);
        const diffFromCandidate = Math.abs(otherTimestamp - candidateTimestamp!);

        if (diffFromCurrent <= PENDING_MATCH_WINDOW || diffFromCandidate <= PENDING_MATCH_WINDOW) {
          console.log(`❌ Isolation violation: exchange ${otherSessionId} is within 1.5s (${Math.min(diffFromCurrent, diffFromCandidate)}ms)`);
          isolationViolation = true;
          break;
        }
      }

      if (!isolationViolation) {
        // Create pending match!
        console.log(`✅ Creating pending match between ${sessionId} and ${bestPendingCandidate.sessionId}`);
        console.log(`⏰ Pending match will be eligible for promotion at ${laterTimestamp + PENDING_MATCH_WINDOW}ms`);

        // Update both exchanges with pending match info
        const updatedExchangeData = {
          ...exchangeData,
          pendingMatchWith: bestPendingCandidate.sessionId,
          pendingMatchCreatedAt: laterTimestamp
        };

        const updatedCandidateData = {
          ...bestPendingCandidate.data,
          pendingMatchWith: sessionId,
          pendingMatchCreatedAt: laterTimestamp
        };

        await redis!.setex(exchangeKey, ttlSeconds, JSON.stringify(updatedExchangeData));
        await redis!.setex(`pending_exchange:${bestPendingCandidate.sessionId}`, ttlSeconds, JSON.stringify(updatedCandidateData));

        console.log(`💑 Pending match created - waiting for ${PENDING_MATCH_WINDOW}ms from later timestamp`);
      } else {
        console.log(`❌ Cannot create pending match due to isolation violation`);
      }
    } else {
      console.log(`🔍 No suitable pending match candidates found`);
    }
  }

  // No match found - now it's safe to update exchange data if session already existed
  if (sessionAlreadyExists) {
    console.log(`🔄 No match found, now updating existing session ${sessionId} with newer data`);
    await redis!.setex(exchangeKey, ttlSeconds, JSON.stringify(exchangeData));
    console.log(`💾 Updated exchange ${sessionId} with newer timestamp`);
  } else {
    console.log(`🔍 [MATCH DEBUG] SKIPPED additional candidates check because sessionAlreadyExists=${sessionAlreadyExists}`);
  }

  console.log(`⏳ No match found, exchange ${sessionId} remains in bucket for future matching`);
  console.log(`🔍 [MATCH DEBUG] Final state - Session: ${sessionId}, sessionAlreadyExists: ${sessionAlreadyExists}, returning null`);
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
    redis!.setex(`exchange_match:${token}`, CACHE_TTL.SHORT_S, JSON.stringify(matchData)),

    // Store references by session IDs for lookup
    redis!.setex(`exchange_session:${sessionA}`, CACHE_TTL.SHORT_S, JSON.stringify({
      token,
      youAre: 'A'
    })),

    redis!.setex(`exchange_session:${sessionB}`, CACHE_TTL.SHORT_S, JSON.stringify({
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
