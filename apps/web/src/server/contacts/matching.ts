/**
 * Contact exchange matching logic using Redis
 */

import { redis, isRedisAvailable } from '@/server/config/redis';
import type { ProcessedLocation } from '@/server/location/ip-geolocation';
import type { UserProfile } from '@/types/profile';
import { CACHE_TTL } from '@nektus/shared-client';

// Time window for pending matches (ms)
const PENDING_MATCH_WINDOW = 1500; // 1.5 seconds - both eligibility and isolation window

/** Parse Redis value that may be a string or already-parsed object */
function parseRedisJson<T>(value: unknown): T {
  return typeof value === 'string' ? JSON.parse(value) : value as T;
}

/** Clean up both matched exchanges from Redis atomically */
async function cleanupMatchedExchanges(
  globalBucketKey: string,
  sessionIdA: string,
  sessionIdB: string
): Promise<void> {
  const pipeline = redis!.multi();
  pipeline.del(`pending_exchange:${sessionIdA}`);
  pipeline.srem(globalBucketKey, sessionIdA);
  pipeline.del(`pending_exchange:${sessionIdB}`);
  pipeline.srem(globalBucketKey, sessionIdB);
  await pipeline.exec();
}

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
  _sessionId: string,
  _isAdditional: boolean = false
): Promise<{ isMatch: boolean; timeDiff: number; confidence: string } | null> {
  const candidateServerTimestamp = candidateData.serverTimestamp || candidateData.timestamp;
  if (!candidateServerTimestamp) return null;

  try {
    const timeDiff = Math.abs(currentServerTimestamp - candidateServerTimestamp);

    if (!currentLocation || !candidateData.location) return null;

    const { getMatchConfidence } = await import('@/server/location/ip-geolocation');
    const matchInfo = getMatchConfidence(currentLocation, candidateData.location);

    if (matchInfo.confidence === 'no_match') return null;

    if (timeDiff <= matchInfo.timeWindow) {
      return { isMatch: true, timeDiff, confidence: matchInfo.confidence };
    } else {
      return { isMatch: false, timeDiff, confidence: matchInfo.confidence };
    }
  } catch (error) {
    console.error(`Error in geographic matching for ${candidateSessionId}:`, error);
    return null;
  }
}

/**
 * Atomically store exchange and find matches using Redis pipelines.
 * Prevents race conditions when multiple exchanges arrive simultaneously.
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

  // Get current candidates before our transaction
  const currentCandidates = await redis!.smembers(globalBucketKey) as string[];

  if (!sessionAlreadyExists) {
    // Store our exchange atomically
    const pipeline = redis!.multi();
    pipeline.setex(exchangeKey, ttlSeconds, JSON.stringify(exchangeData));
    pipeline.sadd(globalBucketKey, sessionId);
    pipeline.expire(globalBucketKey, ttlSeconds);
    await pipeline.exec();

    // Cancel any pending matches that conflict with this new exchange
    if (currentServerTimestamp) {
      for (const candidateSessionId of currentCandidates) {
        if (candidateSessionId === sessionId) continue;

        const candidateKey = `pending_exchange:${candidateSessionId}`;
        const candidateDataStr = await redis!.get(candidateKey);
        if (!candidateDataStr) continue;

        const candidateData = parseRedisJson<ExchangeData>(candidateDataStr);

        if (candidateData.pendingMatchWith) {
          const candidateTimestamp = candidateData.serverTimestamp || candidateData.timestamp;
          if (!candidateTimestamp) continue;

          const timeDiff = Math.abs(currentServerTimestamp - candidateTimestamp);
          if (timeDiff <= PENDING_MATCH_WINDOW) {
            // Cancel pending match for both partners
            const partnerKey = `pending_exchange:${candidateData.pendingMatchWith}`;
            const partnerDataStr = await redis!.get(partnerKey);

            if (partnerDataStr) {
              const partnerData = parseRedisJson<ExchangeData>(partnerDataStr);
              delete partnerData.pendingMatchWith;
              delete partnerData.pendingMatchCreatedAt;
              await redis!.setex(partnerKey, ttlSeconds, JSON.stringify(partnerData));
            }

            delete candidateData.pendingMatchWith;
            delete candidateData.pendingMatchCreatedAt;
            await redis!.setex(candidateKey, ttlSeconds, JSON.stringify(candidateData));
          }
        }
      }
    }
  }

  // Check for matches among pre-existing candidates
  let bestMatch: { sessionId: string; matchData: ExchangeData; timeDiff: number; confidence: string } | null = null;

  for (const candidateSessionId of currentCandidates) {
    if (candidateSessionId === sessionId) continue;

    const candidateKey = `pending_exchange:${candidateSessionId}`;
    const candidateDataStr = await redis!.get(candidateKey);

    if (!candidateDataStr) {
      await redis!.srem(globalBucketKey, candidateSessionId);
      continue;
    }

    const candidateData = parseRedisJson<ExchangeData>(candidateDataStr);

    if (currentServerTimestamp && currentLocation && candidateData.location) {
      const matchResult = await checkCandidateMatch(
        candidateSessionId, candidateData, currentLocation, currentServerTimestamp, sessionId
      );

      if (!matchResult) continue;

      if (matchResult.isMatch) {
        // Priority: city > state > octet > vpn; within same level, prefer shorter time gap
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
      // Fallback to immediate match (no location/timestamp available)
      await cleanupMatchedExchanges(globalBucketKey, candidateSessionId, sessionId);
      return { sessionId: candidateSessionId, matchData: candidateData };
    }
  }

  if (bestMatch) {
    console.log(`Match found: ${bestMatch.sessionId} (${bestMatch.timeDiff}ms, ${bestMatch.confidence})`);
    await cleanupMatchedExchanges(globalBucketKey, bestMatch.sessionId, sessionId);
    return { sessionId: bestMatch.sessionId, matchData: bestMatch.matchData };
  }

  // Check if any new candidates arrived after we stored
  if (!sessionAlreadyExists) {
    const newCandidates = await redis!.smembers(globalBucketKey) as string[];
    const additionalCandidates = newCandidates.filter(c => c !== sessionId && !currentCandidates.includes(c));

    for (const candidateSessionId of additionalCandidates) {
      const candidateDataStr = await redis!.get(`pending_exchange:${candidateSessionId}`);

      if (!candidateDataStr) {
        await redis!.srem(globalBucketKey, candidateSessionId);
        continue;
      }

      const candidateData = parseRedisJson<ExchangeData>(candidateDataStr);

      if (currentServerTimestamp && currentLocation && candidateData.location) {
        const matchResult = await checkCandidateMatch(
          candidateSessionId, candidateData, currentLocation, currentServerTimestamp, sessionId, true
        );

        if (matchResult?.isMatch) {
          await cleanupMatchedExchanges(globalBucketKey, candidateSessionId, sessionId);
          return { sessionId: candidateSessionId, matchData: candidateData };
        }
      }
    }
  }

  // Check for pending match candidates (within window but outside immediate match)
  if (!sessionAlreadyExists && currentServerTimestamp && currentLocation) {
    let bestPendingCandidate: { sessionId: string; data: ExchangeData; timeDiff: number } | null = null;

    for (const candidateSessionId of currentCandidates) {
      if (candidateSessionId === sessionId) continue;

      const candidateDataStr = await redis!.get(`pending_exchange:${candidateSessionId}`);
      if (!candidateDataStr) continue;

      const candidateData = parseRedisJson<ExchangeData>(candidateDataStr);
      const candidateServerTimestamp = candidateData.serverTimestamp || candidateData.timestamp;
      if (!candidateServerTimestamp || !candidateData.location) continue;

      const timeDiff = Math.abs(currentServerTimestamp - candidateServerTimestamp);

      if (timeDiff <= PENDING_MATCH_WINDOW) {
        const { getMatchConfidence } = await import('@/server/location/ip-geolocation');
        const matchInfo = getMatchConfidence(currentLocation, candidateData.location);

        if (matchInfo.confidence !== 'no_match' && timeDiff > matchInfo.timeWindow) {
          if (!bestPendingCandidate || timeDiff < bestPendingCandidate.timeDiff) {
            bestPendingCandidate = { sessionId: candidateSessionId, data: candidateData, timeDiff };
          }
        }
      }
    }

    if (bestPendingCandidate) {
      // Verify isolation: no other exchanges within 1.5s of EITHER exchange
      const candidateTimestamp = bestPendingCandidate.data.serverTimestamp || bestPendingCandidate.data.timestamp;
      const laterTimestamp = Math.max(currentServerTimestamp, candidateTimestamp!);

      let isolationViolation = false;
      for (const otherSessionId of currentCandidates) {
        if (otherSessionId === sessionId || otherSessionId === bestPendingCandidate.sessionId) continue;

        const otherDataStr = await redis!.get(`pending_exchange:${otherSessionId}`);
        if (!otherDataStr) continue;

        const otherData = parseRedisJson<ExchangeData>(otherDataStr);
        const otherTimestamp = otherData.serverTimestamp || otherData.timestamp;
        if (!otherTimestamp) continue;

        const diffFromCurrent = Math.abs(otherTimestamp - currentServerTimestamp);
        const diffFromCandidate = Math.abs(otherTimestamp - candidateTimestamp!);

        if (diffFromCurrent <= PENDING_MATCH_WINDOW || diffFromCandidate <= PENDING_MATCH_WINDOW) {
          isolationViolation = true;
          break;
        }
      }

      if (!isolationViolation) {
        console.log(`Pending match created: ${sessionId} <-> ${bestPendingCandidate.sessionId}`);

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
      }
    }
  }

  // Update exchange data if session already existed (no match found)
  if (sessionAlreadyExists) {
    await redis!.setex(exchangeKey, ttlSeconds, JSON.stringify(exchangeData));
  }

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

  return parseRedisJson<MatchData>(matchData);
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

    for (const candidateSessionId of allCandidates) {
      const candidateKey = `pending_exchange:${candidateSessionId}`;
      const candidateDataStr = await redis!.get(candidateKey);

      if (!candidateDataStr) {
        pipeline.srem(globalBucketKey, candidateSessionId);
        cleanedCount++;
        continue;
      }

      const candidateData = parseRedisJson<ExchangeData>(candidateDataStr);

      if (candidateData.userId === userId) {
        pipeline.del(candidateKey);
        pipeline.srem(globalBucketKey, candidateSessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      await pipeline.exec();
    }

  } catch (error) {
    console.error(`Error cleaning up exchanges for user ${userId}:`, error);
  }
}
