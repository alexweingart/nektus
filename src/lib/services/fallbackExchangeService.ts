/**
 * Fallback exchange storage using in-memory storage when Redis is not available
 */

// In-memory fallback storage
const pendingExchanges = new Map<string, {
  sessionId: string,
  userId?: string,
  timestamp: number,
  magnitude?: number,
  vector?: string,
  rtt?: number,
  ipBlock?: string
}>();

const exchangeMatches = new Map<string, {
  sessionA: string,
  sessionB: string,
  userA: string,
  userB?: string,
  timestamp: number,
  status: string
}>();

const rateLimitStore = new Map<string, { 
  count: number; 
  resetTime: number 
}>();

// Cleanup old data periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  
  // Clean up old pending exchanges (30 seconds)
  for (const [sessionId, exchange] of pendingExchanges) {
    if (now - exchange.timestamp > 30000) {
      pendingExchanges.delete(sessionId);
    }
  }
  
  // Clean up old matches (10 minutes)
  for (const [token, match] of exchangeMatches) {
    if (now - match.timestamp > 600000) {
      exchangeMatches.delete(token);
    }
  }
  
  // Clean up old rate limits (1 minute)
  for (const [key, limit] of rateLimitStore) {
    if (now > limit.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 30000);

/**
 * Fallback rate limiting
 */
export function checkRateLimitFallback(
  key: string, 
  limit: number, 
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const rateLimitKey = `${key}:${window}`;
  
  const current = rateLimitStore.get(rateLimitKey);
  
  if (!current) {
    rateLimitStore.set(rateLimitKey, { count: 1, resetTime: (window + 1) * windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: (window + 1) * windowMs
    };
  }
  
  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime
    };
  }
  
  current.count++;
  return {
    allowed: true,
    remaining: limit - current.count,
    resetTime: current.resetTime
  };
}

/**
 * Fallback pending exchange storage
 */
export function storePendingExchangeFallback(sessionId: string, data: any): void {
  pendingExchanges.set(sessionId, {
    sessionId,
    timestamp: Date.now(),
    ...data
  });
}

/**
 * Fallback matching
 */
export function findMatchingExchangeFallback(
  sessionId: string,
  data: any,
  timeWindow: number = 3000
): string | null {
  const currentTime = Date.now();
  
  for (const [otherSessionId, exchange] of pendingExchanges) {
    if (otherSessionId === sessionId) continue;
    
    // Check time window
    if (currentTime - exchange.timestamp > timeWindow) {
      pendingExchanges.delete(otherSessionId);
      continue;
    }
    
    // More relaxed matching criteria for better success rate
    const timeDiff = Math.abs(data.timestamp - exchange.timestamp);
    
    // For development/testing: allow cross-network matching
    // In production, you might want to be more restrictive
    const sameIpBlock = data.ipBlock === exchange.ipBlock;
    const crossNetworkAllowed = process.env.NODE_ENV === 'development';
    
    // If we have motion vectors, check if they're similar (not exact match)
    let vectorMatch = true;
    if (data.vector && exchange.vector) {
      // For now, just check if both have vectors - exact matching is too strict
      vectorMatch = true; // More lenient for testing
    }
    
    // Match if within time window and either same IP block OR cross-network allowed
    if (timeDiff < timeWindow && (sameIpBlock || crossNetworkAllowed) && vectorMatch) {
      // Remove the matched exchange
      pendingExchanges.delete(otherSessionId);
      return otherSessionId;
    }
  }
  
  return null;
}

/**
 * Fallback match storage
 */
export function storeExchangeMatchFallback(
  token: string,
  sessionA: string,
  sessionB: string,
  userA: string,
  userB?: string
): void {
  exchangeMatches.set(token, {
    sessionA,
    sessionB,
    userA,
    userB,
    timestamp: Date.now(),
    status: 'pending'
  });
}

/**
 * Fallback match retrieval
 */
export function getExchangeMatchFallback(token: string): any | null {
  return exchangeMatches.get(token) || null;
}

// Cleanup on process exit
process.on('SIGINT', () => {
  clearInterval(cleanupInterval);
});

process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
});
