/**
 * Environment configuration for Redis
 */

// Check if we should use Redis or fallback to in-memory
export const USE_REDIS = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;

// Redis connection settings
export const REDIS_CONFIG = {
  // Connection timeout
  connectTimeout: 5000,
  
  // Command timeout  
  commandTimeout: 3000,
  
  // Retry settings
  retryAttempts: 3,
  retryDelay: 1000,
  
  // TTL settings (in seconds)
  ttl: {
    pendingExchange: 30,
    exchangeMatch: 600, // 10 minutes
    sseConnection: 300, // 5 minutes
    rateLimit: 60 // 1 minute
  }
};
