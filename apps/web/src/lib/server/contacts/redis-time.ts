/**
 * Redis Time Authority Service
 * 
 * Uses Redis TIME command to provide consistent time across all serverless instances.
 * Redis TIME returns microsecond-precision Unix timestamp that's consistent across all connections.
 */

import { redis, isRedisAvailable } from '@/lib/config/redis';

/**
 * Get current time from Redis TIME command (microsecond precision)
 * Falls back to Date.now() if Redis is unavailable
 */
export async function getRedisTime(): Promise<number> {
  if (!isRedisAvailable()) {
    console.warn('⚠️ Redis unavailable, falling back to Date.now()');
    return Date.now();
  }

  try {
    // Redis TIME returns [seconds, microseconds] since Unix epoch
    const timeResult = await redis!.time();
    const [seconds, microseconds] = timeResult;
    
    // Convert to milliseconds (standard JavaScript timestamp)
    const timestamp = parseInt(seconds.toString()) * 1000 + Math.floor(parseInt(microseconds.toString()) / 1000);
    
    return timestamp;
  } catch (error) {
    console.warn('⚠️ Redis TIME failed, falling back to Date.now():', error);
    return Date.now();
  }
}