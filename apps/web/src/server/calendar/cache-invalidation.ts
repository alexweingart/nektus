/**
 * Cache invalidation for common-times Redis cache
 * Called when a user adds/removes a calendar to ensure stale scheduling results
 * aren't served from the 1-hour Redis cache.
 */

import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (redisUrl && redisToken) {
    redis = new Redis({ url: redisUrl, token: redisToken });
  }

  return redis;
}

/**
 * Scan Redis for keys matching a pattern and return all matches.
 */
async function scanKeys(client: Redis, pattern: string): Promise<string[]> {
  const allKeys: string[] = [];
  let cursor = 0;

  do {
    const result = await client.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(result[0]);
    const keys = result[1] as string[];
    allKeys.push(...keys);
  } while (cursor !== 0);

  return allKeys;
}

/**
 * Invalidate all common-times cache entries involving a given user.
 * Scans for keys where userId appears as either user1 or user2 in the cache key.
 *
 * Cache key format: common-times:v28:<user1Id>:<user2Id>:<calendarType>:<duration>[:local]
 */
export async function invalidateCommonTimesCache(userId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    // Pass 1: userId as user1 — glob pattern works directly
    const user1Keys = await scanKeys(client, `common-times:*:${userId}:*`);

    // Pass 2: userId as user2 — scan all common-times keys and filter by position
    const allKeys = await scanKeys(client, 'common-times:*');
    const user2Keys = allKeys.filter((key) => {
      const parts = key.split(':');
      // Format: common-times:version:user1:user2:calendarType:duration[:local]
      return parts.length >= 6 && parts[3] === userId;
    });

    // Deduplicate and delete
    const keysToDelete = [...new Set([...user1Keys, ...user2Keys])];

    if (keysToDelete.length > 0) {
      await client.del(...keysToDelete);
      console.log(`🗑️ Invalidated ${keysToDelete.length} common-times cache entries for user ${userId}`);
    }
  } catch (error) {
    // Non-critical — log and continue
    console.error('[cache-invalidation] Error invalidating common-times cache:', error);
  }
}
