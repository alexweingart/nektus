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
