import type { ProcessingState, AISchedulingRequest, DetermineIntentResult, AISchedulingFinalResponse } from '@/types/ai-scheduling';
import { Redis } from '@upstash/redis';

// Extend global to include our processing states
declare global {
  var __processingStates__: Map<string, ProcessingState | unknown> | undefined;
}

// Use Node.js global object to share state across all API route instances
if (!global.__processingStates__) {
  global.__processingStates__ = new Map<string, ProcessingState | unknown>();
}

// Redis-based storage for processing states with in-memory fallback
class ProcessingStateManager {
  private redis: Redis | null = null;
  private memoryStates = global.__processingStates__!; // Use global storage for sharing across API routes

  constructor() {
    // Initialize Redis only if environment variables are present
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    if (redisUrl && redisToken) {
      try {
        this.redis = new Redis({
          url: redisUrl,
          token: redisToken,
        });
        console.log('✅ Upstash Redis initialized for processing states');
      } catch (error) {
        console.error('❌ Failed to initialize Upstash Redis:', error);
        console.warn('⚠️  Falling back to in-memory storage');
      }
    } else {
      console.warn('⚠️  Upstash Redis environment variables not found. Using in-memory storage (dev mode).');
    }
  }

  private getKey(id: string): string {
    return `processing_state:${id}`;
  }

  generateId(): string {
    return `proc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async create(request: AISchedulingRequest, intentResult: DetermineIntentResult): Promise<string> {
    const id = this.generateId();
    const state: ProcessingState = {
      id,
      status: 'processing',
      request,
      intentResult,
      createdAt: new Date(),
    };

    try {
      if (this.redis) {
        // Store in Redis with 5 minute expiration - use set with EX option to avoid auto-parsing
        await this.redis.set(this.getKey(id), JSON.stringify(state), { ex: 5 * 60 });
        console.log(`📝 Created processing state in Redis: ${id}`);
      } else {
        // Fallback to in-memory storage
        this.memoryStates.set(id, state);
        console.log(`📝 Created processing state in memory: ${id} (Redis not available, global map size: ${this.memoryStates.size})`);
        console.log(`📝 Global map instance ID: ${(this.memoryStates as any).__instanceId || 'none'}`);

        // Set instance ID for debugging
        if (!(this.memoryStates as any).__instanceId) {
          (this.memoryStates as any).__instanceId = Math.random().toString(36).substring(7);
        }

        // Clean up memory state after 5 minutes
        setTimeout(() => {
          this.memoryStates.delete(id);
          console.log(`🗑️ Cleaned up memory state: ${id}`);
        }, 5 * 60 * 1000);
      }
    } catch (error) {
      console.error('Error saving state:', error);
      // Fallback to memory even if Redis fails
      this.memoryStates.set(id, state);
    }

    return id;
  }

  async get(id: string): Promise<ProcessingState | null> {
    try {
      if (this.redis) {
        const stateData = await this.redis.get(this.getKey(id));
        if (stateData) {
          // Handle case where Redis returns an object directly (already parsed)
          let state: ProcessingState;
          if (typeof stateData === 'string') {
            state = JSON.parse(stateData) as ProcessingState;
          } else {
            state = stateData as unknown as ProcessingState;
          }
          // Convert date strings back to Date objects
          state.createdAt = new Date(state.createdAt);
          console.log(`🔍 Retrieved processing state from Redis: ${id}`);
          return state;
        }
      } else {
        // Check in-memory storage
        console.log(`🔍 Checking memory for ${id}, global map size: ${this.memoryStates.size}, instance ID: ${(this.memoryStates as any).__instanceId || 'none'}`);
        const state = this.memoryStates.get(id);
        if (state) {
          console.log(`🔍 Retrieved processing state from memory: ${id}`);
          return state as ProcessingState;
        }
      }

      console.log(`🔍 Processing state not found: ${id}`);
      return null;
    } catch (error) {
      console.error('Error retrieving state:', error);
      // Fallback to memory if Redis fails
      const state = this.memoryStates.get(id);
      if (state) {
        console.log(`🔍 Retrieved processing state from memory (Redis fallback): ${id}`);
        return state as ProcessingState;
      }
      return null;
    }
  }

  async update(id: string, updates: Partial<ProcessingState>): Promise<boolean> {
    try {
      const currentState = await this.get(id);
      if (!currentState) return false;

      const updatedState = { ...currentState, ...updates };

      if (this.redis) {
        await this.redis.set(this.getKey(id), JSON.stringify(updatedState), { ex: 5 * 60 });
        console.log(`📝 Updated processing state in Redis: ${id}`);
      } else {
        // Update in memory
        this.memoryStates.set(id, updatedState);
        console.log(`📝 Updated processing state in memory: ${id}`);
      }
      return true;
    } catch (error) {
      console.error('Error updating state:', error);
      // Fallback to memory
      const currentState = this.memoryStates.get(id);
      if (currentState) {
        const updatedState = { ...currentState, ...updates };
        this.memoryStates.set(id, updatedState);
        console.log(`📝 Updated processing state in memory (fallback): ${id}`);
        return true;
      }
      return false;
    }
  }

  async complete(id: string, result: AISchedulingFinalResponse): Promise<boolean> {
    return this.update(id, {
      status: 'completed',
      result,
    });
  }

  async error(id: string, error: string): Promise<boolean> {
    return this.update(id, {
      status: 'error',
      error,
    });
  }

  // Get current state count for debugging
  getStateCount(): number {
    if (this.redis) {
      return -1; // Redis-based, count not available
    } else {
      return this.memoryStates.size;
    }
  }

  // Generic set method for caching arbitrary data
  async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
        console.log(`💾 Cached data in Redis with key: ${key} (TTL: ${ttlSeconds}s)`);
      } else {
        // Fallback to in-memory storage
        this.memoryStates.set(key, value);
        console.log(`💾 Cached data in memory with key: ${key} (Redis not available)`);

        // Clean up after TTL expires
        setTimeout(() => {
          this.memoryStates.delete(key);
          console.log(`🗑️ Cleaned up memory cache: ${key}`);
        }, ttlSeconds * 1000);
      }
    } catch (error) {
      console.error(`Error caching data with key ${key}:`, error);
      // Fallback to memory
      this.memoryStates.set(key, value);
    }
  }

  // Generic get method for retrieving cached data
  async getCached<T = unknown>(key: string): Promise<T | null> {
    try {
      if (this.redis) {
        const data = await this.redis.get(key);
        if (data) {
          // Handle case where Redis returns an object directly (already parsed)
          if (typeof data === 'string') {
            return JSON.parse(data) as T;
          }
          return data as unknown as T;
        }
      } else {
        // Check in-memory storage
        const data = this.memoryStates.get(key);
        if (data) {
          return data as T;
        }
      }
      return null;
    } catch (error) {
      console.error(`Error retrieving cached data with key ${key}:`, error);
      // Fallback to memory
      const fallbackData = this.memoryStates.get(key);
      return (fallbackData as T) || null;
    }
  }

  // Get all keys matching a pattern (Redis KEYS command or memory iteration)
  async getKeys(pattern: string): Promise<string[]> {
    try {
      if (this.redis) {
        // Use Redis KEYS command
        const keys = await this.redis.keys(pattern);
        return keys;
      } else {
        // Filter in-memory keys
        const allKeys = Array.from(this.memoryStates.keys());
        // Simple glob pattern matching - convert * to regex
        const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return allKeys.filter(key => regexPattern.test(key));
      }
    } catch (error) {
      console.error(`Error getting keys with pattern ${pattern}:`, error);
      return [];
    }
  }
}

// Singleton instance
export const processingStateManager = new ProcessingStateManager();